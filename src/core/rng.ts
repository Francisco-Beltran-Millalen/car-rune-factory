// Generador pseudoaleatorio con semilla (§3). Nunca usar Math.random en modelos.

export interface Rng {
  next(): number;
  range(min: number, max: number): number;
  int(min: number, maxInclusive: number): number;
  pick<T>(arr: readonly T[]): T;
  chance(p: number): boolean;
}

/** @returns valores en [0, 1) */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Helpers sobre un generador. */
export function createRng(seed = 1): Rng {
  const next = mulberry32(seed);
  return {
    next,
    range: (min, max) => min + (max - min) * next(),
    int: (min, maxInclusive) =>
      min + Math.floor(next() * (maxInclusive - min + 1)),
    pick: <T,>(arr: readonly T[]): T => {
      const value = arr[Math.floor(next() * arr.length)];
      if (value === undefined) {
        throw new Error('invariante: rng.pick con arreglo vacío');
      }
      return value;
    },
    chance: (p) => next() < p,
  };
}
