// Elementos eléctricos de la biblioteca (P23 §8.2). Puro (§1).

import type { ElementDef } from '../solver/types.ts';
import { controlFlag, controlNumber, noCommit } from './common.ts';

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

/** Llave / relé: `R_on` o `R_off` según `control.closed`. Params: `rOn`, `rOff`. */
export function createSwitch(params: Readonly<Record<string, number>>): ElementDef {
  const rOn = controlNumber(params['rOn'], 0.01);
  const rOff = controlNumber(params['rOff'], 1e7);
  const def: ElementDef = {
    ports: [
      { id: 'a', domain: 'electric' },
      { id: 'b', domain: 'electric' },
    ],
    params: { rOn, rOff },
    control: { closed: false },
    state: {},
    eval(pot, out) {
      const g = controlFlag(def.control['closed']) ? 1 / rOn : 1 / rOff;
      const q = g * ((pot[0] ?? 0) - (pot[1] ?? 0));
      out.flow[0] = -q;
      out.flow[1] = q;
      out.jac[0] = -g;
      out.jac[1] = g;
      out.jac[2] = g;
      out.jac[3] = -g;
    },
    commit: noCommit,
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
