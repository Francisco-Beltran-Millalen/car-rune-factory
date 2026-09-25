// Álgebra lineal mínima del solver (§24, P23 §8.1). Puro (§1).

/**
 * Eliminación gaussiana con pivoteo parcial, en su lugar. `A` es n×n fila-mayor
 * y `b` el término independiente; la solución queda en `b` y `A` destruida.
 * Devuelve false si el pivote cae bajo 1e-14 (matriz singular o con NaN/Infinity).
 */
export function solveDense(A: Float64Array, b: Float64Array, n: number): boolean {
  for (let col = 0; col < n; col++) {
    const base = col * n;
    let pivot = col;
    let best = Math.abs(A[base + col] ?? 0);
    for (let row = col + 1; row < n; row++) {
      const v = Math.abs(A[row * n + col] ?? 0);
      if (v > best) {
        best = v;
        pivot = row;
      }
    }
    // `!(best >= …)` también rechaza NaN, que nunca debe llegar acá (§6).
    if (!(best >= 1e-14)) return false;

    if (pivot !== col) {
      const pbase = pivot * n;
      for (let j = col; j < n; j++) {
        const t = A[base + j] ?? 0;
        A[base + j] = A[pbase + j] ?? 0;
        A[pbase + j] = t;
      }
      const tb = b[col] ?? 0;
      b[col] = b[pivot] ?? 0;
      b[pivot] = tb;
    }

    const diag = A[base + col] ?? 0;
    for (let row = col + 1; row < n; row++) {
      const rbase = row * n;
      const f = (A[rbase + col] ?? 0) / diag;
      if (f === 0) continue;
      A[rbase + col] = 0;
      for (let j = col + 1; j < n; j++) {
        A[rbase + j] = (A[rbase + j] ?? 0) - f * (A[base + j] ?? 0);
      }
      b[row] = (b[row] ?? 0) - f * (b[col] ?? 0);
    }
  }

  // Sustitución hacia atrás.
  for (let row = n - 1; row >= 0; row--) {
    const base = row * n;
    let sum = b[row] ?? 0;
    for (let j = row + 1; j < n; j++) {
      sum -= (A[base + j] ?? 0) * (b[j] ?? 0);
    }
    b[row] = sum / (A[base + row] ?? 1);
  }
  return true;
}
