import { describe, it, expect } from 'vitest';
import { createLoop } from '../../src/core/loop.ts';

function counter() {
  const m = {
    steps: 0,
    time: 0,
    step(dt: number): void {
      m.steps++;
      m.time += dt;
    },
  };
  return m;
}
const noRaf = { raf: () => 0, caf: () => {} };

describe('loop', () => {
  it('da realDt/fixedDt pasos a timeScale 1', () => {
    const model = counter();
    const loop = createLoop({ model, ...noRaf });
    for (let i = 0; i < 60; i++) loop.tick(1 / 60);
    expect(model.steps).toBeGreaterThanOrEqual(999);
    expect(model.steps).toBeLessThanOrEqual(1000);
  });
  it('timeScale escala los pasos', () => {
    const a = counter(), b = counter();
    const la = createLoop({ model: a, ...noRaf });
    const lb = createLoop({ model: b, ...noRaf });
    lb.setTimeScale(0.25);
    for (let i = 0; i < 100; i++) { la.tick(0.016); lb.tick(0.016); }
    expect(b.steps / a.steps).toBeCloseTo(0.25, 2);
  });
  it('limita timeScale al rango permitido', () => {
    const loop = createLoop({ model: counter(), ...noRaf });
    loop.setTimeScale(100);
    expect(loop.timeScale).toBe(4);
    loop.setTimeScale(0);
    expect(loop.timeScale).toBe(0.01);
  });
  it('respeta el tope de pasos por frame y descarta el atraso', () => {
    const model = counter();
    const loop = createLoop({ model, maxStepsPerFrame: 10, ...noRaf });
    loop.tick(0.05);
    expect(model.steps).toBe(10);
    loop.tick(0);
    expect(model.steps).toBe(10);
  });
  it('recorta frames enormes a 0.1 s', () => {
    const model = counter();
    const loop = createLoop({ model, ...noRaf });
    loop.tick(5);
    expect(model.steps).toBeLessThanOrEqual(100);
  });
  it('en pausa no avanza, pero stepOnce sí', () => {
    const model = counter();
    let frames = 0;
    const loop = createLoop({ model, onFrame: () => frames++, ...noRaf });
    loop.setPaused(true);
    loop.tick(0.1);
    expect(model.steps).toBe(0);
    expect(frames).toBe(1);
    loop.stepOnce();
    expect(model.steps).toBe(1);
  });
  it('onFrame recibe el dt simulado', () => {
    const model = counter();
    let got = 0;
    const loop = createLoop({ model, onFrame: (dt) => (got = dt), ...noRaf });
    loop.setTimeScale(2);
    loop.tick(0.01);
    expect(got).toBeCloseTo(0.02, 3);
  });
  it('start/stop usan raf inyectado', () => {
    const cbs: FrameRequestCallback[] = [];
    let cancelled = false;
    const model = counter();
    const loop = createLoop({ model, raf: (cb) => (cbs.push(cb), cbs.length), caf: () => (cancelled = true) });
    loop.start();
    cbs.shift()!(0);
    cbs.shift()!(100);
    expect(model.steps).toBeGreaterThanOrEqual(99);
    loop.stop();
    expect(cancelled).toBe(true);
    expect(loop.running).toBe(false);
  });
});
