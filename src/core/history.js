// Series temporales para las sparklines de las lecturas.

/** Buffer circular de números de tamaño fijo. */
export function createRingBuffer(capacity) {
  const data = new Float64Array(capacity);
  let start = 0;
  let size = 0;
  return {
    push(v) {
      const i = (start + size) % capacity;
      data[i] = v;
      if (size < capacity) size++;
      else start = (start + 1) % capacity;
    },
    /** Copia en orden cronológico (del más viejo al más nuevo). */
    toArray() {
      const out = new Array(size);
      for (let k = 0; k < size; k++) out[k] = data[(start + k) % capacity];
      return out;
    },
    clear() {
      start = 0;
      size = 0;
    },
    get size() {
      return size;
    },
    get capacity() {
      return capacity;
    },
    last() {
      return size ? data[(start + size - 1) % capacity] : undefined;
    },
  };
}

/**
 * Muestrea las lecturas con history:true cada `interval` s de tiempo simulado.
 * @param {import('./types.js').ReadoutSpec[]} readouts
 */
export function createRecorder(readouts, { interval = 0.05, capacity = 400 } = {}) {
  const series = new Map();
  for (const r of readouts) if (r.history) series.set(r.id, createRingBuffer(capacity));
  let nextSample = 0;

  return {
    series,
    /** Llamar después de avanzar el modelo; toma las muestras que correspondan. */
    sample(model) {
      if (model.time < nextSample - interval) nextSample = 0; // el modelo se reinició
      while (model.time >= nextSample) {
        for (const r of readouts) {
          const buf = series.get(r.id);
          if (buf) buf.push(Number(r.get(model.state)) || 0);
        }
        nextSample += interval;
        // Con timeScale alto no se rellena el pasado muestra por muestra.
        if (model.time - nextSample > interval * 4) nextSample = model.time + interval;
      }
    },
    clear() {
      for (const b of series.values()) b.clear();
      nextSample = 0;
    },
  };
}
