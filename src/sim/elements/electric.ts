// Elementos eléctricos de la biblioteca (P23 §8.2). Puro (§1).

import { clamp } from '../../core/math.ts';
import type { ElementDef } from '../solver/types.ts';
import { controlFlag, controlNumber, noCommit, noEval } from './common.ts';

/** Rampa de la carga de corriente: `clamp(ΔV/1 V, 0, 1)` con `smoothstep`
 *  (C¹ en todo el rango, así Newton no ve escalones; plan de A12 §3.2). */
function loadFactor(dv: number): number {
  if (dv <= 0) return 0;
  if (dv >= 1) return 1;
  return dv * dv * (3 - 2 * dv);
}

function loadSlope(dv: number): number {
  if (dv <= 0 || dv >= 1) return 0;
  return 6 * dv * (1 - dv);
}

/**
 * Carga de corriente promedio (A12, spec ignition §5.6): `I = control.i·ramp`.
 * La usa el encendido para que el solver vea el primario como su consumo
 * medio; sin tensión se apaga suave. Params: `i` (por defecto del control).
 */
export function createCurrentLoad(params: Readonly<Record<string, number>>): ElementDef {
  const def: ElementDef = {
    ports: [
      { id: 'a', domain: 'electric' },
      { id: 'b', domain: 'electric' },
    ],
    params: { i: controlNumber(params['i']) },
    control: { i: controlNumber(params['i']) },
    state: {},
    eval(pot, out) {
      const dv = (pot[0] ?? 0) - (pot[1] ?? 0);
      const i = controlNumber(def.control['i']);
      const q = i * loadFactor(dv);
      const dq = i * loadSlope(dv);
      out.flow[0] = -q;
      out.flow[1] = q;
      out.jac[0] = -dq;
      out.jac[1] = dq;
      out.jac[2] = dq;
      out.jac[3] = -dq;
    },
    commit: noCommit,
    probes: {
      i: (pot) => controlNumber(def.control['i']) * loadFactor((pot[0] ?? 0) - (pot[1] ?? 0)),
    },
  };
  return def;
}

/** Nudo eléctrico: sus puertos son el mismo nodo (lo une el compilador).
 *  El `coilBus` del COP y los empalmes de la baja tensión lo usan (A12). */
export function createJunction(): ElementDef {
  return {
    ports: [
      { id: 'a', domain: 'electric' },
      { id: 'b', domain: 'electric' },
      { id: 'c', domain: 'electric' },
      { id: 'd', domain: 'electric' },
      { id: 'e', domain: 'electric' },
      { id: 'f', domain: 'electric' },
    ],
    params: {},
    control: {},
    state: {},
    eval: noEval,
    commit: noCommit,
  };
}

/** `V = control.v − R·I` (§8.2). Params: `r` (Ω); `control.v` es la tensión. */
export function createBattery(params: Readonly<Record<string, number>>): ElementDef {
  const r = controlNumber(params['r'], 0.02);
  const def: ElementDef = {
    ports: [
      { id: '+', domain: 'electric' },
      { id: '-', domain: 'electric' },
    ],
    params: { r },
    control: { v: 0 },
    state: {},
    eval(pot, out) {
      const vOpen = controlNumber(def.control['v']);
      const dv = (pot[0] ?? 0) - (pot[1] ?? 0);
      const g = 1 / r;
      const i = (vOpen - dv) * g;
      out.flow[0] = i;
      out.flow[1] = -i;
      out.jac[0] = -g;
      out.jac[1] = g;
      out.jac[2] = g;
      out.jac[3] = -g;
    },
    commit: noCommit,
    probes: {
      i: (pot) => (controlNumber(def.control['v']) - (pot[0] ?? 0) + (pot[1] ?? 0)) / r,
    },
  };
  return def;
}

/**
 * Llave / relé: `R_on` o `R_off` según `control.closed`. Params: `rOn`, `rOff`.
 * `rampMs` (plan del vehículo §8, default 0 = como antes, instantáneo): con
 * `rampMs > 0` la conductancia va de `gOff` a `gOn` en `rampMs` (lineal en
 * logaritmo, `g = gOff·(gOn/gOff)^p`) y vuelve igual al abrir; lo necesita un
 * bus compartido para no partir la tensión de todo el bus en un paso (relé de
 * la bomba, solenoide de arranque). `p` (progreso 0..1) es estado interno:
 * se lee en `eval` y se avanza en `commit`, después de converger (§24).
 */
export function createSwitch(params: Readonly<Record<string, number>>): ElementDef {
  const rOn = controlNumber(params['rOn'], 0.01);
  const rOff = controlNumber(params['rOff'], 1e7);
  const rampMs = controlNumber(params['rampMs'], 0);
  const gOn = 1 / rOn;
  const gOff = 1 / rOff;
  const state: Record<string, number> = { p: 0 };
  function conductance(): number {
    if (rampMs <= 0) return controlFlag(def.control['closed']) ? gOn : gOff;
    const p = clamp(state['p'] ?? 0, 0, 1);
    return gOff * Math.pow(gOn / gOff, p);
  }
  const def: ElementDef = {
    ports: [
      { id: 'a', domain: 'electric' },
      { id: 'b', domain: 'electric' },
    ],
    params: { rOn, rOff, rampMs },
    control: { closed: false },
    state,
    eval(pot, out) {
      const g = conductance();
      const q = g * ((pot[0] ?? 0) - (pot[1] ?? 0));
      out.flow[0] = -q;
      out.flow[1] = q;
      out.jac[0] = -g;
      out.jac[1] = g;
      out.jac[2] = g;
      out.jac[3] = -g;
    },
    commit(_pot, dt): void {
      if (rampMs <= 0) {
        state['p'] = controlFlag(def.control['closed']) ? 1 : 0;
        return;
      }
      const target = controlFlag(def.control['closed']) ? 1 : 0;
      const step = (dt * 1000) / rampMs;
      const p = state['p'] ?? 0;
      state['p'] = target > p ? Math.min(1, p + step) : target < p ? Math.max(0, p - step) : p;
    },
    probes: {
      g: () => conductance(),
    },
  };
  return def;
}

/** Resistencia lineal (el juguete eléctrico de A5; no está en la tabla §8.2). */
export function createResistor(params: Readonly<Record<string, number>>): ElementDef {
  const r = controlNumber(params['r'], 1);
  const g = 1 / r;
  return {
    ports: [
      { id: 'a', domain: 'electric' },
      { id: 'b', domain: 'electric' },
    ],
    params: { r },
    control: {},
    state: {},
    eval(pot, out) {
      const q = g * ((pot[0] ?? 0) - (pot[1] ?? 0));
      out.flow[0] = -q;
      out.flow[1] = q;
      out.jac[0] = -g;
      out.jac[1] = g;
      out.jac[2] = g;
      out.jac[3] = -g;
    },
    commit: noCommit,
    probes: {
      q: (pot) => g * ((pot[0] ?? 0) - (pot[1] ?? 0)),
    },
  };
}
