// Series temporales para las sparklines de las lecturas.

/** Buffer circular de números de tamaño fijo. */
export interface RingBuffer {
  push(v: number): void;
  /** Copia en orden cronológico (del más viejo al más nuevo). */
  toArray(): number[];
  clear(): void;
  readonly size: number;
  readonly capacity: number;
  last(): number | undefined;
}

export function createRingBuffer(capacity: number): RingBuffer {
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
    toArray() {
      const out = new Array<number>(size);
      for (let k = 0; k < size; k++) out[k] = data[(start + k) % capacity] ?? 0;
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

/** Lo mínimo que el recorder necesita de una lectura (CONTRATOS 4.4). */
export interface HistoryReadout<S extends object = object> {
  id: string;
  get(state: Readonly<S>): number;
  history?: boolean;
}

/** Lo mínimo que el recorder necesita de un modelo. */
export interface SampledModel<S extends object = object> {
  readonly time: number;
  readonly state: Readonly<S>;
}

export interface RecorderOptions {
  interval?: number;
  capacity?: number;
}

export interface Recorder<S extends object = object> {
  readonly series: Map<string, RingBuffer>;
  /** Llamar después de avanzar el modelo; toma las muestras que correspondan. */
  sample(model: SampledModel<S>): void;
  clear(): void;
}

/** Muestrea las lecturas con history:true cada `interval` s de tiempo simulado. */
export function createRecorder<S extends object>(
  readouts: readonly HistoryReadout<S>[],
  { interval = 0.05, capacity = 400 }: RecorderOptions = {},
): Recorder<S> {
  const series = new Map<string, RingBuffer>();
  for (const r of readouts) {
    if (r.history) series.set(r.id, createRingBuffer(capacity));
  }
  let nextSample = 0;

  return {
    series,
    sample(model) {
      if (model.time < nextSample - interval) nextSample = 0; // el modelo se reinició
      while (model.time >= nextSample) {
        for (const r of readouts) {
          const buf = series.get(r.id);
          if (buf) buf.push(r.get(model.state) || 0);
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
