// Formato de números para la UI (§1: puro, sin DOM).

/** Formatea un número con decimales fijos y separador decimal con coma. */
export function fmt(v, decimals = 1) {
  if (!Number.isFinite(v)) return '—';
  return v.toFixed(decimals).replace('.', ',');
}
