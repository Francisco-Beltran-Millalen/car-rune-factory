// Elementos del dominio térmico (A13, spec cooling §5.2): potencial en °C,
// flujo en W, capacidad en J/K. Puro (§1).

import { clamp } from '../../core/math.ts';
import type { ElementDef, PortDef } from '../solver/types.ts';
import { controlNumber, noCommit, noEval } from './common.ts';

function thermal2(idA: string, idB: string): PortDef[] {
  return [
    { id: idA, domain: 'thermal' },
    { id: idB, domain: 'thermal' },
  ];
}

/** Fuente de temperatura: fija su nodo en `control.t` (°C, Dirichlet). */
export function createTemperatureSource(params: Readonly<Record<string, number>>): ElementDef {
  const def: ElementDef = {
    ports: [{ id: 'a', domain: 'thermal' }],
    params: {},
    control: { t: controlNumber(params['t'], 25) },
    state: {},
    fixed(out) {
      out[0] = controlNumber(def.control['t'], 25);
    },
    eval(_pot, out) {
      out.flow[0] = 0;
      out.jac[0] = 0;
    },
    commit: noCommit,
  };
  return def;
}

/** Nudo térmico de 6 puertos (A13): todos al mismo nodo (`joint`,`multiple`). */
export function createThermalNode(): ElementDef {
  return {
    ports: (['a', 'b', 'c', 'd', 'e', 'f'] as const).map((id) => ({
      id,
      domain: 'thermal' as const,
    })),
    params: {},
    control: {},
    state: {},
    eval: noEval,
    commit: noCommit,
  };
}

/** Fuente de calor: inyecta `control.q` W en su nodo (positivo = calienta). */
export function createHeatSource(params: Readonly<Record<string, number>>): ElementDef {
  const def: ElementDef = {
    ports: [{ id: 'a', domain: 'thermal' }],
    params: {},
    control: { q: controlNumber(params['q']) },
    state: {},
    eval(_pot, out) {
      out.flow[0] = controlNumber(def.control['q']);
      out.jac[0] = 0;
    },
    commit: noCommit,
    probes: { q: () => controlNumber(def.control['q']) },
  };
  return def;
}

/** Conductancia térmica: `q = control.g·(Ta − Tb)` W. Params: `g` (W/K). */
export function createThermalConductance(params: Readonly<Record<string, number>>): ElementDef {
  const g = controlNumber(params['g'], 0);
  const def: ElementDef = {
    ports: thermal2('a', 'b'),
    params: { g },
    control: { g },
    state: {},
    eval(pot, out) {
      const gain = controlNumber(def.control['g'], g);
      const q = gain * ((pot[0] ?? 0) - (pot[1] ?? 0));
      out.flow[0] = -q;
      out.flow[1] = q;
      out.jac[0] = -gain;
      out.jac[1] = gain;
      out.jac[2] = gain;
      out.jac[3] = -gain;
    },
    commit: noCommit,
    probes: { q: (pot) => controlNumber(def.control['g'], g) * ((pot[0] ?? 0) - (pot[1] ?? 0)) },
  };
  return def;
}

/**
 * Advección (*upwind*): el fluido entra por `a` y sale por `b`; inyecta en
 * `b` `control.mc·(Ta − Tb)` W y nada en `a` (spec cooling §5.2).
 * `mc` en W/K = caudal de calor del fluido.
 */
export function createAdvection(params: Readonly<Record<string, number>>): ElementDef {
  const mc = controlNumber(params['mc'], 0);
  const def: ElementDef = {
    ports: thermal2('a', 'b'),
    params: { mc },
    control: { mc },
    state: {},
    eval(pot, out) {
      const gain = clamp(controlNumber(def.control['mc'], mc), 0, 100000);
      out.flow[0] = 0;
      out.flow[1] = gain * ((pot[0] ?? 0) - (pot[1] ?? 0));
      out.jac[0] = 0;
      out.jac[1] = 0;
      out.jac[2] = gain;
      out.jac[3] = -gain;
    },
    commit: noCommit,
    probes: {
      q: (pot) => clamp(controlNumber(def.control['mc'], mc), 0, 100000) * ((pot[0] ?? 0) - (pot[1] ?? 0)),
    },
  };
  return def;
}

/** Capacidad térmica: `capacitance = c` (J/K, sin el ×3600 hidráulico). */
export function createHeatCapacity(params: Readonly<Record<string, number>>): ElementDef {
  const c = controlNumber(params['c'], 0);
  return {
    ports: [{ id: 'a', domain: 'thermal' }],
    params: { c },
    control: {},
    state: {},
    capacitance: { a: c },
    eval: noEval,
    commit: noCommit,
  };
}
