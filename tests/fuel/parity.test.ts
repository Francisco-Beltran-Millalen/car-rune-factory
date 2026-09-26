// A6: paridad entre el modelo de referencia y el compilado sobre la tabla de
// fuel.md §9b (pRail ≤ 0,05 bar y caudales ≤ 3 % en régimen), catálogo §26 y
// `solver.failures === 0`.
import { describe, expect, it } from 'vitest';
import { compileFuelCircuit } from '../../src/modules/fuel/circuit.ts';
import { FUEL_FAULTS } from '../../src/modules/fuel/faults.ts';
import {
  createFuelModel,
  type FuelOverrides,
  type FuelState,
} from '../../src/modules/fuel/reference-model.ts';

const DT = 0.001;

/** Lo mínimo que comparten la referencia y el compilado para manejarlos. */
interface DriveModel {
  params: Record<string, string | number | boolean>;
  readonly state: Readonly<FuelState>;
  step(dt: number): void;
}

function run(m: DriveModel, seconds: number): void {
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps; i++) m.step(DT);
}

function avg(m: DriveModel, seconds: number, get: (s: Readonly<FuelState>) => number): number {
  const steps = Math.round(seconds / DT);
  let sum = 0;
  for (let i = 0; i < steps; i++) {
    m.step(DT);
    sum += get(m.state);
  }
  return sum / steps;
}

function startEngine(m: DriveModel): void {
  m.params['ignitionKey'] = 'on';
  run(m, 2.5);
  m.params['ignitionKey'] = 'start';
  run(m, 1.5);
  m.params['ignitionKey'] = 'run';
  run(m, 2);
}

interface Scenario {
  name: string;
  overrides?: FuelOverrides;
  setup?: (m: DriveModel) => void;
}

const FULL = (m: DriveModel): void => {
  m.params['throttle'] = 1;
  m.params['rpm'] = 6000;
};

/** Los escenarios de la tabla de fuel.md §9b, medidos en régimen (1 s). */
const SCENARIOS: readonly Scenario[] = [
  { name: 'ralentí sano' },
  { name: 'a fondo 6000', setup: FULL },
  { name: 'filtro 1.0 en ralentí', overrides: { faults: { filterClog: 1 } } },
  { name: 'filtro 1.0 a fondo', overrides: { faults: { filterClog: 1 } }, setup: FULL },
  { name: 'filtro 0.8 a fondo', overrides: { faults: { filterClog: 0.8 } }, setup: FULL },
  { name: 'manguera de vacío suelta', overrides: { faults: { vacuumHoseOff: true } } },
  { name: 'regulador pegado cerrado', overrides: { faults: { regulator: 'stuckClosed' } } },
  { name: 'regulador pegado abierto', overrides: { faults: { regulator: 'stuckOpen' } } },
  {
    name: 'bomba gastada + 11 V a fondo',
    overrides: { params: { batteryV: 11 }, faults: { pumpWear: 1 } },
    setup: FULL,
  },
  { name: 'bomba 0.8 a fondo', overrides: { faults: { pumpWear: 0.8 } }, setup: FULL },
  { name: 'colador 1.0 a fondo', overrides: { faults: { strainerClog: 1 } }, setup: FULL },
  { name: 'colador 0.8 a fondo', overrides: { faults: { strainerClog: 0.8 } }, setup: FULL },
  { name: 'colador 1.0 en ralentí', overrides: { faults: { strainerClog: 1 } } },
];

interface Measures {
  pRail: number;
  qPump: number;
  qInj: number;
  qReturn: number;
}

function measure(m: DriveModel): Measures {
  return {
    pRail: avg(m, 1, (s) => s.pRail),
    qPump: avg(m, 1, (s) => s.qPump),
    qInj: avg(m, 1, (s) => s.qInjAvg),
    qReturn: avg(m, 1, (s) => s.qReturn),
  };
}

describe('fuel compilado — paridad con la referencia (§8.2 de P23)', () => {
  for (const scenario of SCENARIOS) {
    it(`paridad: ${scenario.name}`, () => {
      const reference = createFuelModel(scenario.overrides);
      startEngine(reference);
      scenario.setup?.(reference);
      run(reference, 3);
      const ref = measure(reference);

      const circuit = compileFuelCircuit(scenario.overrides);
      const compiled = circuit.model;
      startEngine(compiled);
      scenario.setup?.(compiled);
      run(compiled, 3);
      const got = measure(compiled);

      expect(circuit.solver.stats.failures, 'failures del solver').toBe(0);
      expect(Math.abs(got.pRail - ref.pRail), 'pRail (bar)').toBeLessThanOrEqual(0.05);
      for (const key of ['qPump', 'qInj', 'qReturn'] as const) {
        const tolerance = 0.01 + 0.03 * Math.abs(ref[key]);
        expect(Math.abs(got[key] - ref[key]), `${key} (L/h)`).toBeLessThanOrEqual(tolerance);
      }
    });
  }

  it('el catálogo de fallas tiene los ids §26 de P23 §4.6', () => {
    const triples = FUEL_FAULTS.map((fault) => [fault.id, fault.modelKey, fault.part]);
    expect(triples).toEqual([
      ['filter.clog', 'filterClog', 'filter'],
      ['strainer.clog', 'strainerClog', 'strainer'],
      ['pump.wear', 'pumpWear', 'pump'],
      ['relay.state', 'relay', 'relay'],
      ['regulator.state', 'regulator', 'regulator'],
      ['vacuumHose.off', 'vacuumHoseOff', 'vacuumHose'],
      ['injector2.leak', 'injectorLeak', 'injector2'],
      ['feedLine.leak', 'lineLeak', 'feedLine'],
    ]);
    // Cada pieza del catálogo existe en el circuito compilado.
    const circuit = compileFuelCircuit();
    for (const fault of FUEL_FAULTS) {
      expect(circuit.elements[fault.part], fault.part).toBeDefined();
    }
  });
});
