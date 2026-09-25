import { describe, it, expect } from 'vitest';
import { mulberry32, createRng } from '../../src/core/rng.ts';

describe('rng', () => {
  it('es determinista con la misma semilla', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 100; i++) expect(a()).toBe(b());
  });
  it('semillas distintas dan secuencias distintas', () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });
  it('queda en [0,1) y cubre el rango', () => {
    const r = mulberry32(7);
    let min = 1, max = 0, sum = 0;
    for (let i = 0; i < 10000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      min = Math.min(min, v); max = Math.max(max, v); sum += v;
    }
    expect(min).toBeLessThan(0.01);
    expect(max).toBeGreaterThan(0.99);
    expect(sum / 10000).toBeCloseTo(0.5, 1);
  });
  it('helpers', () => {
    const r = createRng(3);
    for (let i = 0; i < 100; i++) {
      const n = r.int(1, 3);
      expect([1, 2, 3]).toContain(n);
      const x = r.range(5, 6);
      expect(x).toBeGreaterThanOrEqual(5);
      expect(x).toBeLessThan(6);
    }
    expect(['a', 'b']).toContain(r.pick(['a', 'b']));
  });
});
