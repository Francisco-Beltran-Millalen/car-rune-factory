// Una falla que actúa en el laboratorio de su sistema también actúa en el
// vehículo (A15). La red de seguridad que faltó cuando el vehículo no aplicaba
// los `bindings` del combustible: filtro, colador, bomba y fugas no hacían nada.
import { describe, it, expect } from 'vitest';
import type { FaultSpec, ParamRecord, ParamValue } from '../../src/core/types.ts';
import { compileVehicle } from '../../src/modules/vehicle/compile.ts';
import { VEHICLE_2000, VEHICLE_70 } from '../../src/modules/vehicle/defs.ts';
import { SYSTEM_REGISTRY } from '../../src/modules/vehicle/registry.ts';
import type { VehicleDef } from '../../src/sim/vehicle/types.ts';

const STEPS = 1500;
// A carga, para que trabajen también los circuitos que en ralentí no
// entregan (el surtidor principal del carburador): en ralentí su efecto es
// de 1e-4 y depende de décimas de mL en la cuba.
const LOAD: ParamRecord = { rpm: 3000, throttle: 0.5 };
const TOLERANCE = 1e-6;

/** El valor más fuerte de una falla: severidad 1, toggle prendido, último enum. */
function worst(spec: FaultSpec): ParamValue | undefined {
  if (spec.kind === 'severity') return 1;
  if (spec.kind === 'toggle') return true;
  return spec.options?.[spec.options.length - 1]?.value;
}

interface Runnable {
  params: ParamRecord;
  faults: ParamRecord;
  state: object;
  step(dt: number): void;
}

/** Valores numéricos del estado tras arrancar, filtrados por prefijo. */
function run(model: Runnable, prefix: string, faults: ParamRecord): number[] {
  Object.assign(model.faults, faults);
  for (const [k, v] of Object.entries(LOAD)) if (k in model.params) model.params[k] = v;
  if ('ignitionKey' in model.params) model.params['ignitionKey'] = 'run';
  for (let i = 0; i < STEPS; i++) model.step(0.001);
  return Object.entries(model.state)
    .filter(([k, v]) => k.startsWith(prefix) && typeof v === 'number')
    .map(([, v]) => v as number);
}

const differs = (a: readonly number[], b: readonly number[]): boolean =>
  a.length !== b.length || a.some((v, i) => Math.abs(v - (b[i] ?? 0)) > TOLERANCE * (1 + Math.abs(v)));

function check(def: VehicleDef): void {
  const baseVehicle = new Map<string, number[]>();
  for (const sys of def.systems) {
    if (sys.kind !== 'circuit' || !sys.circuit) continue;
    const wiring = SYSTEM_REGISTRY[sys.circuit];
    if (!wiring) continue;
    const desc = wiring.moduleDescriptor;
    const prefix = `${sys.id}:`;
    if (!baseVehicle.has(sys.id)) baseVehicle.set(sys.id, run(compileVehicle(def).model, prefix, {}));
    const baseLab = run(desc.createModel(), '', {});
    for (const spec of desc.faults) {
      const value = worst(spec);
      if (value === undefined) continue;
      const lab = run(desc.createModel(), '', { [spec.key]: value });
      if (!differs(baseLab, lab)) continue; // en su laboratorio tampoco se nota en 1,5 s
      const vehicle = run(compileVehicle(def).model, prefix, { [`${prefix}${spec.key}`]: value });
      expect(differs(baseVehicle.get(sys.id) ?? [], vehicle), `${def.id} ${prefix}${spec.key}`).toBe(true);
    }
  }
}

describe('las fallas actúan igual en el vehículo que en su laboratorio', () => {
  it('vehicle-70', () => {
    check(VEHICLE_70);
  });
  it('vehicle-2000', () => {
    check(VEHICLE_2000);
  });
});
