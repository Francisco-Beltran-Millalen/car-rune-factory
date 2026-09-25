// Helpers compartidos de la biblioteca de elementos. Puro (§1).

/** ε de regularización de las raíces cerca de 0 (bar). */
export const EPS_P = 1e-4;

/** Lee un control numérico con fallback si no está o no es finito. */
export function controlNumber(value: number | boolean | undefined, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** Lee un control booleano (`true` sólo si vale `true`). */
export function controlFlag(value: number | boolean | undefined): boolean {
  return value === true;
}

/** √(p⁺) regularizada: `p/√(p+ε)` para p > 0, 0 para p ≤ 0. */
export function smoothSqrt(p: number, eps = EPS_P): number {
  return p > 0 ? p / Math.sqrt(p + eps) : 0;
}

/** Derivada de `smoothSqrt` (finita en 0⁺, vale 0 para p ≤ 0). */
export function smoothSqrtSlope(p: number, eps = EPS_P): number {
  if (p <= 0) return 0;
  const s = p + eps;
  return (p / 2 + eps) / Math.pow(s, 1.5);
}

/** `max(0, x)` suavizado: `x·smoothstep(0, ε, x)`; igual a `x` para x ≥ ε. */
export function softRelu(x: number, eps: number): number {
  if (x <= 0) return 0;
  if (x >= eps) return x;
  const t = x / eps;
  return x * t * t * (3 - 2 * t);
}

/** Derivada de `softRelu`. */
export function softReluSlope(x: number, eps: number): number {
  if (x <= 0) return 0;
  if (x >= eps) return 1;
  const t = x / eps;
  return t * t * (3 - 2 * t) + (x * 6 * t * (1 - t)) / eps;
}

/** Elementos sin estado interno: no hay nada que confirmar tras converger. */
export function noCommit(): void {
  // A propósito: la ley del elemento no guarda estado entre pasos.
}

/** Elementos sin flujo propio (nodo fijo, capacidad): su efecto no es un flujo. */
export function noEval(): void {
  // A propósito: el efecto está en `fixed` o en `capacitance`.
}
