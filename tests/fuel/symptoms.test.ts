// A6b: las tres fallas que no daban síntoma, fijadas en el escenario
// "contacto → arranque → ralentí → fondo". Valores calibrados en fuel.md §9d.
import { describe, expect, it } from 'vitest';
import { createCompiledFuelModel } from '../../src/modules/fuel/circuit.ts';
import {
  createFuelModel,
  type FuelModel,
  type FuelOverrides,
} from '../../src/modules/fuel/reference-model.ts';

const DT = 0.001;

function run(m: FuelModel, seconds: number): void {
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps; i++) m.step(DT);
}

function startEngine(m: FuelModel): void {
  m.params.ignitionKey = 'on';
  run(m, 2.5);
  m.params.ignitionKey = 'start';
  run(m, 1.5);
  m.params.ignitionKey = 'run';
  run(m, 2);
}

function avg(m: FuelModel, seconds: number, get: (s: FuelModel['state']) => number): number {
  const steps = Math.round(seconds / DT);
  let sum = 0;
  for (let i = 0; i < steps; i++) {
    m.step(DT);
    sum += get(m.state);
  }
  return sum / steps;
}

function fullThrottle(m: FuelModel): void {
  m.params.throttle = 1;
  m.params.rpm = 6000;
}

type FuelFactory = (overrides?: FuelOverrides) => FuelModel;

/** La calibración es compartida: la referencia y el compilado dan el mismo síntoma. */
const IMPLEMENTATIONS: [string, FuelFactory][] = [
  ['referencia', createFuelModel],
  ['compilado', createCompiledFuelModel],
];

describe.each(IMPLEMENTATIONS)('fuel síntomas de A6b (%s)', (_name, create) => {
  it('colador tapado 1,0: en ralentí anda; a fondo falta fuerza y falla la mezcla', () => {
    const m = create({ faults: { strainerClog: 1 }, seed: 7 });
    startEngine(m);
    run(m, 2);
    expect(m.state.engineState).toBe('running');
    expect(m.state.pRail).toBeGreaterThan(2.3);

    fullThrottle(m);
    run(m, 4);
    expect(avg(m, 1, (s) => s.pRail)).toBeLessThan(2.0);
    expect(m.state.mixtureRatio).toBeLessThan(0.8);
    expect(['misfire', 'stalled']).toContain(m.state.engineState);
  });

  it('relé intermitente: a fondo tironea y la presión cae en cada corte', () => {
    const m = create({ faults: { relay: 'intermittent' }, seed: 7 });
    startEngine(m);
    fullThrottle(m);
    let sawMisfire = false;
    let cuts = 0;
    let minRail = Infinity;
    let prevRelay = m.state.relayOn;
    for (let i = 0; i < 15_000; i++) {
      m.step(DT);
      if (m.state.engineState === 'misfire') sawMisfire = true;
      if (prevRelay && !m.state.relayOn) cuts++;
      prevRelay = m.state.relayOn;
      if (m.state.pRail < minRail) minRail = m.state.pRail;
    }
    expect(cuts).toBeGreaterThanOrEqual(2);
    expect(sawMisfire).toBe(true);
    expect(minRail).toBeLessThan(2.0);
  });

  it('bomba gastada al 80 %: en ralentí anda; a fondo ya no sostiene la presión', () => {
    const m = create({ faults: { pumpWear: 0.8 }, seed: 7 });
    startEngine(m);
    run(m, 2);
    expect(m.state.engineState).toBe('running');
    expect(m.state.pRail).toBeGreaterThan(2.3);

    fullThrottle(m);
    run(m, 4);
    expect(avg(m, 1, (s) => s.pRail)).toBeLessThan(2.0);
    expect(m.state.mixtureRatio).toBeLessThan(0.8);
    expect(['misfire', 'stalled']).toContain(m.state.engineState);
  });
});
