// Ruta automática de una conexión (A7, P23 §8.5): recta o codo en L. Puro.

import type { Point } from '../../core/svg.ts';

/** Ruta ortogonal mínima entre dos puertos: recta si está alineada, si no una L. */
export function autoRoute(from: Point, to: Point): Point[] {
  const [x0, y0] = from;
  const [x1, y1] = to;
  if (Math.abs(x1 - x0) < 1 || Math.abs(y1 - y0) < 1) return [from, to];
  const corner: Point = Math.abs(x1 - x0) >= Math.abs(y1 - y0) ? [x1, y0] : [x0, y1];
  return [from, corner, to];
}
