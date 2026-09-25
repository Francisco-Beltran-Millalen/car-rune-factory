// NaN → min: sin esto un NaN cruza todos los clamp y contamina la física (§6).
export const clamp = (v: number, min: number, max: number): number =>
  v < min || Number.isNaN(v) ? min : v > max ? max : v;

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Inversa de lerp, limitada a [0, 1]. */
export const unlerp = (a: number, b: number, v: number): number =>
  a === b ? 0 : clamp((v - a) / (b - a), 0, 1);

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = unlerp(edge0, edge1, x);
  return t * t * (3 - 2 * t);
}

/** Acerca `current` a `target` como mucho `maxDelta`. */
export function approach(
  current: number,
  target: number,
  maxDelta: number,
): number {
  if (current < target) return Math.min(current + maxDelta, target);
  return Math.max(current - maxDelta, target);
}

/** Filtro exponencial de primer orden con constante de tiempo tau (s). */
export function expSmooth(
  current: number,
  target: number,
  dt: number,
  tau: number,
): number {
  if (tau <= 0) return target;
  return current + (target - current) * (1 - Math.exp(-dt / tau));
}

/** Módulo positivo: wrap(-10, 360) === 350. */
export function wrap(v: number, period: number): number {
  const r = v % period;
  return r < 0 ? r + period : r;
}

export const wrapDeg = (deg: number): number => wrap(deg, 360);

/** Reemplaza NaN/Infinity por `fallback` (red de seguridad, §6). */
export const finite = (v: number, fallback = 0): number =>
  Number.isFinite(v) ? v : fallback;
