// Criterios 9, 10 y 11 de la spec four-stroke §11: juego del chavetero, perno
// flojo → chaveta cortada, y tensor hidráulico sin presión de aceite.
import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/core/rng.ts';
import { K } from '../../src/modules/four-stroke/constants.ts';
import {
  createTimingState,
  stepTiming,
  type TimingFaults,
  type TimingInputs,
  type TimingState,
} from '../../src/modules/four-stroke/timing.ts';

const FAULTS: TimingFaults = {
  crankBoltLoose: false,
  keywayWorn: 0,
  keySheared: false,
  tensionerWeak: 0,
  guideBroken: false,
  chainStretch: 0,
  skippedTeeth: 0,
  beltWear: 0,
};

const base = (overrides: Partial<TimingInputs> = {}): TimingInputs => ({
  dt: 0.001,
  crankDeg: 0,
  rpm: 3000,
  load: 1,
  oilPressure: 3,
  hydraulic: true,
  drive: 'chain',
  faults: { ...FAULTS },
  rng: createRng(1),
  prevRpm: 3000,
  ...overrides,
});

/** Corre `seconds` y devuelve el estado y el promedio de `camOffset`. */
function run(
  seconds: number,
  overrides: Partial<TimingInputs> = {},
  state: TimingState = createTimingState(),
): { state: TimingState; avgOffset: number } {
  const input = base(overrides);
  let s = state;
  let sum = 0;
  let n = 0;
  const steps = Math.round(seconds / input.dt);
  for (let i = 0; i < steps; i++) {
    input.crankDeg = ((i * (input.rpm / 60) * 360 * input.dt) % 720 + 720) % 720;
    s = stepTiming(s, input);
    sum += s.camOffset;
    n++;
  }
  return { state: s, avgOffset: n > 0 ? sum / n : 0 };
}

describe('distribución (spec §11.9 a §11.11)', () => {
  it('chavetero ovalado: promedio de camOffset con carga y sin carga', () => {
    const conCarga = run(12, { faults: { ...FAULTS, keywayWorn: 1 }, load: 1 });
    expect(conCarga.avgOffset).toBeGreaterThan(6);
    expect(conCarga.avgOffset).toBeLessThan(9);
    const sinCarga = run(12, { faults: { ...FAULTS, keywayWorn: 1 }, load: 0 });
    expect(sinCarga.avgOffset).toBeGreaterThan(1.5);
    expect(sinCarga.avgOffset).toBeLessThan(3.5);
  });

  it('perno flojo: la chaveta se corta y la leva se queda atrás', () => {
    const faults = { ...FAULTS, crankBoltLoose: true };
    let s = createTimingState();
    let shearedAt = -1;
    const input = base({ faults });
    for (let i = 0; i < 60_000 && shearedAt < 0; i++) {
      s = stepTiming(s, input);
      if (s.keyShearedState) shearedAt = i * input.dt;
    }
    expect(shearedAt).toBeGreaterThan(0);
    expect(shearedAt).toBeLessThan(60);
    const before = s.camOffset;
    for (let i = 0; i < 5000; i++) s = stepTiming(s, input);
    expect(s.camOffset).toBeGreaterThan(before + 50);
  });

  it('perno flojo con el motor detenido no daña', () => {
    const s = run(5, { faults: { ...FAULTS, crankBoltLoose: true }, rpm: 0, prevRpm: 0 });
    expect(s.state.keywayDamage).toBe(0);
  });

  it('tensor hidráulico: sin presión de aceite hay holgura y ruido', () => {
    const flojo = run(1, { oilPressure: 0.2 });
    expect(flojo.state.slack).toBeGreaterThanOrEqual(0.45);
    expect(flojo.state.slack).toBeCloseTo(K.hydraulicSlack * 0.8, 6);
    expect(flojo.state.rattle).toBeGreaterThan(0);
    const tenso = run(1, { oilPressure: 3 });
    expect(tenso.state.slack).toBe(0);
    expect(tenso.state.rattle).toBe(0);
  });

  it('un diente saltado atrasa la leva 17,14°', () => {
    const s = run(1, { faults: { ...FAULTS, skippedTeeth: 1 } });
    expect(s.state.camOffset).toBeCloseTo(K.toothDeg, 6);
  });
});
