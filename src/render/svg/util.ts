// Helpers puros y compartidos de los drawers (A7).

import { clamp } from '../../core/math.ts';
import type { PartChannels } from './types.ts';

export function channelNumber(channels: PartChannels, key: string, fallback = 0): number {
  const value = channels[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function channelBool(channels: PartChannels, key: string): boolean {
  return channels[key] === true;
}

export function channelString(channels: PartChannels, key: string, fallback = ''): string {
  const value = channels[key];
  return typeof value === 'string' ? value : fallback;
}

/** Opacidad del fluido en una tubería según su presión (bar, fuel.md §7). */
export function pressureOpacity(p: number): string {
  return (0.18 + 0.62 * clamp(p / 4, 0, 1)).toFixed(2);
}

/** Puntos de un resorte entre `yTop` y `yBottom` (regulador de combustible). */
export function springPoints(
  x: number,
  yTop: number,
  yBottom: number,
  coils = 6,
  amp = 9,
): string {
  const pts: [number, number][] = [[x, yTop]];
  const step = (yBottom - yTop) / (coils * 2);
  for (let i = 1; i < coils * 2; i++) pts.push([x + (i % 2 ? amp : -amp), yTop + i * step]);
  pts.push([x, yBottom]);
  return pts.map((p) => p.join(',')).join(' ');
}
