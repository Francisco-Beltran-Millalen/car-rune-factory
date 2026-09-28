// A15, plan del vehículo §4.8: `engineCore` del vehículo con entradas reales
// del bus (spark, compresión, tensión de arranque, sincronía de la ECU,
// balance entre cilindros, ebullición, aire no medido) en vez de los stubs
// ideales del laboratorio. `crankAngle`/`camAngle` los sigue publicando
// `four-stroke` (D-V6): este controlador nunca los toca.
import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/core/rng.ts';
import type { ControllerContext } from '../../src/sim/controllers/base.ts';
import { createVehicleEngineCore, ENGINE_STATE_CODE } from '../../src/sim/controllers/engineCore.ts';
import type { SignalBus } from '../../src/sim/signals/bus.ts';

const DT = 0.001;

function fakeBus(initial: Readonly<Record<string, number>> = {}): {
  bus: SignalBus;
  values: Record<string, number>;
  written: Record<string, number>;
} {
  const values: Record<string, number> = { ...initial };
  const written: Record<string, number> = {};
  const bus: SignalBus = {
    get: (id) => values[id] ?? 0,
    set: (_owner, id, value) => {
      written[id] = value;
      values[id] = value;
    },
    commit: () => {
      // el fake no distingue paso anterior/actual: alcanza para estas pruebas.
    },
    snapshot: () => ({ ...values }),
  };
  return { bus, values, written };
}

function ctx(params: Record<string, number | boolean | string>, faults: Record<string, boolean> = {}): ControllerContext {
  return { dt: DT, read: () => 0, params, faults, elements: {}, rng: createRng(1) };
}

const HEALTHY = {
  'ignition.spark': 1,
  'engine.compression': 1,
  'electrical.crankVoltage': 12.6,
  'ecu.sync': 1,
  'engine.cylinderBalance': 1,
  'lubrication.seized': 0,
  'cooling.boiling': 0,
  'ignition.vacuumLeak': 0,
  'fuel.mixture': 1,
};

function run(
  controller: ReturnType<typeof createVehicleEngineCore>,
  params: Record<string, number | boolean | string>,
  seconds: number,
  faults: Record<string, boolean> = {},
): void {
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps; i++) controller.update(ctx(params, faults));
}

describe('engineCore del vehículo (plan §4.8)', () => {
  it('arranca con todas las condiciones reales sanas', () => {
    const { bus, values } = fakeBus(HEALTHY);
    const engineCore = createVehicleEngineCore('engineCore', { bus });
    run(engineCore, { ignitionKey: 'start', rpm: 800, throttle: 0 }, 0.5);
    expect(values['engine.state']).toBe(ENGINE_STATE_CODE['running']);
    run(engineCore, { ignitionKey: 'run', rpm: 800, throttle: 0 }, 0.1);
    expect(values['engine.state']).toBe(ENGINE_STATE_CODE['running']);
  });

  it('no arranca si la tensión de arranque es baja (§4.8 "puede partir")', () => {
    const { bus, values } = fakeBus({ ...HEALTHY, 'electrical.crankVoltage': 4 });
    const engineCore = createVehicleEngineCore('engineCore', { bus });
    run(engineCore, { ignitionKey: 'start', rpm: 800, throttle: 0 }, 1);
    expect(values['engine.state']).toBe(ENGINE_STATE_CODE['cranking']);
  });

  it('misfire con el balance entre cilindros bajo, aunque la mezcla sea sana', () => {
    const { bus, values } = fakeBus(HEALTHY);
    const engineCore = createVehicleEngineCore('engineCore', { bus });
    run(engineCore, { ignitionKey: 'start', rpm: 800, throttle: 0 }, 0.5);
    expect(values['engine.state']).toBe(ENGINE_STATE_CODE['running']);
    values['engine.cylinderBalance'] = 0.5;
    run(engineCore, { ignitionKey: 'run', rpm: 800, throttle: 0 }, 0.01);
    expect(values['engine.state']).toBe(ENGINE_STATE_CODE['misfire']);
  });

  it('misfire con ebullición del refrigerante', () => {
    const { bus, values } = fakeBus(HEALTHY);
    const engineCore = createVehicleEngineCore('engineCore', { bus });
    run(engineCore, { ignitionKey: 'start', rpm: 800, throttle: 0 }, 0.5);
    values['cooling.boiling'] = 1;
    run(engineCore, { ignitionKey: 'run', rpm: 800, throttle: 0 }, 0.01);
    expect(values['engine.state']).toBe(ENGINE_STATE_CODE['misfire']);
  });

  it('se detiene (stalled) si la ECU pierde sincronía en marcha', () => {
    const { bus, values } = fakeBus(HEALTHY);
    const engineCore = createVehicleEngineCore('engineCore', { bus });
    run(engineCore, { ignitionKey: 'start', rpm: 800, throttle: 0 }, 0.5);
    values['ecu.sync'] = 0;
    run(engineCore, { ignitionKey: 'run', rpm: 800, throttle: 0 }, 0.01);
    expect(values['engine.state']).toBe(ENGINE_STATE_CODE['stalled']);
  });

  it('agarrotado (`lubrication.seized`): no vuelve a `cranking`', () => {
    const { bus, values } = fakeBus({ ...HEALTHY, 'lubrication.seized': 1 });
    const engineCore = createVehicleEngineCore('engineCore', { bus });
    run(engineCore, { ignitionKey: 'off', rpm: 800, throttle: 0 }, 0.01);
    run(engineCore, { ignitionKey: 'start', rpm: 800, throttle: 0 }, 0.5);
    expect(values['engine.state']).toBe(ENGINE_STATE_CODE['off']);
  });

  it('`engine.load` es 0 sin marcha y `throttle` clampeado en marcha', () => {
    const { bus, values } = fakeBus(HEALTHY);
    const engineCore = createVehicleEngineCore('engineCore', { bus });
    run(engineCore, { ignitionKey: 'off', rpm: 800, throttle: 0.7 }, 0.01);
    expect(values['engine.load']).toBe(0);
    run(engineCore, { ignitionKey: 'start', rpm: 800, throttle: 0.7 }, 0.6);
    expect(values['engine.state']).toBe(ENGINE_STATE_CODE['running']);
    expect(values['engine.load']).toBeCloseTo(0.7, 6);
  });

  it('`air.massFlow`/`air.ratio` provisionales (§4.8 D-V7)', () => {
    const { bus, values } = fakeBus({ ...HEALTHY, 'ignition.vacuumLeak': 2 });
    const engineCore = createVehicleEngineCore('engineCore', { bus });
    // Motor detenido: sin caudal de aire, air.ratio no divide (queda en 1).
    run(engineCore, { ignitionKey: 'off', rpm: 800, throttle: 0 }, 0.01);
    expect(values['air.massFlow']).toBe(0);
    expect(values['air.ratio']).toBe(1);

    // 0.6 s: de sobra para dejar `cranking` y que `rpmEff` sea el `rpm` real.
    run(engineCore, { ignitionKey: 'start', rpm: 800, throttle: 0.5 }, 0.6);
    expect(values['engine.state']).toBe(ENGINE_STATE_CODE['running']);
    const pMan = -0.65 + 0.65 * 0.5;
    const expectedFlow = 1.2e-3 * 2.0 * (800 / 120) * (0.8 + 0.05 * 0.5) * ((1.013 + pMan) / 1.013) * 3600;
    expect(values['air.massFlow']).toBeCloseTo(expectedFlow, 6);
    expect(values['air.ratio']).toBeCloseTo(1 + 2 / expectedFlow, 6);
  });

  it('`vacuumHoseOffFaultKey` corta `pRef` a 0 (misma regla que el laboratorio)', () => {
    const { bus } = fakeBus(HEALTHY);
    const written: Record<string, number> = {};
    const vacuumHoseControl: Record<string, number> = {};
    const manifold = { control: written, ports: [], params: {}, state: {}, eval: () => {}, commit: () => {} };
    const vacuumHose = { control: vacuumHoseControl, ports: [], params: {}, state: {}, eval: () => {}, commit: () => {} };
    const engineCore = createVehicleEngineCore('engineCore', {
      bus,
      elementIds: { manifold: 'fuel:manifold', vacuumHose: 'fuel:vacuumHose' },
      vacuumHoseOffFaultKey: 'fuel:vacuumHoseOff',
    });
    const context: ControllerContext = {
      dt: DT,
      read: () => 0,
      params: { ignitionKey: 'run', rpm: 800, throttle: 0.5 },
      faults: { 'fuel:vacuumHoseOff': true },
      elements: { 'fuel:manifold': manifold, 'fuel:vacuumHose': vacuumHose },
      rng: createRng(1),
    };
    engineCore.update(context);
    expect(vacuumHose.control['p']).toBe(0);
    expect(manifold.control['p']).not.toBe(0);
  });
});
