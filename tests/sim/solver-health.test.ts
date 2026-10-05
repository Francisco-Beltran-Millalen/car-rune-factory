// `compileCircuit` no frena si un paso no converge (el estado queda congelado
// y sólo sube `solver.stats.failures`). Este test fija que ningún laboratorio
// llega ahí, con controles y fallas al azar dentro de sus rangos (§6).
import { describe, it, expect } from 'vitest';
import { createRng } from '../../src/core/rng.ts';
import type { ModuleDescriptor, ParamRecord } from '../../src/core/types.ts';
import type { Solver } from '../../src/sim/solver/types.ts';
import { compileCarburetorCircuit } from '../../src/modules/carburetor/circuit.ts';
import { compileCoolingCircuit } from '../../src/modules/cooling/circuit.ts';
import { compileFourStrokeCircuit } from '../../src/modules/four-stroke/circuit.ts';
import { compileFuelCircuit } from '../../src/modules/fuel/circuit.ts';
import { compileIgnitionCircuit } from '../../src/modules/ignition/circuit.ts';
import { compileLubricationCircuit } from '../../src/modules/lubrication/circuit.ts';
import { compileVehicle } from '../../src/modules/vehicle/compile.ts';
import { VEHICLE_2000, VEHICLE_70 } from '../../src/modules/vehicle/defs.ts';
import { modules } from '../../src/modules/registry.ts';

interface Compiled {
  model: { params: ParamRecord; faults: ParamRecord; step(dt: number): void };
  readonly solver: Solver;
}

const COMPILERS: Readonly<Record<string, () => Compiled>> = {
  fuel: () => compileFuelCircuit(),
  'four-stroke-ohv': () => compileFourStrokeCircuit('ohv'),
  'four-stroke-dohc': () => compileFourStrokeCircuit('dohc'),
  'ignition-points': () => compileIgnitionCircuit('points'),
  'ignition-cop': () => compileIgnitionCircuit('cop'),
  'cooling-viscous': () => compileCoolingCircuit('viscous'),
  'cooling-electric': () => compileCoolingCircuit('electric'),
  'lubrication-gauge': () => compileLubricationCircuit('gauge'),
  'lubrication-lamp': () => compileLubricationCircuit('lamp'),
  carburetor: () => compileCarburetorCircuit(),
  'vehicle-70': () => compileVehicle(VEHICLE_70),
  'vehicle-2000': () => compileVehicle(VEHICLE_2000),
};

function randomize(desc: ModuleDescriptor, c: Compiled, seed: number): void {
  const rng = createRng(seed);
  for (const s of desc.controls) {
    if (!s.key) continue;
    if (s.type === 'slider') c.model.params[s.key] = (s.min ?? 0) + rng.next() * ((s.max ?? 1) - (s.min ?? 0));
    else if (s.type === 'toggle') c.model.params[s.key] = rng.chance(0.5);
    else if (s.type === 'select' && s.options?.length) c.model.params[s.key] = rng.pick(s.options).value;
  }
  for (const f of desc.faults) {
    if (f.kind === 'severity') c.model.faults[f.key] = rng.next();
    else if (f.kind === 'toggle') c.model.faults[f.key] = rng.chance(0.5);
    else if (f.options?.length) c.model.faults[f.key] = rng.pick(f.options).value;
  }
}

describe('el solver converge en todos los laboratorios', () => {
  it('hay un compilador para cada módulo del registro', () => {
    const ids = modules.filter((m) => m.circuit).map((m) => m.id);
    expect(Object.keys(COMPILERS).sort()).toEqual([...ids].sort());
  });

  for (const desc of modules) {
    const compile = COMPILERS[desc.id];
    if (!compile) continue;
    it(desc.id, () => {
      for (let k = 0; k < 6; k++) {
        const c = compile();
        randomize(desc, c, 1000 + k);
        for (let i = 0; i < 1500; i++) c.model.step(0.001);
        if ('ignitionKey' in c.model.params) c.model.params['ignitionKey'] = 'off';
        for (let i = 0; i < 300; i++) c.model.step(0.001);
        expect(c.solver.stats.failures, `caso ${k}`).toBe(0);
      }
    });
  }
});
