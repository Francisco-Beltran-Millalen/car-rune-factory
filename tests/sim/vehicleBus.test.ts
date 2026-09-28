// A15, plan del vehículo §5/D-V4: bus con varios dueños validados (uno por
// señal) y stub ideal para las señales sin dueño (`owner: null`, §29).
import { describe, expect, it } from 'vitest';
import { createLabBusController, createVehicleBus } from '../../src/sim/signals/bus.ts';
import { createRng } from '../../src/core/rng.ts';
import type { ControllerContext } from '../../src/sim/controllers/base.ts';

function context(params: Record<string, number | boolean | string> = {}): ControllerContext {
  return { dt: 0.001, read: () => 0, params, faults: {}, elements: {}, rng: createRng(1) };
}

describe('bus del vehículo (plan §5, D-V4)', () => {
  it('cada señal valida su propio dueño (§28)', () => {
    const bus = createVehicleBus({
      signals: [
        { id: 'engine.rpm', owner: 'engineCore' },
        { id: 'ignition.spark', owner: 'ignition' },
      ],
      stubs: {},
    });
    bus.set('engineCore', 'engine.rpm', 800);
    expect(() => {
      bus.set('ignition', 'engine.rpm', 1);
    }).toThrow(/§28/);
    expect(() => {
      bus.set('engineCore', 'ignition.spark', 1);
    }).toThrow(/§28/);
    bus.commit();
    expect(bus.get('engine.rpm')).toBe(800);
  });

  it('escribir una señal sin dueño declarado lanza', () => {
    const bus = createVehicleBus({ signals: [{ id: 'engine.rpm', owner: 'engineCore' }], stubs: {} });
    expect(() => {
      bus.set('engineCore', 'no.declarada', 1);
    }).toThrow(/§28/);
  });

  it('una señal con `owner: null` cae al stub ideal', () => {
    const bus = createVehicleBus({
      signals: [{ id: 'vehicle.speed', owner: null }],
      stubs: { 'vehicle.speed': (p) => Number(p['vehicleSpeedKmh'] ?? 0) },
    });
    bus.bindParams({ vehicleSpeedKmh: 42 });
    expect(bus.get('vehicle.speed')).toBe(42);
  });

  it('same-step se lee apenas se escribe (fase, §5.2)', () => {
    const bus = createVehicleBus({
      signals: [{ id: 'engine.crankAngle', owner: 'fourStroke', latency: 'same-step' }],
      stubs: {},
    });
    bus.set('fourStroke', 'engine.crankAngle', 12);
    expect(bus.get('engine.crankAngle')).toBe(12);
  });

  it('el controlador de cierre del bus sigue funcionando (avanza stubs con estado)', () => {
    let value = 0;
    const bus = createVehicleBus({
      signals: [],
      stubs: {
        counter: {
          step(dt: number): void {
            value += dt;
          },
          get(): number {
            return value;
          },
        },
      },
    });
    const controller = createLabBusController('vehicleBus', bus);
    controller.update(context());
    expect(bus.get('counter')).toBeCloseTo(0.001, 9);
  });
});
