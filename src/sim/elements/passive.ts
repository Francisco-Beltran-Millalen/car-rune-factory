// Elementos pasivos de red (P23 §8.2). Puro (§1).
// Leyes y params en docs/modules/solver.md §7.

import { clamp } from '../../core/math.ts';
import type { ElementDef, Fluid, PortDef } from '../solver/types.ts';
import { EPS_P, controlNumber, noCommit, noEval, smoothSqrt, smoothSqrtSlope } from './common.ts';

function hydraulic2(idA: string, idB: string, fluid: Fluid): PortDef[] {
  return [
    { id: idA, domain: 'hydraulic', fluid },
    { id: idB, domain: 'hydraulic', fluid },
  ];
}

/**
 * `q = Δp/√(k(|Δp|+ε))`. Params: `k` (bar/(L/h)²) y `clogFactor`
 * (la falla `clog` multiplica k por `1 + clogFactor·s`).
 */
export function createRestrictor(
  params: Readonly<Record<string, number>>,
  fluid: Fluid,
): ElementDef {
  const k = controlNumber(params['k'], 1);
  const clogFactor = controlNumber(params['clogFactor'], 0);
  const def: ElementDef = {
    ports: hydraulic2('a', 'b', fluid),
    params: { k, clogFactor },
    control: { clog: 0 },
    state: {},
    faults: { clog: { label: 'Obstrucción', kind: 'severity' } },
    eval(pot, out) {
      const dp = (pot[0] ?? 0) - (pot[1] ?? 0);
      const clog = clamp(controlNumber(def.control['clog']), 0, 1);
      const kEff = k * (1 + clogFactor * clog);
      const s = Math.abs(dp) + EPS_P;
      const q = dp / Math.sqrt(kEff * s);
      const dq = (Math.abs(dp) / 2 + EPS_P) / (Math.sqrt(kEff) * Math.pow(s, 1.5));
      out.flow[0] = -q;
      out.flow[1] = q;
      out.jac[0] = -dq;
      out.jac[1] = dq;
      out.jac[2] = dq;
      out.jac[3] = -dq;
    },
    commit: noCommit,
    probes: {
      q: (pot) => {
        const dp = (pot[0] ?? 0) - (pot[1] ?? 0);
        const clog = clamp(controlNumber(def.control['clog']), 0, 1);
        const kEff = k * (1 + clogFactor * clog);
        return dp / Math.sqrt(kEff * (Math.abs(dp) + EPS_P));
      },
    },
  };
  return def;
}

/**
 * Orificio variable (A13, spec cooling §5.1): conductancia
 * `g = gOpen·open + gLeak`; usa la ley del restrictor con `k_ef = 1/g²`
 * (antisimétrica y suave en 0). Params: `gOpen`, `gLeak` (L/h/√bar);
 * `control.open` va de 0 (cerrado, sólo la fuga) a 1 (abierto).
 */
export function createVariableOrifice(
  params: Readonly<Record<string, number>>,
  fluid: Fluid,
): ElementDef {
  const gOpen = controlNumber(params['gOpen'], 1);
  const gLeak = controlNumber(params['gLeak'], 0);
  const def: ElementDef = {
    ports: hydraulic2('a', 'b', fluid),
    params: { gOpen, gLeak },
    control: { open: 0 },
    state: {},
    eval(pot, out) {
      const open = clamp(controlNumber(def.control['open']), 0, 1);
      const g = gOpen * open + gLeak;
      if (g <= 1e-9) {
        out.flow[0] = 0;
        out.flow[1] = 0;
        out.jac.fill(0);
        return;
      }
      const k = 1 / (g * g);
      const dp = (pot[0] ?? 0) - (pot[1] ?? 0);
      const s = Math.abs(dp) + EPS_P;
      const q = dp / Math.sqrt(k * s);
      const dq = (Math.abs(dp) / 2 + EPS_P) / (Math.sqrt(k) * Math.pow(s, 1.5));
      out.flow[0] = -q;
      out.flow[1] = q;
      out.jac[0] = -dq;
      out.jac[1] = dq;
      out.jac[2] = dq;
      out.jac[3] = -dq;
    },
    commit: noCommit,
    probes: {
      q: (pot) => {
        const open = clamp(controlNumber(def.control['open']), 0, 1);
        const g = gOpen * open + gLeak;
        if (g <= 1e-9) return 0;
        const dp = (pot[0] ?? 0) - (pot[1] ?? 0);
        return dp / Math.sqrt((Math.abs(dp) + EPS_P) / (g * g));
      },
    },
  };
  return def;
}

/** Nudo hidráulico de 6 puertos (A13): todos al mismo nodo (`joint`,`multiple`). */
export function createHydroNode(
  _params: Readonly<Record<string, number>>,
  fluid: Fluid,
): ElementDef {
  return {
    ports: (['a', 'b', 'c', 'd', 'e', 'f'] as const).map((id) => ({
      id,
      domain: 'hydraulic' as const,
      fluid,
    })),
    params: {},
    control: {},
    state: {},
    eval: noEval,
    commit: noCommit,
  };
}

/**
 * Diodo suave: la conductancia pasa de `1e-6·g` a `g` en 0,02 bar.
 * Params: `g` (L/h/bar).
 */
export function createCheckValve(
  params: Readonly<Record<string, number>>,
  fluid: Fluid,
): ElementDef {
  const gOn = controlNumber(params['g'], 1);
  const gOff = 1e-6 * gOn;
  const TRANSITION = 0.02;
  const def: ElementDef = {
    ports: hydraulic2('in', 'out', fluid),
    params: { g: gOn },
    control: {},
    state: {},
    eval(pot, out) {
      const dp = (pot[0] ?? 0) - (pot[1] ?? 0);
      const t = clamp(dp / TRANSITION, 0, 1);
      const w = t * t * (3 - 2 * t);
      const g = gOff + (gOn - gOff) * w;
      const dg = t > 0 && t < 1 ? ((gOn - gOff) * 6 * t * (1 - t)) / TRANSITION : 0;
      const q = g * dp;
      const dq = g + dg * dp;
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

/**
 * Fuga a la atmósfera: `q = k·s·√(p⁺)`, la bencina se pierde (§8.1).
 * Params: `k` (L/h por √bar); `control.severity` es la falla.
 */
export function createLeak(
  params: Readonly<Record<string, number>>,
  fluid: Fluid,
): ElementDef {
  const k = controlNumber(params['k'], 1);
  const def: ElementDef = {
    ports: [{ id: 'a', domain: 'hydraulic', fluid }],
    params: { k },
    control: { severity: 0 },
    state: {},
    faults: { leak: { label: 'Fuga', kind: 'severity' } },
    eval(pot, out) {
      const p = pot[0] ?? 0;
      const severity = clamp(controlNumber(def.control['severity']), 0, 1);
      const q = k * severity * smoothSqrt(p);
      out.flow[0] = -q;
      out.jac[0] = -k * severity * smoothSqrtSlope(p);
    },
    commit: noCommit,
    probes: {
      q: (pot) => k * clamp(controlNumber(def.control['severity']), 0, 1) * smoothSqrt(pot[0] ?? 0),
    },
  };
  return def;
}

/** Sólo compliancia; params: `c` (L/bar). El solver la usa en flujo/(bar·s). */
export function createVolume(
  params: Readonly<Record<string, number>>,
  fluid: Fluid,
): ElementDef {
  const c = controlNumber(params['c'], 0);
  return {
    ports: [{ id: 'a', domain: 'hydraulic', fluid }],
    params: { c },
    control: {},
    state: {},
    capacitance: { a: c * 3600 },
    eval: noEval,
    commit: noCommit,
  };
}

/** Nudo hidráulico: sus tres puertos son el mismo nodo (lo une el compilador). */
export function createTee(
  _params: Readonly<Record<string, number>>,
  fluid: Fluid,
): ElementDef {
  return {
    ports: [
      { id: 'a', domain: 'hydraulic', fluid },
      { id: 'b', domain: 'hydraulic', fluid },
      { id: 'c', domain: 'hydraulic', fluid },
    ],
    params: {},
    control: {},
    state: {},
    eval: noEval,
    commit: noCommit,
  };
}
