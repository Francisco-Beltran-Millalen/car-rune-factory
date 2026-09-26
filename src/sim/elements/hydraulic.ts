// Elementos hidráulicos y acoplados de la biblioteca (P23 §8.2). Puro (§1).
// Leyes y unidades: docs/modules/solver.md §7.

import { clamp } from '../../core/math.ts';
import type { ElementDef, Fluid, PortDef } from '../solver/types.ts';
import { controlFlag, controlNumber, noCommit, noEval, smoothSqrt, smoothSqrtSlope, softRelu, softReluSlope } from './common.ts';

function hydraulic2(idA: string, idB: string, fluid: Fluid): PortDef[] {
  return [
    { id: idA, domain: 'hydraulic', fluid },
    { id: idB, domain: 'hydraulic', fluid },
  ];
}

// ─── Bomba eléctrica acoplada ─────────────────────────────────────────────

interface PumpConstants {
  qMax: number;
  pMax: number;
  vNominal: number;
  wearQ: number;
  wearP: number;
  epsP: number;
  windingR: number;
}

interface PumpOutput {
  q: number;
  i: number;
  dqDv: number;
  dqDdp: number;
  diDv: number;
  diDdp: number;
}

/** Curva de la bomba y sus derivadas; `dp = p_out − p_in`, `v = e+ − e−`. */
function pumpOutput(dp: number, v: number, wear: number, airF: number, c: PumpConstants): PumpOutput {
  if (v <= 0) {
    // Sin tensión no hay bombeo; la bobina queda como resistencia pura.
    // (Para V > 0 se usa la curva normal, que ya es suave y segura por εP;
    // así no hay escalón de corriente al conmutar el relé.)
    const diDv = 1 / c.windingR;
    return { q: 0, i: v / c.windingR, dqDv: 0, dqDdp: 0, diDv, diDdp: 0 };
  }
  const vf = clamp(v / c.vNominal, 0, 1.1);
  const dvf = v / c.vNominal > 0 && v / c.vNominal < 1.1 ? 1 / c.vNominal : 0;
  const qm = c.qMax * (1 - c.wearQ * wear) * vf;
  const pm = c.pMax * (1 - c.wearP * wear) * vf;
  const pmEps = pm + c.epsP;
  const head = 1 - dp / pmEps;
  const dqDvBase = c.qMax * (1 - c.wearQ * wear) * dvf;
  const dpmDv = c.pMax * (1 - c.wearP * wear) * dvf;
  const open = head > 0;
  const q = open ? qm * head * airF : 0;
  const dqDv = open ? dqDvBase * head * airF + (qm * airF * dp * dpmDv) / (pmEps * pmEps) : 0;
  const dqDdp = open ? (-qm * airF) / pmEps : 0;
  const dpp = dp > 0 ? dp : 0;
  const base = 1.5 + (5.5 * dpp) / pmEps;
  const diDv = base * dvf - (5.5 * dpp * dpmDv * vf) / (pmEps * pmEps);
  const diDdp = dp > 0 ? (5.5 / pmEps) * vf : 0;
  return { q, i: base * vf, dqDv, dqDdp, diDv, diDdp };
}

/** Bomba centrífuga movida por correa (A13, spec cooling §5.1): puertos
 *  `in`/`out`; control `n` (rpm de la bomba), `air` y `wear`.
 *  `H = pMax·(n/nRef)²`, `q = qMax·(n/nRef)·√⁺(1 − Δp/H)·(1 − aire)`. */
export function createCentrifugalPump(
  params: Readonly<Record<string, number>>,
  fluid: Fluid,
): ElementDef {
  const qMax = controlNumber(params['qMax'], 9000);
  const pMax = controlNumber(params['pMax'], 1.5);
  const nRef = controlNumber(params['nRef'], 6000);
  const def: ElementDef = {
    ports: hydraulic2('in', 'out', fluid),
    params: { qMax, pMax, nRef },
    control: { n: 0, air: 0, wear: 0 },
    state: {},
    faults: { wear: { label: 'Desgaste', kind: 'severity' } },
    eval(pot, out) {
      const o = pumpPoint(pot);
      out.flow[0] = -o.q;
      out.flow[1] = o.q;
      out.jac[0] = o.dq;
      out.jac[1] = -o.dq;
      out.jac[2] = -o.dq;
      out.jac[3] = o.dq;
    },
    commit: noCommit,
    probes: { q: (pot) => pumpPoint(pot).q },
  };
  function pumpPoint(pot: Float64Array): { q: number; dq: number } {
    // Δp = p_out − p_in: lo que la bomba debe vencer.
    const dp = (pot[1] ?? 0) - (pot[0] ?? 0);
    const n = Math.max(0, controlNumber(def.control['n']));
    const air = clamp(controlNumber(def.control['air']), 0, 1);
    const wear = clamp(controlNumber(def.control['wear']), 0, 1);
    const ratio = n / Math.max(nRef, 1);
    const w = 1 - 0.85 * wear;
    const qm = qMax * w * ratio;
    const pm = pMax * w * ratio * ratio;
    if (qm <= 0 || pm <= 1e-9) return { q: 0, dq: 0 };
    const x = 1 - dp / pm;
    return {
      q: qm * smoothSqrt(x) * (1 - air),
      dq: qm * (1 - air) * smoothSqrtSlope(x) * (-1 / pm),
    };
  }
  return def;
}

/** Bomba: puertos `e+`, `e-` (eléctricos) e `in`, `out` (hidráulicos). */
export function createElectricPump(
  params: Readonly<Record<string, number>>,
  fluid: Fluid,
): ElementDef {
  const c: PumpConstants = {
    qMax: controlNumber(params['qMax'], 120),
    pMax: controlNumber(params['pMax'], 6.5),
    vNominal: controlNumber(params['vNominal'], 13.5),
    wearQ: controlNumber(params['wearQ'], 0.7),
    wearP: controlNumber(params['wearP'], 0.5),
    epsP: controlNumber(params['epsP'], 0.01),
    windingR: controlNumber(params['windingR'], 1),
  };
  const def: ElementDef = {
    ports: [
      { id: 'e+', domain: 'electric' },
      { id: 'e-', domain: 'electric' },
      { id: 'in', domain: 'hydraulic', fluid },
      { id: 'out', domain: 'hydraulic', fluid },
    ],
    params: { ...c },
    control: { air: 0, wear: 0 },
    state: {},
    faults: { wear: { label: 'Desgaste', kind: 'severity' } },
    eval(pot, out) {
      const o = readPump(pot);
      out.flow[0] = -o.i;
      out.flow[1] = o.i;
      out.flow[2] = -o.q;
      out.flow[3] = o.q;
      out.jac[0] = -o.diDv;
      out.jac[1] = o.diDv;
      out.jac[2] = o.diDdp;
      out.jac[3] = -o.diDdp;
      out.jac[4] = o.diDv;
      out.jac[5] = -o.diDv;
      out.jac[6] = -o.diDdp;
      out.jac[7] = o.diDdp;
      out.jac[8] = -o.dqDv;
      out.jac[9] = o.dqDv;
      out.jac[10] = o.dqDdp;
      out.jac[11] = -o.dqDdp;
      out.jac[12] = o.dqDv;
      out.jac[13] = -o.dqDv;
      out.jac[14] = -o.dqDdp;
      out.jac[15] = o.dqDdp;
    },
    commit: noCommit,
    probes: {
      q: (pot) => readPump(pot).q,
      i: (pot) => readPump(pot).i,
    },
  };
  /** Lee el punto de operación actual (los tests y las sondas lo usan). */
  function readPump(pot: Float64Array): PumpOutput {
    const v = (pot[0] ?? 0) - (pot[1] ?? 0);
    const dp = (pot[3] ?? 0) - (pot[2] ?? 0);
    const wear = clamp(controlNumber(def.control['wear']), 0, 1);
    const airF = 1 - clamp(controlNumber(def.control['air']), 0, 1);
    return pumpOutput(dp, v, wear, airF, c);
  }
  return def;
}

// ─── Regulador de alivio con referencia ───────────────────────────────────

/**
 * `q = k·softRelu(p_in − p_ref − set)` hacia el retorno (§8.2).
 * Params: `k` (L/h/bar), `set` (bar) y `smooth` (bar). `control.set` permite
 * el regulador pegado abierto (setpoint 0,8 bar) y `control.noReturn` el
 * pegado cerrado.
 */
export function createReliefRegulator(
  params: Readonly<Record<string, number>>,
  fluid: Fluid,
): ElementDef {
  const k = controlNumber(params['k'], 1000);
  const setDefault = controlNumber(params['set'], 3);
  const smooth = controlNumber(params['smooth'], 0.01);
  const def: ElementDef = {
    ports: [
      { id: 'in', domain: 'hydraulic', fluid },
      { id: 'ret', domain: 'hydraulic', fluid },
      { id: 'ref', domain: 'hydraulic', fluid },
    ],
    params: { k, set: setDefault, smooth },
    control: { set: setDefault, noReturn: false },
    state: {},
    faults: { state: { label: 'Regulador', kind: 'enum' } },
    eval(pot, out) {
      const pIn = pot[0] ?? 0;
      const pRef = pot[2] ?? 0;
      const set = controlNumber(def.control['set'], setDefault);
      const noReturn = controlFlag(def.control['noReturn']);
      const x = pIn - pRef - set;
      const q = noReturn ? 0 : k * softRelu(x, smooth);
      const dq = noReturn ? 0 : k * softReluSlope(x, smooth);
      out.flow[0] = -q;
      out.flow[1] = q;
      out.flow[2] = 0;
      out.jac[0] = -dq;
      out.jac[1] = 0;
      out.jac[2] = dq;
      out.jac[3] = dq;
      out.jac[4] = 0;
      out.jac[5] = -dq;
      out.jac[6] = 0;
      out.jac[7] = 0;
      out.jac[8] = 0;
    },
    commit: noCommit,
  };
  return def;
}

// ─── Inyector (orificio con fuga) ─────────────────────────────────────────

/**
 * `q = abierto ? k·√(Δp⁺) : leakCoeff·s·√(Δp⁺)` (§8.2).
 * Params: `k` (L/h por √bar) y `leakCoeff`; `control.open` abre el inyector y
 * `control.leak` es la severidad del goteo.
 */
export function createOrifice(
  params: Readonly<Record<string, number>>,
  fluid: Fluid,
): ElementDef {
  const k = controlNumber(params['k'], 1);
  const leakCoeff = controlNumber(params['leakCoeff'], 0);
  const def: ElementDef = {
    ports: hydraulic2('in', 'out', fluid),
    params: { k, leakCoeff },
    control: { open: false, leak: 0 },
    state: {},
    faults: { leak: { label: 'Goteo', kind: 'severity' } },
    eval(pot, out) {
      const dp = (pot[0] ?? 0) - (pot[1] ?? 0);
      const factor = controlFlag(def.control['open'])
        ? k
        : leakCoeff * clamp(controlNumber(def.control['leak']), 0, 1);
      const q = factor * smoothSqrt(dp);
      const dq = factor * smoothSqrtSlope(dp);
      out.flow[0] = -q;
      out.flow[1] = q;
      out.jac[0] = -dq;
      out.jac[1] = dq;
      out.jac[2] = dq;
      out.jac[3] = -dq;
    },
    commit: noCommit,
  };
  return def;
}

// ─── Estanque (nodo fijo + nivel) y fuente de presión ─────────────────────

/**
 * Los dos puertos van al nodo fijo del estanque (0 bar, §8.1): el compilador
 * los une (`joint`), así la reacción es el neto aspirado menos el retorno.
 * Params: `capacity` (L) y `pickupLow` (L); `control.fast` multiplica ×100 el
 * consumo (`fastConsumption`).
 */
export function createTank(
  params: Readonly<Record<string, number>>,
  fluid: Fluid,
): ElementDef {
  const capacity = controlNumber(params['capacity'], 50);
  const pickupLow = controlNumber(params['pickupLow'], 1);
  const state: Record<string, number> = { level: 40 };
  const def: ElementDef = {
    ports: hydraulic2('out', 'ret', fluid),
    params: { capacity, pickupLow },
    control: { fast: false },
    state,
    init(overrides) {
      const level = overrides['tankLevel'];
      state['level'] =
        typeof level === 'number' && Number.isFinite(level) ? clamp(level, 0, capacity) : 40;
    },
    fixed(out) {
      out[0] = 0;
      out[1] = 0;
    },
    eval: noEval,
    commit(_pot, dt, reaction) {
      const net = reaction[0] ?? 0;
      const factor = controlFlag(def.control['fast']) ? 100 : 1;
      state['level'] = clamp((state['level'] ?? 0) - (net / 3600) * dt * factor, 0, capacity);
    },
    probes: {
      level: () => state['level'] ?? 0,
      pickupAir: () => 1 - clamp((state['level'] ?? 0) / pickupLow, 0, 1),
    },
  };
  return def;
}

/** Nodo fijo (Dirichlet) con potencial `control.p` (el múltiple, §8.2). */
export function createPressureSource(
  _params: Readonly<Record<string, number>>,
  fluid: Fluid,
): ElementDef {
  const def: ElementDef = {
    ports: [{ id: 'a', domain: 'hydraulic', fluid }],
    params: {},
    control: { p: 0 },
    state: {},
    fixed(out) {
      out[0] = controlNumber(def.control['p']);
    },
    eval: noEval,
    commit: noCommit,
  };
  return def;
}
