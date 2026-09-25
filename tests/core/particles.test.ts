import { describe, it, expect } from 'vitest';
import { hash01, particleOffsets } from '../../src/core/particles.ts';
import { gaugeAngle } from '../../src/core/svg.ts';

describe('particles (parte pura)', () => {
  it('hash01 es determinista y está en [0,1)', () => {
    for (let i = 0; i < 1000; i++) {
      const h = hash01(i);
      expect(h).toBe(hash01(i));
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(1);
    }
  });
  it('hash01 reparte ~uniforme (la densidad oculta la fracción correcta)', () => {
    let below = 0;
    for (let i = 0; i < 2000; i++) if (hash01(i) < 0.3) below++;
    expect(below / 2000).toBeCloseTo(0.3, 1);
  });
  it('particleOffsets espacia uniformemente con fase', () => {
    expect(particleOffsets(3, 10, 2)).toEqual([2, 12, 22]);
  });
});

describe('gaugeAngle', () => {
  it('mapea min/medio/max a -120/0/120 y limita', () => {
    expect(gaugeAngle(0, 0, 8)).toBe(-120);
    expect(gaugeAngle(4, 0, 8)).toBe(0);
    expect(gaugeAngle(8, 0, 8)).toBe(120);
    expect(gaugeAngle(99, 0, 8)).toBe(120);
  });
});
