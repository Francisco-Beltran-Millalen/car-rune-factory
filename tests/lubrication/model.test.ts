// Criterios 2–14 de la spec lubrication §11 sobre el modelo compilado.
import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/core/rng.ts';
import {
  compileLubricationCircuit,
  createLubricationHarness,
  createLubricationModel,
  type LubricationModel,
} from '../../src/modules/lubrication/circuit.ts';
import type { LubricationFaults, LubricationParams } from '../../src/modules/lubrication/controllers.ts';

const run = (m: LubricationModel, seconds: number): void => {
  const n = Math.round(seconds / 0.001);
  for (let i = 0; i < n; i++) m.step(0.001);
};

function model(overrides: {
  variant?: 'gauge' | 'lamp';
  params?: Partial<LubricationParams>;
  faults?: Partial<LubricationFaults>;
  level?: number;
  seed?: number;
} = {}): LubricationModel {
  return createLubricationModel(overrides.variant ?? 'lamp', {
    params: { ignitionKey: 'run', rpm: 800, oilTempC: 100, oilGrade: '10W-40', ...overrides.params },
    ...(overrides.faults ? { faults: overrides.faults } : {}),
    ...(overrides.level !== undefined ? { level: overrides.level } : {}),
    ...(overrides.seed !== undefined ? { seed: overrides.seed } : {}),
  });
}

describe('presión de aceite (spec §11.2 a §11.4)', () => {
  it('caliente (100 °C, 10W-40): presión por rpm en rango', () => {
    const ranges: [number, number, number][] = [
      [800, 0.9, 1.5],
      [2000, 2.4, 3.3],
      [3000, 3.9, 4.6],
      [6000, 4.4, 4.9],
    ];
    for (const [rpm, lo, hi] of ranges) {
      const m = model({ params: { rpm } });
      run(m, 1);
      expect(m.state.pGallery, `${rpm} rpm`).toBeGreaterThanOrEqual(lo);
      expect(m.state.pGallery, `${rpm} rpm`).toBeLessThanOrEqual(hi);
    }
  });

  it('frío (20 °C) en ralentí: al tope y la válvula de alivio abierta', () => {
    const m = model({ params: { oilTempC: 20 } });
    run(m, 1);
    expect(m.state.pGallery).toBeGreaterThanOrEqual(4.4);
    expect(m.state.qRelief).toBeGreaterThan(0);
  });

  it('el grado manda: 5W-30 < 10W-40 < 20W-50, con 5W-30 en [0,6; 1,0]', () => {
    const pressures = (['5W-30', '10W-40', '20W-50'] as const).map((grade) => {
      const m = model({ params: { oilGrade: grade } });
      run(m, 1);
      return m.state.pGallery;
    });
    expect(pressures[0]).toBeGreaterThanOrEqual(0.6);
    expect(pressures[0]).toBeLessThanOrEqual(1.0);
    expect(pressures[0]).toBeLessThan(pressures[1] ?? 0);
    expect(pressures[1]).toBeLessThan(pressures[2] ?? 0);
  });
});

describe('fallas y daño (spec §11.5 a §11.9 y §11.11)', () => {
  it('cojinetes gastados: 0,2 apaga el testigo; 0,5 lo prende', () => {
    const mild = model({ faults: { bearingWear: 0.2 } });
    run(mild, 1);
    expect(mild.state.pGallery).toBeGreaterThan(0.5);
    expect(mild.state.lampOn).toBe(false);
    const bad = model({ faults: { bearingWear: 0.5 } });
    run(bad, 1);
    expect(bad.state.pGallery).toBeLessThan(0.5);
    expect(bad.state.lampOn).toBe(true);
  });

  it('bomba gastada: ralentí < 0,6 y 3000 rpm en [1,3; 2,1]', () => {
    const idle = model({ faults: { pumpWear: 1 } });
    run(idle, 1);
    expect(idle.state.pGallery).toBeLessThan(0.6);
    const fast = model({ params: { rpm: 3000 }, faults: { pumpWear: 1 } });
    run(fast, 1);
    expect(fast.state.pGallery).toBeGreaterThanOrEqual(1.3);
    expect(fast.state.pGallery).toBeLessThanOrEqual(2.1);
  });

  it('filtro tapado: abre el bypass y la caída queda en [0,9; 1,3]', () => {
    const m = model({ params: { rpm: 3000 }, faults: { filterClog: 1 } });
    run(m, 1);
    expect(m.state.bypassOpen).toBe(true);
    expect(m.state.dpFilter).toBeGreaterThanOrEqual(0.9);
    expect(m.state.dpFilter).toBeLessThanOrEqual(1.3);
  });

  it('alivio trabado abierto: 3000 rpm caliente < 1,2 bar', () => {
    const m = model({ params: { rpm: 3000 }, faults: { reliefStuckOpen: true } });
    run(m, 1);
    expect(m.state.pGallery).toBeLessThan(1.2);
  });

  it('rejilla tapada: a 6000 rpm cavita, en ralentí no', () => {
    const fast = model({ params: { rpm: 6000 }, faults: { pickupClog: 1 } });
    run(fast, 1);
    expect(fast.state.pumpAir).toBeGreaterThan(0);
    // Sin ciclo límite paso a paso en el lazo aire → caudal → aspiración.
    const before = fast.state.pumpAir;
    fast.step(0.001);
    expect(Math.abs(fast.state.pumpAir - before)).toBeLessThan(0.01);
    const idle = model({ faults: { pickupClog: 1 } });
    run(idle, 1);
    expect(idle.state.pumpAir).toBe(0);
  });

  it('curvas: con 2,3 L y 0,6 g aspira aire y la presión cae; sin g no', () => {
    const curve = model({ level: 2.3, params: { rpm: 2000, lateralG: 0.6 } });
    run(curve, 1);
    expect(curve.state.pumpAir).toBeGreaterThan(0);
    const straight = model({ level: 2.3, params: { rpm: 2000, lateralG: 0 } });
    run(straight, 1);
    expect(straight.state.pumpAir).toBe(0);
    expect(straight.state.pGallery).toBeGreaterThan(curve.state.pGallery);
  });

  it('sin aceite (1 L) a 3000 rpm se agarrota antes de 90 s', () => {
    const m = model({ level: 1, params: { rpm: 3000 } });
    run(m, 90);
    expect(m.state.seized).toBe(true);
    expect(m.state.bearingDamage).toBeGreaterThanOrEqual(0.95);
  });
});

describe('testigo y antirretorno (spec §11.12 y §11.13)', () => {
  it('llave en Contacto sin motor: testigo prendido; trabado abierto, nunca', () => {
    const on = model({ params: { ignitionKey: 'on' } });
    run(on, 0.5);
    expect(on.state.lampOn).toBe(true);
    const stuck = model({ params: { ignitionKey: 'on' }, faults: { switchStuck: 'neverOn' } });
    run(stuck, 0.5);
    expect(stuck.state.lampOn).toBe(false);
  });

  it('antirretorno vencido: ~3 s sin presión al partir; sano sube en <1 s', () => {
    const bad = model({ params: { ignitionKey: 'on' }, faults: { antiDrainbackFailed: true } });
    run(bad, 61);
    bad.params.ignitionKey = 'run';
    let dry = 0;
    for (let i = 0; i < 5000; i++) {
      bad.step(0.001);
      if (bad.state.pGallery < 0.3) dry = i / 1000;
      else break;
    }
    expect(dry).toBeGreaterThan(2);
    expect(dry).toBeLessThan(4);

    const ok = model({ params: { ignitionKey: 'on' } });
    run(ok, 61);
    ok.params.ignitionKey = 'run';
    let up: number | null = null;
    for (let i = 0; i < 1000 && up === null; i++) {
      ok.step(0.001);
      if (ok.state.pGallery > 0.8) up = i / 1000;
    }
    expect(up).not.toBeNull();
  });
});

describe('acciones, fugas, golpeteo y reset', () => {
  it('setOilLevel y changeOil ponen el nivel; reset vuelve al inicio', () => {
    const m = model({ params: { rpm: 3000 }, level: 1 });
    run(m, 20);
    expect(m.state.bearingDamage).toBeGreaterThan(0);
    m.actions['setOilLevel']?.(2.5);
    run(m, 0.01);
    expect(m.state.level).toBeCloseTo(2.5, 2);
    m.actions['changeOil']?.();
    run(m, 0.01);
    expect(m.state.level).toBeCloseTo(4, 2);
    m.reset();
    run(m, 0.01);
    expect(m.state.level).toBeCloseTo(1, 2);
    expect(m.state.bearingDamage).toBeLessThan(0.001);
    expect(m.state.seized).toBe(false);
  });

  it('la junta del filtro vacía el cárter en marcha; el tapón gotea detenido', () => {
    const leak = model({ params: { rpm: 3000 }, faults: { filterGasketLeak: 1 } });
    run(leak, 10);
    expect(leak.state.level).toBeLessThan(4 - 0.1);
    const drip = model({ params: { ignitionKey: 'off' }, faults: { panDrip: 1 } });
    run(drip, 10);
    expect(drip.state.level).toBeLessThan(4);
    expect(drip.state.level).toBeGreaterThan(4 - 0.001);
  });

  it('golpeteo sólo con mucha holgura y motor en marcha', () => {
    const worn = model({ params: { rpm: 6000 }, faults: { bearingWear: 1 } });
    run(worn, 0.2);
    expect(worn.state.knock).toBeGreaterThan(0.3);
    const ok = model({ params: { rpm: 6000 } });
    run(ok, 0.2);
    expect(ok.state.knock).toBe(0);
    const stopped = model({ params: { ignitionKey: 'on' }, faults: { bearingWear: 1 } });
    run(stopped, 0.2);
    expect(stopped.state.knock).toBe(0);
  });

  it('llave apagada: sin testigo aunque no haya presión (ni con el interruptor trabado)', () => {
    const m = model({ params: { ignitionKey: 'off' }, faults: { switchStuck: 'alwaysOn' } });
    run(m, 0.5);
    expect(m.state.pGallery).toBeLessThan(0.1);
    expect(m.state.lampOn).toBe(false);
  });
});

describe('robustez y determinismo (spec §11.14)', () => {
  it(
    '200 combinaciones aleatorias con semilla × 2 s, sin NaN',
    { timeout: 120_000 },
    () => {
      const rng = createRng(20260926);
      for (let k = 0; k < 200; k++) {
        const params: Partial<LubricationParams> = {
          ignitionKey: rng.pick(['off', 'on', 'run'] as const),
          rpm: rng.range(0, 6500),
          oilTempC: rng.range(-10, 150),
          oilGrade: rng.pick(['5W-30', '10W-40', '20W-50'] as const),
          lateralG: rng.range(0, 1),
        };
        const faults: Partial<LubricationFaults> = {
          bearingWear: rng.next(),
          pumpWear: rng.next(),
          reliefStuckOpen: rng.chance(0.2),
          filterClog: rng.next(),
          pickupClog: rng.next(),
          filterGasketLeak: rng.next(),
          panDrip: rng.next(),
          antiDrainbackFailed: rng.chance(0.2),
          switchStuck: rng.pick(['ok', 'alwaysOn', 'neverOn'] as const),
        };
        const c = compileLubricationCircuit(rng.chance(0.5) ? 'gauge' : 'lamp', {
          params,
          faults,
          level: rng.range(0.5, 4.5),
          seed: k,
        });
        for (let i = 0; i < 2000; i++) c.model.step(0.001);
        expect(c.solver.stats.failures, `solver (${k})`).toBe(0);
        const s = c.model.state;
        for (const [key, value] of Object.entries(s)) {
          if (typeof value === 'number') {
            expect(Number.isFinite(value), `lubrication.${key} (${k})`).toBe(true);
          }
        }
        expect(s.level).toBeGreaterThanOrEqual(0);
        expect(s.level).toBeLessThanOrEqual(5);
      }
    },
  );

  it('dos modelos con la misma semilla terminan idénticos', () => {
    const overrides = {
      params: { ignitionKey: 'run' as const, rpm: 2500, oilTempC: 110, lateralG: 0.4 },
      faults: { bearingWear: 0.4, filterClog: 0.5 },
      level: 2.5,
      seed: 3,
    };
    const a = createLubricationModel('lamp', overrides);
    const b = createLubricationModel('lamp', overrides);
    run(a, 3);
    run(b, 3);
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
  });

  it('el circuito compila sin fallas del solver en los escenarios del test 2', () => {
    const c = compileLubricationCircuit('lamp', {
      params: { ignitionKey: 'run', rpm: 3000, oilTempC: 100 },
    });
    for (let i = 0; i < 2000; i++) c.model.step(0.001);
    expect(c.solver.stats.failures).toBe(0);
    const { model: m, bus } = createLubricationHarness('lamp', {
      params: { ignitionKey: 'run', rpm: 800, oilTempC: 100 },
    });
    run(m, 0.5);
    expect(bus.get('lubrication.viscosity')).toBeGreaterThan(0);
    expect(bus.get('lubrication.pressure')).toBeGreaterThan(0.5);
  });
});
