// Criterios 3–15 de la spec cooling §11 sobre el modelo compilado. Los
// escenarios largos usan `fastThermal` (×20): 30 min equivalentes = 90 s.
import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/core/rng.ts';
import {
  compileCoolingCircuit,
  createCoolingModel,
  type CoolingModel,
} from '../../src/modules/cooling/circuit.ts';
import type { CoolingFaults, CoolingParams } from '../../src/modules/cooling/controllers.ts';

const run = (m: CoolingModel, seconds: number): void => {
  const n = Math.round(seconds / 0.001);
  for (let i = 0; i < n; i++) m.step(0.001);
};

function model(overrides: {
  variant?: 'electric' | 'viscous';
  params?: Partial<CoolingParams>;
  faults?: Partial<CoolingFaults>;
  seed?: number;
} = {}): CoolingModel {
  return createCoolingModel(overrides.variant ?? 'electric', {
    params: { rpm: 800, load: 0, ambientC: 25, ...overrides.params },
    ...(overrides.faults ? { faults: overrides.faults } : {}),
    ...(overrides.seed !== undefined ? { seed: overrides.seed } : {}),
  });
}

/** Corre hasta `seconds` y devuelve el tiempo (s) en que se cruza `test`. */
function until(m: CoolingModel, seconds: number, test: (m: CoolingModel) => boolean): number | null {
  const n = Math.round(seconds / 0.001);
  for (let i = 0; i < n; i++) {
    m.step(0.001);
    if (test(m)) return i / 1000;
  }
  return null;
}

describe('calentamiento y régimen (spec §11.3 a §11.6)', () => {
  it('red hidráulica: termostato abierto da 6000–8000 L/h a 6000 rpm', { timeout: 60_000 }, () => {
    const c = compileCoolingCircuit('electric', {
      params: { rpm: 6000, load: 0.3, ambientC: 25 },
    });
    c.model.actions['setEngineTemp']?.(110);
    for (let i = 0; i < 20_000; i++) c.model.step(0.001);
    expect(c.model.state.thermostatOpen).toBeGreaterThan(0.9);
    expect(c.model.state.qPump).toBeGreaterThan(6000);
    expect(c.model.state.qPump).toBeLessThan(8000);
    expect(c.solver.stats.failures).toBe(0);
  });

  it('con el termostato cerrado casi todo el caudal va por el bypass', () => {
    const c = compileCoolingCircuit('electric', {
      params: { rpm: 6000, load: 0.3, ambientC: 25 },
    });
    for (let i = 0; i < 5000; i++) c.model.step(0.001);
    expect(c.model.state.thermostatOpen).toBe(0);
    expect(c.model.state.qRadiator).toBeLessThan(c.model.state.qPump * 0.1);
    expect(c.model.state.qBypass).toBeGreaterThan(c.model.state.qPump * 0.8);
    expect(c.solver.stats.failures).toBe(0);
  });

  it('desde 25 °C llega a 85 °C entre 15 y 30 minutos equivalentes', { timeout: 60_000 }, () => {
    const m = model({ params: { rpm: 800, load: 0, fastThermal: true } });
    const at = until(m, 90, (x) => x.state.engineTemp >= 85);
    expect(at).not.toBeNull();
    if (at !== null) {
      // Tiempo equivalente en segundos = reloj × 20.
      expect(at * 20).toBeGreaterThanOrEqual(15 * 60);
      expect(at * 20).toBeLessThanOrEqual(30 * 60);
    }
  });

  it('ralentí caliente se mantiene entre 88 y 100 °C', () => {
    const m = model({ params: { rpm: 800, load: 0, fastThermal: true } });
    m.actions['setEngineTemp']?.(88);
    run(m, 60); // 20 min equivalentes
    expect(m.state.engineTemp).toBeGreaterThanOrEqual(88);
    expect(m.state.engineTemp).toBeLessThanOrEqual(100);
  });

  it('tráfico con el ventilador muerto pasa los 105 °C; sano no', { timeout: 90_000 }, () => {
    const dead = model({
      params: { rpm: 1200, load: 0.15, ambientC: 25, fastThermal: true },
      faults: { fanDead: true },
    });
    run(dead, 75);
    const t25 = dead.state.engineTemp;
    run(dead, 15);
    expect(dead.state.engineTemp).toBeGreaterThan(105);
    expect(dead.state.engineTemp).toBeGreaterThan(t25);

    const ok = model({ params: { rpm: 1200, load: 0.15, ambientC: 25, fastThermal: true } });
    run(ok, 90);
    expect(ok.state.engineTemp).toBeLessThanOrEqual(101);
  });

  it('carretera 3000 rpm / 0,5 / 100 km/h se mantiene en [86; 95]', { timeout: 60_000 }, () => {
    const m = model({ params: { rpm: 3000, load: 0.5, vehicleSpeedKmh: 100, fastThermal: true } });
    run(m, 60); // 20 min equivalentes
    expect(m.state.engineTemp).toBeGreaterThanOrEqual(86);
    expect(m.state.engineTemp).toBeLessThanOrEqual(95);
  });
});

describe('termostato, tapa y ebullición (spec §11.7 a §11.9)', () => {
  it('pegado abierto en invierno el motor queda frío', { timeout: 60_000 }, () => {
    const m = model({
      params: { rpm: 3000, load: 0.5, vehicleSpeedKmh: 100, ambientC: 5, fastThermal: true },
      faults: { thermostat: 'stuckOpen' },
    });
    run(m, 90); // 30 min equivalentes
    expect(m.state.engineTemp).toBeLessThan(60);
  });

  it('pegado cerrado recalienta y hierve', { timeout: 60_000 }, () => {
    const m = model({
      params: { rpm: 3000, load: 0.5, vehicleSpeedKmh: 100, fastThermal: true },
      faults: { thermostat: 'stuckClosed' },
    });
    run(m, 45); // 15 min equivalentes
    expect(m.state.engineTemp).toBeGreaterThan(120);
    expect(m.state.boiling).toBe(true);
  });

  it('tapa fallada: hierve antes de los 110 °C', { timeout: 90_000 }, () => {
    const m = model({
      params: { rpm: 1200, load: 0.15, ambientC: 25, fastThermal: true },
      faults: { fanDead: true, capFailed: true },
    });
    const at = until(m, 120, (x) => x.state.boiling);
    expect(at).not.toBeNull();
    expect(m.state.engineTemp).toBeLessThan(110);
  });
});

describe('radiador y pérdidas (spec §11.10 a §11.12)', () => {
  it('subida a fondo ≤101 °C; con el panal tapado >104 °C', { timeout: 60_000 }, () => {
    const clean = model({ params: { rpm: 5000, load: 0.9, vehicleSpeedKmh: 60, fastThermal: true } });
    run(clean, 45);
    expect(clean.state.engineTemp).toBeLessThanOrEqual(101);

    const clogged = model({
      params: { rpm: 5000, load: 0.9, vehicleSpeedKmh: 60, ambientC: 30, fastThermal: true },
      faults: { finsClog: 0.7 },
    });
    run(clogged, 45);
    expect(clogged.state.engineTemp).toBeGreaterThan(104);
  });

  it('manguera rota: baja el nivel, la bomba aspira aire y recalienta', { timeout: 120_000 }, () => {
    const m = model({ params: { rpm: 1500, load: 0.3 }, faults: { hoseLeak: 1 } });
    m.actions['setEngineTemp']?.(90);
    const airAt = until(m, 600, (x) => x.state.pumpAir > 0);
    expect(airAt).not.toBeNull();
    expect(m.state.level).toBeLessThan(5.5);
    const hotAt = until(m, 600, (x) => x.state.engineTemp > 110);
    expect(hotAt).not.toBeNull();
  });

  it('calefactor: entrega calor con el motor a 90 °C y casi nada tapado', () => {
    const m = model({ params: { rpm: 1500, load: 0.2, heaterOn: true } });
    m.actions['setEngineTemp']?.(90);
    run(m, 30);
    expect(m.state.heatCabin).toBeGreaterThan(3);
    expect(m.state.heatCabin).toBeLessThan(8);

    const clogged = model({
      params: { rpm: 1500, load: 0.2, heaterOn: true },
      faults: { heaterClog: 1 },
    });
    clogged.actions['setEngineTemp']?.(90);
    run(clogged, 30);
    expect(clogged.state.heatCabin).toBeLessThan(2);
  });
});

describe('ventiladores y sensor (spec §11.13 y §11.14)', () => {
  it('eléctrico: el ventilador prendido consume ~10 A', () => {
    const m = model({ params: { rpm: 800, load: 0, batteryV: 13.8 } });
    m.actions['setEngineTemp']?.(105);
    run(m, 2);
    expect(m.state.fanOn).toBe(true);
    expect(m.state.fanCurrent).toBeGreaterThan(9);
    expect(m.state.fanCurrent).toBeLessThan(11.5);
  });

  it('viscoso: a 3000 rpm y radiador a 90 °C da [5; 8] m/s', () => {
    const m = model({ variant: 'viscous', params: { rpm: 3000, load: 0.3 } });
    m.actions['setEngineTemp']?.(90);
    run(m, 2);
    expect(m.state.fanAir).toBeGreaterThanOrEqual(5);
    expect(m.state.fanAir).toBeLessThanOrEqual(8);
  });

  it('sensor que marca frío: el reloj miente 30 °C', () => {
    const m = model({ params: { rpm: 1500, load: 0.3 }, faults: { sensorFault: 'readsCold' } });
    m.actions['setEngineTemp']?.(95);
    run(m, 1);
    expect(Math.abs(m.state.gaugeTemp - (m.state.engineTemp - 30))).toBeLessThan(0.5);
  });
});

describe('robustez y determinismo (spec §11.15)', () => {
  it(
    '200 combinaciones aleatorias con semilla × 2 s, sin NaN',
    { timeout: 120_000 },
    () => {
      const rng = createRng(20260926);
      for (let k = 0; k < 200; k++) {
        const params: Partial<CoolingParams> = {
          rpm: rng.range(0, 6500),
          load: rng.next(),
          vehicleSpeedKmh: rng.range(0, 160),
          ambientC: rng.range(-10, 45),
          heaterOn: rng.chance(0.4),
          batteryV: rng.range(10, 14.5),
          fastThermal: rng.chance(0.3),
        };
        const faults: Partial<CoolingFaults> = {
          thermostat: rng.pick(['ok', 'stuckOpen', 'stuckClosed'] as const),
          pumpWear: rng.next(),
          pumpLeak: rng.next(),
          hoseLeak: rng.next(),
          beltSlip: rng.next(),
          finsClog: rng.next(),
          tubesClog: rng.next(),
          capFailed: rng.chance(0.2),
          heaterClog: rng.next(),
          fanDead: rng.chance(0.2),
          fanClutchWorn: rng.next(),
          fanSwitchDead: rng.chance(0.2),
          sensorFault: rng.pick(['ok', 'readsCold', 'open'] as const),
        };
        const m = createCoolingModel(rng.chance(0.5) ? 'electric' : 'viscous', {
          params,
          faults,
          seed: k,
        });
        run(m, 2);
        const s = m.state;
        for (const [key, value] of Object.entries(s)) {
          if (typeof value === 'number') {
            expect(Number.isFinite(value), `cooling.${key} (${k})`).toBe(true);
          }
        }
        expect(s.level).toBeGreaterThanOrEqual(0);
      }
    },
  );

  it('dos modelos con la misma semilla terminan idénticos', () => {
    const overrides = {
      params: { rpm: 2000, load: 0.4, ambientC: 30, fastThermal: true },
      faults: { thermostat: 'stuckClosed' as const, hoseLeak: 0.3 },
      seed: 5,
    };
    const a = createCoolingModel('electric', overrides);
    const b = createCoolingModel('electric', overrides);
    run(a, 3);
    run(b, 3);
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
  });
});
