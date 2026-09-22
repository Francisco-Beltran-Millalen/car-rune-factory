export const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);

export const lerp = (a, b, t) => a + (b - a) * t;

/** Inversa de lerp, limitada a [0, 1]. */
export const unlerp = (a, b, v) => (a === b ? 0 : clamp((v - a) / (b - a), 0, 1));

export function smoothstep(edge0, edge1, x) {
  const t = unlerp(edge0, edge1, x);
  return t * t * (3 - 2 * t);
}

/** Acerca `current` a `target` como mucho `maxDelta`. */
export function approach(current, target, maxDelta) {
  if (current < target) return Math.min(current + maxDelta, target);
  return Math.max(current - maxDelta, target);
}

/** Filtro exponencial de primer orden con constante de tiempo tau (s). */
export function expSmooth(current, target, dt, tau) {
  if (tau <= 0) return target;
  return current + (target - current) * (1 - Math.exp(-dt / tau));
}

/** Módulo positivo: wrap(-10, 360) === 350. */
export function wrap(v, period) {
  const r = v % period;
  return r < 0 ? r + period : r;
}

export const wrapDeg = (deg) => wrap(deg, 360);

/** Reemplaza NaN/Infinity por `fallback` (red de seguridad, §6). */
export const finite = (v, fallback = 0) => (Number.isFinite(v) ? v : fallback);
