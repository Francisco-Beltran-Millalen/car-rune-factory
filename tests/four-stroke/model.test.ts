// Criterios 3, 4, 5 (balance), 8, 12, 13 y 14 de la spec four-stroke §11:
// prueba de compresión, fallas por cilindro, choque de válvulas, señales,
// robustez y determinismo.
import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/core/rng.ts';
import {
  compileFourStrokeCircuit,
  createFourStrokeHarness,
  createFourStrokeModel,
  type FourStrokeModel,
} from '../../src/modules/four-stroke/circuit.ts';
import { K } from '../../src/modules/four-stroke/constants.ts';
import type { FourStrokeFaults, FourStrokeParams } from '../../src/modules/four-stroke/mechanism.ts';

const run = (m: FourStrokeModel, seconds: number): void => {
  const n = Math.round(seconds / 0.001);
  for (let i = 0; i < n; i++) m.step(0.001);
};

function compressionTest(m: FourStrokeModel): void {
  m.actions['compressionTest']?.();
  run(m, K.testTime + 1.5);
}

const wot = (overrides: Partial<FourStrokeParams> = {}): Partial<FourStrokeParams> => ({
  mode: 'auto',
  rpm: 3000,
  throttle: 1,
  sparkAdvance: 25,
  ...overrides,
});

describe('mecanismo de 4 tiempos (spec §11.3 a §11.5)', () => {
  it('compila sin red de solver (0 nodos) y avanza', () => {
    const circuit = compileFourStrokeCircuit('dohc', { params: wot() });
    expect(circuit.nodes.count).toBe(0);
    expect(circuit.issues).toEqual([]);
    for (let i = 0; i < 1000; i++) circuit.model.step(0.001);
    expect(circuit.model.state.workPerCycle[0] ?? 0).toBeGreaterThan(100);
  });

  it('prueba de compresión sana: los 4 cilindros entre 12,5 y 14 bar', () => {
    const m = createFourStrokeModel('dohc', { params: wot() });
    compressionTest(m);
    for (let i = 0; i < 4; i++) {
      expect(m.state.compression[i], `cilindro ${i + 1}`).toBeGreaterThan(12.5);
      expect(m.state.compression[i], `cilindro ${i + 1}`).toBeLessThan(14);
    }
    expect(m.state.testing).toBe(false);
  });

  it('anillos gastados en el 3 y válvula quemada en el 2 bajan su compresión', () => {
    const ring = createFourStrokeModel('dohc', { params: wot(), faults: { ringWear3: 1 } });
    compressionTest(ring);
    expect(ring.state.compression[2]).toBeLessThan(7);
    for (const i of [0, 1, 3]) {
      expect(ring.state.compression[i]).toBeGreaterThan(12.5);
      expect(ring.state.compression[i]).toBeLessThan(14);
    }
    const valve = createFourStrokeModel('dohc', { params: wot(), faults: { burntValve2: 1 } });
    compressionTest(valve);
    expect(valve.state.compression[1]).toBeLessThan(5);
  });

  it('a fondo: los 4 cilindros trabajan parecido (balance > 0,97)', () => {
    const m = createFourStrokeModel('dohc', { params: wot() });
    run(m, 5);
    for (const w of m.state.workPerCycle) {
      expect(w).toBeGreaterThan(520);
      expect(w).toBeLessThan(650);
    }
    for (const p of m.state.peakPressure) {
      expect(p).toBeGreaterThan(55);
      expect(p).toBeLessThan(75);
    }
    expect(m.state.cylinderBalance).toBeGreaterThan(0.97);
    // El torque es instantáneo: oscila y cruza por cero. El promedio del
    // indicado menos la fricción ronda W·4/(4π) − Tf ≈ 585·4/12,57 − 18.
    let sum = 0;
    let max = -Infinity;
    for (let i = 0; i < 1000; i++) {
      m.step(0.001);
      sum += m.state.torque;
      if (m.state.torque > max) max = m.state.torque;
    }
    const avg = sum / 1000;
    expect(avg).toBeGreaterThan(100);
    expect(avg).toBeLessThan(250);
    expect(max).toBeGreaterThan(300);
  });
});

describe('choque de válvulas (spec §11.8)', () => {
  it('un diente saltado no choca en 10 s', () => {
    const m = createFourStrokeModel('dohc', { params: wot(), faults: { skippedTeeth: 1 } });
    let hit = false;
    for (let i = 0; i < 10_000; i++) {
      m.step(0.001);
      if (m.state.valveHit > 0) hit = true;
    }
    expect(hit).toBe(false);
    expect(m.state.bentValve.some(Boolean)).toBe(false);
  });

  it('dos dientes (en los dos sentidos) chocan en menos de 0,1 s', () => {
    for (const teeth of [2, -2]) {
      const m = createFourStrokeModel('dohc', { params: wot(), faults: { skippedTeeth: teeth } });
      let hit = false;
      for (let i = 0; i < 100 && !hit; i++) {
        m.step(0.001);
        hit = m.state.valveHit > 0 || m.state.bentValve.some(Boolean);
      }
      expect(hit, `skippedTeeth ${teeth}`).toBe(true);
    }
  });
});

describe('señales del mecanismo (spec §11.12)', () => {
  it('cadena sana: camOffset 0 y compresión relativa 1', () => {
    const { model, bus } = createFourStrokeHarness('dohc', { params: wot() });
    run(model, 1);
    expect(Math.abs(model.state.camOffset)).toBeLessThan(0.01);
    expect(bus.get('engine.compression')).toBeGreaterThanOrEqual(0.97);
    expect(bus.get('engine.compression')).toBeLessThanOrEqual(1);
    expect(bus.get('engine.cylinderBalance')).toBeGreaterThan(0.97);
  });

  it('anillos gastados en los 4: compresión relativa < 0,6', () => {
    const { model, bus } = createFourStrokeHarness('dohc', {
      params: wot(),
      faults: { ringWear1: 1, ringWear2: 1, ringWear3: 1, ringWear4: 1 },
    });
    run(model, 1);
    expect(bus.get('engine.compression')).toBeLessThan(0.6);
  });

  it('la fase se publica en el mismo paso', () => {
    const { model, bus } = createFourStrokeHarness('dohc', { params: wot() });
    model.step(0.001);
    expect(bus.get('engine.crankAngle')).toBeCloseTo(model.state.crankAngle, 9);
    expect(bus.get('engine.camAngle')).toBeCloseTo(model.state.camAngle, 9);
  });
});

describe('robustez y determinismo (spec §11.13 y §11.14)', () => {
  it(
    '300 combinaciones aleatorias con semilla × 2 s: sin NaN ni Infinity',
    { timeout: 120_000 },
    () => {
      const rng = createRng(20260926);
      for (let k = 0; k < 300; k++) {
        const params: Partial<FourStrokeParams> = {
          mode: rng.chance(0.2) ? 'manual' : 'auto',
          rpm: rng.range(60, 6500),
          crankDeg: rng.range(0, 720),
          throttle: rng.next(),
          sparkAdvance: rng.range(0, 40),
          spark: rng.chance(0.5),
          oilPressure: rng.range(0, 6),
          viewCylinder: rng.int(1, 4),
          drive: rng.chance(0.5) ? 'belt' : 'chain',
        };
        const faults: Partial<FourStrokeFaults> = {
          ringWear1: rng.next(),
          ringWear2: rng.next(),
          ringWear3: rng.next(),
          ringWear4: rng.next(),
          burntValve1: rng.next(),
          burntValve2: rng.next(),
          crankBoltLoose: rng.chance(0.3),
          keywayWorn: rng.next(),
          keySheared: rng.chance(0.2),
          tensionerWeak: rng.next(),
          guideBroken: rng.chance(0.3),
          chainStretch: rng.next(),
          skippedTeeth: rng.int(-2, 2),
          beltWear: rng.next(),
          valveLash: rng.next(),
        };
        const m = createFourStrokeModel('dohc', { params, faults, seed: k });
        expect(() => {
          run(m, 2);
        }, `combinación ${k}`).not.toThrow();
        const s = m.state;
        expect(Number.isFinite(s.pressure), `presión ${k}`).toBe(true);
        expect(s.pressure).toBeGreaterThanOrEqual(0);
        expect(s.pressure).toBeLessThanOrEqual(150);
        expect(Number.isFinite(s.volume), `volumen ${k}`).toBe(true);
        expect(Number.isFinite(s.torque), `torque ${k}`).toBe(true);
        expect(Number.isFinite(s.camOffset), `camOffset ${k}`).toBe(true);
        expect(Number.isFinite(s.compressionRel), `compresión ${k}`).toBe(true);
        for (const w of s.workPerCycle) expect(Number.isFinite(w), `trabajo ${k}`).toBe(true);
        expect(Number.isFinite(m.params.rpm)).toBe(true);
      }
    },
  );

  it('dos modelos con la misma semilla terminan idénticos', () => {
    const overrides = {
      params: wot(),
      faults: { ringWear3: 0.4, chainStretch: 0.3 },
      seed: 7,
    };
    const a = createFourStrokeModel('dohc', overrides);
    const b = createFourStrokeModel('dohc', overrides);
    run(a, 1);
    run(b, 1);
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
  });
});
