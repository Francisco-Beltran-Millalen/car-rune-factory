import { describe, it, expect, vi } from 'vitest';
import type { HistoryReadout } from '../../src/core/history.ts';
import { createSession } from '../../src/game/session.ts';

interface TestState {
  pos: number;
}

interface TestModel {
  params: { speed: number };
  faults: { broken: boolean };
  state: TestState;
  time: number;
  steps: number;
  step(dt: number): void;
  reset(): void;
  actions: Record<string, (...args: unknown[]) => void>;
}

function createTestModel(): TestModel {
  return {
    params: { speed: 10 },
    faults: { broken: false },
    state: { pos: 0 },
    time: 0,
    steps: 0,
    step(dt) {
      this.steps++;
      this.time += dt;
      this.state.pos += this.params.speed * dt;
    },
    reset() {
      this.params.speed = 10;
      this.faults.broken = false;
      this.state.pos = 0;
      this.time = 0;
      this.steps = 0;
    },
    actions: {},
  };
}

describe('session', () => {
  it('tick avanza el modelo y muestrea el historial', () => {
    const readouts: HistoryReadout<TestState>[] = [{ id: 'pos', get: (s) => s.pos, history: true }];
    const session = createSession({
      createModel: createTestModel,
      readouts,
      driver: 'external',
    });

    const steps = session.tick(0.05); // 50 ms a dt=1ms -> 50 pasos
    expect(steps).toBe(50);
    expect(session.model.time).toBeCloseTo(0.05, 3);
    expect(session.model.state.pos).toBeCloseTo(0.5, 3);

    const buf = session.recorder.series.get('pos')!;
    expect(buf.size).toBeGreaterThan(0);
  });

  it('driver external nunca invoca requestAnimationFrame en start', () => {
    const rafSpy = vi.fn();
    const session = createSession({
      createModel: createTestModel,
      driver: 'external',
      raf: rafSpy,
    });

    session.start();
    expect(rafSpy).not.toHaveBeenCalled();

    session.tick(0.01);
    expect(session.model.steps).toBe(10);
    session.stop();
  });

  it('driver raf usa el loop normalmente', () => {
    const rafCbs: FrameRequestCallback[] = [];
    const rafSpy = vi.fn((cb: FrameRequestCallback) => {
      rafCbs.push(cb);
      return 1;
    });
    const cafSpy = vi.fn();

    const session = createSession({
      createModel: createTestModel,
      driver: 'raf',
      raf: rafSpy,
      caf: cafSpy,
    });

    session.start();
    expect(rafSpy).toHaveBeenCalled();
    expect(session.loop.running).toBe(true);

    const cb = rafCbs[0];
    if (cb) {
      cb(0);
      cb(100);
    }
    expect(session.model.steps).toBeGreaterThanOrEqual(99);

    session.stop();
    expect(cafSpy).toHaveBeenCalled();
    expect(session.loop.running).toBe(false);
  });

  it('onFrame notifica suscriptores y permite desuscribirse', () => {
    const session = createSession({
      createModel: createTestModel,
      driver: 'external',
    });

    const calls: { simDt: number; steps: number }[] = [];
    const unsub = session.onFrame((simDt, steps) => {
      calls.push({ simDt, steps });
    });

    session.tick(0.02);
    expect(calls.length).toBe(1);
    expect(calls[0]!.steps).toBe(20);

    unsub();
    session.tick(0.01);
    expect(calls.length).toBe(1);
  });

  it('reset restaura el modelo y limpia el historial', () => {
    const readouts: HistoryReadout<TestState>[] = [{ id: 'pos', get: (s) => s.pos, history: true }];
    const session = createSession({
      createModel: createTestModel,
      readouts,
      driver: 'external',
    });

    session.tick(0.05);
    expect(session.recorder.series.get('pos')!.size).toBeGreaterThan(0);
    expect(session.model.state.pos).toBeGreaterThan(0);

    session.reset();
    expect(session.model.state.pos).toBe(0);
    expect(session.model.time).toBe(0);
    expect(session.recorder.series.get('pos')!.size).toBe(0);
  });

  it('destroy detiene el loop y desconecta listeners', () => {
    const session = createSession({
      createModel: createTestModel,
      driver: 'external',
    });

    let count = 0;
    session.onFrame(() => count++);

    session.destroy();
    session.tick(0.01);
    expect(count).toBe(0);
  });
});
