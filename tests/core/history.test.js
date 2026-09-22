import { describe, it, expect } from 'vitest';
import { createRingBuffer, createRecorder } from '../../src/core/history.js';

describe('ring buffer', () => {
  it('guarda en orden y descarta lo más viejo', () => {
    const b = createRingBuffer(3);
    [1, 2].forEach(b.push);
    expect(b.toArray()).toEqual([1, 2]);
    [3, 4, 5].forEach(b.push);
    expect(b.toArray()).toEqual([3, 4, 5]);
    expect(b.size).toBe(3);
    expect(b.last()).toBe(5);
    b.clear();
    expect(b.toArray()).toEqual([]);
  });
});

describe('recorder', () => {
  const readouts = [
    { id: 'p', get: (s) => s.p, history: true },
    { id: 'q', get: (s) => s.q },
  ];
  it('muestrea cada interval de tiempo simulado, sólo las lecturas con history', () => {
    const model = { time: 0, state: { p: 0, q: 0 } };
    const rec = createRecorder(readouts, { interval: 0.05, capacity: 100 });
    expect(rec.series.has('q')).toBe(false);
    for (let i = 0; i <= 1000; i++) {
      model.time = i * 0.001;
      model.state.p = i;
      rec.sample(model);
    }
    const n = rec.series.get('p').size;
    expect(n).toBeGreaterThanOrEqual(20);
    expect(n).toBeLessThanOrEqual(21);
  });
  it('detecta un reinicio del modelo', () => {
    const model = { time: 5, state: { p: 1 } };
    const rec = createRecorder(readouts);
    rec.sample(model);
    model.time = 0;
    rec.sample(model);
    model.time = 0.06;
    rec.sample(model);
    expect(rec.series.get('p').size).toBeGreaterThan(1);
  });
});
