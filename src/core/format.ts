// Formato de números para la UI (§1: puro, sin DOM).

/** Formatea un número con decimales fijos y separador decimal con coma. */
export function fmt(v: number, decimals = 1): string {
  if (!Number.isFinite(v)) return '—';
  return v.toFixed(decimals).replace('.', ',');
}
