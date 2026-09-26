// Plan A11 §2.1: contrato del bus de señales, latencia de un paso, same-step,
// stubs dinámicos, stub de fase, dueño único y snapshot.
import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/core/rng.ts';
import type { ControllerContext } from '../../src/sim/controllers/base.ts';
import { createLabBus, createLabBusController } from '../../src/sim/signals/bus.ts';
import {
  airMassFlowStub,
  createPhaseStub,
  createSignalStubs,
  mapStub,
} from '../../src/sim/signals/stubs.ts';

function context(params: Record<string, number | boolean | string>): ControllerContext {
  return {
    dt: 0.001,
    read: () => 0,
    params,
    faults: {},
    elements: {},
    rng: createRng(1),
  };
}

describe('bus de señales (A11 §2.1)', () => {
  it('una señal publicada se lee con un paso de retraso', () => {
    const bus = createLabBus({ owner: 'sys', publishes: ['a'], stubs: {} });
    bus.set('sys', 'a', 5);
    expect(bus.get('a')).toBe(0);
    bus.commit();
    expect(bus.get('a')).toBe(5);
  });

  it('sameStep se lee apenas se escribe', () => {
    const bus = createLabBus({
      owner: 'sys',
      publishes: ['phase'],
      stubs: {},
      sameStep: ['phase'],
    });
    bus.set('sys', 'phase', 12);
    expect(bus.get('phase')).toBe(12);
    bus.commit();
    expect(bus.get('phase')).toBe(12);
  });

  it('los stubs dinámicos siguen a los params', () => {
    const bus = createLabBus({
      owner: 'sys',
      publishes: [],
      stubs: { 'intake.map': mapStub },
    });
    bus.bindParams({ throttle: 0 });
    expect(bus.get('intake.map')).toBeCloseTo(-0.65, 9);
    bus.bindParams({ throttle: 1 });
    expect(bus.get('intake.map')).toBeCloseTo(0, 9);
    expect(airMassFlowStub({ rpm: 800, throttle: 0 })).toBeCloseTo(16.5, 0);
  });

  it('el stub de fase avanza 3,6° por paso a 600 rpm', () => {
    const phase = createPhaseStub();
    phase.step(0.001, { rpm: 600 });
    expect(phase.get()).toBeCloseTo(3.6, 9);
    phase.step(0.001, { rpm: 600 });
    expect(phase.get()).toBeCloseTo(7.2, 9);
    expect(phase.cam({ camOffset: 7.2 })).toBeCloseTo(0, 9);
  });

  it('el controlador labBus cierra el paso y avanza los stubs', () => {
    const stubs = createSignalStubs();
    const bus = createLabBus({
      owner: 'sys',
      publishes: ['out'],
      stubs,
      sameStep: ['out'],
    });
    const controller = createLabBusController('labBus', bus);
    controller.update(context({ rpm: 600 }));
    expect(bus.get('engine.crankAngle')).toBeCloseTo(3.6, 9);
    bus.set('sys', 'out', 1);
    controller.update(context({ rpm: 600 }));
    expect(bus.get('engine.crankAngle')).toBeCloseTo(7.2, 9);
    expect(bus.get('out')).toBe(1);
  });

  it('escribir con otro dueño lanza (§28)', () => {
    const bus = createLabBus({ owner: 'sys', publishes: ['a'], stubs: {} });
    expect(() => {
      bus.set('otro', 'a', 1);
    }).toThrow(/§28/);
  });

  it('una señal desconocida vale 0; en modo estricto lanza', () => {
    const bus = createLabBus({ owner: 'sys', publishes: [], stubs: {} });
    expect(bus.get('no.existe')).toBe(0);
    const strict = createLabBus({ owner: 'sys', publishes: [], stubs: {}, strict: true });
    expect(() => strict.get('no.existe')).toThrow(/desconocida/);
  });

  it('snapshot es una copia estable', () => {
    const bus = createLabBus({ owner: 'sys', publishes: ['a'], stubs: {} });
    bus.set('sys', 'a', 3);
    const snap = bus.snapshot();
    bus.set('sys', 'a', 9);
    expect(snap['a']).toBe(3);
    expect(bus.snapshot()['a']).toBe(9);
  });
});
