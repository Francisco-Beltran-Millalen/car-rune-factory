// Modelo completo del carburador sobre el solver (A16, spec carburetor §11:
// tests 2, 11 y 12; el 1 vive en tests/sim/elements.test.ts).
import { describe, expect, it } from 'vitest';
import { compileCarburetorCircuit, createCarburetorHarness, createCarburetorModel, type CarburetorModel } from '../../src/modules/carburetor/circuit.ts';

function run(m: CarburetorModel, seconds: number): void {
  const n = Math.round(seconds / 0.001);
  for (let i = 0; i < n; i++) m.step(0.001);
}

describe('carburador sano — grilla rpm × mariposa en régimen (test §11.2)', () => {
  const rpms = [800, 1500, 3000, 6000];
  const throttles = [0, 0.3, 1];

  for (const rpm of rpms) {
    for (const throttle of throttles) {
      it(`rpm=${rpm} throttle=${throttle}: mezcla en [0,97; 1,03]`, () => {
        const { model, bus } = createCarburetorHarness({ params: { rpm, throttle } });
        run(model, 3);
        expect(model.state.mixture).toBeGreaterThanOrEqual(0.97);
        expect(model.state.mixture).toBeLessThanOrEqual(1.03);
        expect(bus.get('fuel.mixture')).toBeCloseTo(model.state.mixture, 6);
      });
    }
  }
});

describe('motor detenido y cebado a mano (test §11.11)', () => {
  it('rpm = 0: la bomba mecánica no bombea', () => {
    const { model } = createCarburetorHarness({ params: { rpm: 0, throttle: 0 } });
    run(model, 1);
    expect(model.state.qPump).toBeCloseTo(0, 6);
    expect(model.state.mixture).toBe(0);
  });

  it('primeBowl() llena la cuba', () => {
    // Con la aguja pegada no se autorregula: sigue vacía hasta cebarla a mano.
    const model = createCarburetorModel({ bowlLevel: 0.01, faults: { needleStuck: true } });
    run(model, 0.1);
    expect(model.state.bowlLevel).toBeLessThan(0.02);
    model.actions['primeBowl']?.();
    run(model, 0.01); // dos pasos alcanzan (§25: un paso de retraso en el controlador)
    expect(model.state.bowlLevel).toBeGreaterThan(0.05);
  });

  it('refill() llena el estanque a 40 L', () => {
    const model = createCarburetorModel({ tankLevel: 5 });
    run(model, 0.01);
    expect(model.state.tankLevel).toBeCloseTo(5, 1);
    model.actions['refill']?.();
    run(model, 0.01);
    expect(model.state.tankLevel).toBeCloseTo(40, 1);
  });
});

describe('robustez y determinismo (test §11.12)', () => {
  it('nunca da NaN/Infinity ni deja de converger con combinaciones al azar de params/faults', () => {
    let seed = 1;
    const rand = (): number => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    for (let i = 0; i < 60; i++) {
      const overrides = {
        seed: i,
        bowlLevel: rand() * 0.1,
        tankLevel: rand() * 50,
        params: {
          rpm: rand() * 6500,
          throttle: rand(),
          engineTempC: -10 + rand() * 120,
          choke: rand(),
          idleScrew: 0.5 + rand(),
        },
        faults: {
          idleJetClog: rand(),
          mainJetClog: rand(),
          floatPunctured: rand() > 0.7,
          needleStuck: rand() > 0.7,
          chokeStuck: (['ok', 'closed', 'open'] as const)[Math.floor(rand() * 3)] ?? 'ok',
          accelPumpFailed: rand() > 0.7,
          pumpWear: rand(),
          pumpDiaphragm: rand() > 0.7,
          filterClog: rand(),
        },
      };
      const circuit = compileCarburetorCircuit(overrides);
      for (let s = 0; s < 500; s++) {
        circuit.model.step(0.001);
        for (const [key, value] of Object.entries(circuit.model.state)) {
          expect(Number.isFinite(value) || typeof value === 'boolean', `${key} (caso ${i})`).toBe(true);
        }
      }
      expect(circuit.solver.stats.failures, `caso ${i}`).toBe(0);
    }
  });

  it('misma semilla y mismas entradas → mismo estado final', () => {
    const a = createCarburetorModel({ seed: 7, params: { rpm: 2500, throttle: 0.4 } });
    const b = createCarburetorModel({ seed: 7, params: { rpm: 2500, throttle: 0.4 } });
    run(a, 1);
    run(b, 1);
    expect(a.state).toEqual(b.state);
  });
});
