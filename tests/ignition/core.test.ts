// Criterios 2–9, 11 y 13 de la spec ignition §11, sobre el modelo compilado.
import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/core/rng.ts';
import {
  compileIgnitionCircuit,
  createIgnitionHarness,
  createIgnitionModel,
  type IgnitionModel,
} from '../../src/modules/ignition/circuit.ts';
import type { IgnitionFaults, IgnitionParams } from '../../src/modules/ignition/core.ts';

const run = (m: IgnitionModel, seconds: number): void => {
  const n = Math.round(seconds / 0.001);
  for (let i = 0; i < n; i++) m.step(0.001);
};

function model(overrides: {
  params?: Partial<IgnitionParams>;
  faults?: Partial<IgnitionFaults>;
  seed?: number;
} = {}): IgnitionModel {
  return createIgnitionModel('points', {
    params: { ignitionKey: 'run', rpm: 800, throttle: 0, ...overrides.params },
    ...(overrides.faults ? { faults: overrides.faults } : {}),
    ...(overrides.seed !== undefined ? { seed: overrides.seed } : {}),
  });
}

const grid = [250, 800, 3000, 6000] as const;
const throttles = [0, 0.5, 1] as const;

describe('encendido sano (spec §11.2 y §11.3)', () => {
  it('COP: chispa 1 en toda la grilla', () => {
    for (const rpm of grid) {
      for (const throttle of throttles) {
        const m = createIgnitionModel('cop', { params: { ignitionKey: 'run', rpm, throttle } });
        run(m, 1.5);
        expect(m.state.sparkRate, `cop ${rpm} rpm · ${throttle}`).toBeGreaterThan(0.99);
      }
    }
  });

  it('platinos: chispa 1 en la grilla (a 250 rpm con arranque)', () => {
    for (const rpm of grid) {
      for (const throttle of throttles) {
        const m = createIgnitionModel('points', {
          params: { ignitionKey: rpm === 250 ? 'start' : 'run', rpm, throttle },
        });
        run(m, 1.5);
        expect(m.state.sparkRate, `points ${rpm} rpm · ${throttle}`).toBeGreaterThan(0.99);
      }
    }
  });
});

describe('fallas de chispa (spec §11.4 a §11.7)', () => {
  it('bujías gastadas: platinos fallan en alta, COP no; ralentí anda', () => {
    const points = model({ params: { rpm: 6000, throttle: 1 }, faults: { plugGapWear: 1 } });
    run(points, 1.5);
    expect(points.state.sparkRate).toBeLessThan(0.9);
    const idle = model({ faults: { plugGapWear: 1 } });
    run(idle, 1.5);
    expect(idle.state.sparkRate).toBeGreaterThan(0.99);
    const cop = createIgnitionModel('cop', {
      params: { ignitionKey: 'run', rpm: 6000, throttle: 1 },
      faults: { plugGapWear: 1 },
    });
    run(cop, 1.5);
    expect(cop.state.sparkRate).toBeGreaterThan(0.99);
  });

  it('batería débil con bujías gastadas a fondo: chispa < 0,5', () => {
    const m = model({
      params: { rpm: 6000, throttle: 1, batteryV: 10 },
      faults: { plugGapWear: 1 },
    });
    run(m, 1.5);
    expect(m.state.sparkRate).toBeLessThan(0.5);
  });

  it('balasto abierto: arranca y se apaga al soltar la llave', () => {
    const m = model({ params: { ignitionKey: 'start' }, faults: { ballastOpen: true } });
    run(m, 1.5);
    expect(m.state.sparkRate).toBeGreaterThan(0.99);
    m.params.ignitionKey = 'run';
    run(m, 0.5);
    expect(m.state.sparkRate).toBeLessThan(0.1);
  });

  it('condensador en corto: sin chispa; abierto: chispa débil y picado', () => {
    const shorted = model({ faults: { condenserShorted: true } });
    run(shorted, 1.5);
    expect(shorted.state.sparkRate).toBeLessThan(0.01);

    const open = model({ params: { rpm: 3000 } , faults: { condenserOpen: true } });
    run(open, 1);
    expect(open.state.vAvail).toBeGreaterThan(15);
    expect(open.state.vAvail).toBeLessThan(20);
    expect(open.state.pitting).toBeGreaterThan(0);
  });

  it('sensor de cigüeñal: muerto o con mucha separación', () => {
    const dead = createIgnitionModel('cop', {
      params: { ignitionKey: 'run', rpm: 800 },
      faults: { crankSensorDead: true },
    });
    run(dead, 1);
    expect(dead.state.sync).toBe(false);
    expect(dead.state.sparkRate).toBeLessThan(0.01);
    const gap = createIgnitionModel('cop', {
      params: { ignitionKey: 'run', rpm: 250 },
      faults: { crankSensorGap: 1 },
    });
    run(gap, 1);
    expect(gap.state.sync).toBe(false);
    gap.params.rpm = 800;
    run(gap, 0.5);
    expect(gap.state.sync).toBe(true);
  });
});

describe('fase, avance y códigos (spec §11.9 y §11.10)', () => {
  it('leva atrasada 10°: platinos pierde 10° de avance', () => {
    const base = model({ params: { rpm: 1500 } });
    run(base, 0.5);
    const late = model({ params: { rpm: 1500, camOffset: 10 } });
    run(late, 0.5);
    expect(base.state.advance - late.state.advance).toBeGreaterThan(9.5);
    expect(base.state.advance - late.state.advance).toBeLessThan(10.5);
  });

  it('leva atrasada 10°: COP no cambia el avance y deja P0016', () => {
    const base = createIgnitionModel('cop', { params: { ignitionKey: 'run', rpm: 1500 } });
    run(base, 0.5);
    const late = createIgnitionModel('cop', {
      params: { ignitionKey: 'run', rpm: 1500, camOffset: 10 },
    });
    run(late, 0.5);
    expect(late.state.advance).toBeCloseTo(base.state.advance, 6);
    run(late, 2);
    expect(late.state.codes).toContain('P0016');
  });

  it('sin sensor de leva: chispa perdida y código P0340', () => {
    const { model: m, bus } = createIgnitionHarness('cop', {
      params: { ignitionKey: 'run', rpm: 1500 },
      faults: { camSensorDead: true },
    });
    run(m, 1);
    expect(m.state.codes).toContain('P0340');
    expect(bus.get('ecu.sync')).toBe(1);
    expect(m.state.eventCount).toBeGreaterThan(0);
  });

  it('bobina 2 muerta: la bujía 2 no enciende', () => {
    const m = createIgnitionModel('cop', {
      params: { ignitionKey: 'run', rpm: 1500 },
      faults: { coil2Dead: true },
    });
    run(m, 1.5);
    expect(m.state.sparks[1]).toBeLessThan(0.1);
    expect(m.state.sparks[0]).toBeGreaterThan(0.9);
  });
});

describe('carga en el solver (spec §11.11) y robustez (§11.13)', () => {
  it('corriente del bus y convergencia sin fallas', () => {
    const points = compileIgnitionCircuit('points', {
      params: { ignitionKey: 'run', rpm: 800, throttle: 0 },
    });
    for (let i = 0; i < 2000; i++) points.model.step(0.001);
    expect(points.model.state.busCurrent).toBeGreaterThan(1.9);
    expect(points.model.state.busCurrent).toBeLessThan(2.5);
    expect(points.solver.stats.failures).toBe(0);

    const cop800 = compileIgnitionCircuit('cop', {
      params: { ignitionKey: 'run', rpm: 800, throttle: 0 },
    });
    for (let i = 0; i < 2000; i++) cop800.model.step(0.001);
    expect(cop800.model.state.busCurrent).toBeGreaterThan(0.33);
    expect(cop800.model.state.busCurrent).toBeLessThan(0.53);
    expect(cop800.solver.stats.failures).toBe(0);

    const cop6000 = compileIgnitionCircuit('cop', {
      params: { ignitionKey: 'run', rpm: 6000, throttle: 1 },
    });
    for (let i = 0; i < 2000; i++) cop6000.model.step(0.001);
    expect(cop6000.model.state.busCurrent).toBeGreaterThan(2.9);
    expect(cop6000.model.state.busCurrent).toBeLessThan(3.7);
    expect(cop6000.solver.stats.failures).toBe(0);
  });

  it('6500 rpm no pierde eventos: 4 por ciclo exactos', () => {
    const m = model({ params: { rpm: 6500, throttle: 1 } });
    const cycles = 30;
    run(m, (cycles * 720) / (6500 / 60 * 360));
    expect(m.state.eventCount).toBe(cycles * 4);
  });

  it(
    'robustez: 200 combinaciones con semilla × 1 s, sin NaN',
    { timeout: 120_000 },
    () => {
      const rng = createRng(20260926);
      for (let k = 0; k < 200; k++) {
        const variant = rng.chance(0.5) ? 'points' : 'cop';
        const params: Partial<IgnitionParams> = {
          ignitionKey: rng.pick(['off', 'on', 'start', 'run']),
          rpm: rng.range(0, 6500),
          throttle: rng.next(),
          batteryV: rng.range(9, 14.5),
          camOffset: rng.range(-20, 20),
          compression: rng.next(),
          humidity: rng.next(),
          dwellMs: rng.range(1, 6),
        };
        const faults: Partial<IgnitionFaults> = {
          plugGapWear: rng.next(),
          plugFouled2: rng.next(),
          coilWeak: rng.next(),
          pointsGap: rng.next(),
          pointsPitted: rng.next(),
          condenserOpen: rng.chance(0.2),
          condenserShorted: rng.chance(0.1),
          ballastOpen: rng.chance(0.2),
          capCracked: rng.next(),
          rotorWorn: rng.next(),
          htLead3Open: rng.chance(0.2),
          centrifugalStuck: rng.chance(0.2),
          vacuumDiaphragm: rng.chance(0.2),
          crankSensorDead: rng.chance(0.15),
          crankSensorGap: rng.next(),
          camSensorDead: rng.chance(0.15),
          coil2Dead: rng.chance(0.15),
          igniterDead: rng.chance(0.15),
        };
        const m = createIgnitionModel(variant, { params, faults, seed: k });
        run(m, 1);
        const s = m.state;
        for (const [key, value] of Object.entries(s)) {
          if (typeof value === 'number') {
            expect(Number.isFinite(value), `${variant}.${key} (${k})`).toBe(true);
          }
        }
        expect(s.sparkRate).toBeGreaterThanOrEqual(0);
        expect(s.sparkRate).toBeLessThanOrEqual(1);
      }
    },
  );

  it('dos modelos con la misma semilla terminan idénticos', () => {
    const overrides = {
      params: { ignitionKey: 'start' as const, rpm: 1200, throttle: 0.5 },
      faults: { plugGapWear: 0.3, capCracked: 0.4, humidity: 0.7 },
      seed: 9,
    };
    const a = createIgnitionModel('points', overrides);
    const b = createIgnitionModel('points', overrides);
    run(a, 1);
    run(b, 1);
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
  });
});
