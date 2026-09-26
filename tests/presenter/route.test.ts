// A7: la ruta automática de enlaces del renderer (función pura).
import { describe, expect, it } from 'vitest';
import { autoRoute } from '../../src/render/svg/route.ts';

describe('autoRoute', () => {
  it('usa una recta si los puertos están alineados', () => {
    expect(autoRoute([10, 20], [10, 80])).toEqual([
      [10, 20],
      [10, 80],
    ]);
    expect(autoRoute([10, 20], [90, 20])).toEqual([
      [10, 20],
      [90, 20],
    ]);
  });

  it('usa un codo en L, priorizando el tramo más largo', () => {
    expect(autoRoute([0, 0], [100, 40])).toEqual([
      [0, 0],
      [100, 0],
      [100, 40],
    ]);
    expect(autoRoute([0, 0], [40, 100])).toEqual([
      [0, 0],
      [0, 100],
      [40, 100],
    ]);
  });
});
