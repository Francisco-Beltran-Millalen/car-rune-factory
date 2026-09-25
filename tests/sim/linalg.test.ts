// Criterios de A4 (P23 §9): matriz singular detectada y resolución con pivoteo.
import { describe, expect, it } from 'vitest';
import { solveDense } from '../../src/sim/solver/linalg.ts';

describe('linalg — solveDense (§8.1)', () => {
  it('resuelve un 2×2 conocido', () => {
    const A = new Float64Array([2, 1, 1, 3]);
    const b = new Float64Array([5, 10]);
    expect(solveDense(A, b, 2)).toBe(true);
    expect(b[0]).toBeCloseTo(1, 12);
    expect(b[1]).toBeCloseTo(3, 12);
  });

  it('pivotea cuando la diagonal es cero', () => {
    const A = new Float64Array([0, 1, 1, 0]);
    const b = new Float64Array([2, 3]);
    expect(solveDense(A, b, 2)).toBe(true);
    expect(b[0]).toBeCloseTo(3, 12);
    expect(b[1]).toBeCloseTo(2, 12);
  });

  it('resuelve un 3×3 conocido', () => {
    const A = new Float64Array([4, 1, 0, 1, 3, 1, 0, 1, 2]);
    const b = new Float64Array([1, 2, 3]);
    expect(solveDense(A, b, 3)).toBe(true);
    expect(b[0]).toBeCloseTo(2 / 9, 12);
    expect(b[1]).toBeCloseTo(1 / 9, 12);
    expect(b[2]).toBeCloseTo(13 / 9, 12);
  });

  it('detecta una matriz singular', () => {
    const A = new Float64Array([1, 2, 2, 4]);
    const b = new Float64Array([1, 2]);
    expect(solveDense(A, b, 2)).toBe(false);
  });

  it('detecta un pivote bajo 1e-14', () => {
    const A = new Float64Array([1e-15, 0, 0, 1]);
    const b = new Float64Array([1, 1]);
    expect(solveDense(A, b, 2)).toBe(false);
  });

  it('rechaza NaN en el pivote en vez de propagarlo', () => {
    const A = new Float64Array([NaN, 0, 0, 1]);
    const b = new Float64Array([1, 1]);
    expect(solveDense(A, b, 2)).toBe(false);
  });

  it('n = 0 no hace nada', () => {
    expect(solveDense(new Float64Array(0), new Float64Array(0), 0)).toBe(true);
  });
});
