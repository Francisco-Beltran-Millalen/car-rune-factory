import { describe, it, expect } from 'vitest';
import { clamp, lerp, unlerp, smoothstep, approach, expSmooth, wrap, wrapDeg, finite } from '../../src/core/math.ts';

describe('math', () => {
  it('clamp/lerp/unlerp', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(clamp(NaN, 0, 3)).toBe(0);
    expect(lerp(0, 10, 0.25)).toBe(2.5);
    expect(unlerp(0, 10, 5)).toBe(0.5);
    expect(unlerp(0, 10, 50)).toBe(1);
    expect(unlerp(3, 3, 3)).toBe(0);
  });
  it('smoothstep', () => {
    expect(smoothstep(0, 1, 0.5)).toBeCloseTo(0.5);
    expect(smoothstep(0, 1, 2)).toBe(1);
  });
  it('approach no se pasa', () => {
    expect(approach(0, 1, 0.3)).toBeCloseTo(0.3);
    expect(approach(0.9, 1, 0.3)).toBe(1);
    expect(approach(1, 0, 0.3)).toBeCloseTo(0.7);
  });
  it('expSmooth llega al 63 % en tau', () => {
    let v = 0;
    for (let i = 0; i < 1000; i++) v = expSmooth(v, 1, 0.001, 1);
    expect(v).toBeCloseTo(1 - Math.exp(-1), 3);
  });
  it('wrap', () => {
    expect(wrap(-10, 360)).toBe(350);
    expect(wrap(725, 720)).toBe(5);
    expect(wrapDeg(360)).toBe(0);
  });
  it('finite', () => {
    expect(finite(NaN, 2)).toBe(2);
    expect(finite(Infinity)).toBe(0);
    expect(finite(3)).toBe(3);
  });
});
