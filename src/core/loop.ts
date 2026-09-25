// Bucle de paso fijo (§4): la física avanza en pasos de fixedDt sin importar el framerate.

import { clamp } from './math.ts';

const TIME_SCALE_MIN = 0.01;
const TIME_SCALE_MAX = 4;
export const TIME_SCALES: readonly number[] = [
  TIME_SCALE_MIN,
  0.05,
  0.25,
  1,
  2,
  TIME_SCALE_MAX,
];
const MAX_FRAME_DT = 0.1;
const EPS = 1e-9; // evita perder un paso por redondeo (0.02 / 0.001 → 19,999…)

/** Lo único que el loop necesita del modelo: avanzar un paso. */
export interface SteppableModel {
  step(dt: number): void;
}

export interface LoopOptions<M extends SteppableModel = SteppableModel> {
  model: M;
  fixedDt?: number;
  maxStepsPerFrame?: number;
  onFrame?: (simDt: number, steps: number) => void;
  /** Inyectables para tests (D9 del plan de juego). */
  raf?: (cb: FrameRequestCallback) => number;
  caf?: (id: number) => void;
}

export interface Loop {
  tick(realDt: number): number;
  start(): void;
  stop(): void;
  setTimeScale(x: number): void;
  setPaused(b: boolean): void;
  /** Da exactamente un paso aunque esté en pausa (botón "paso a paso"). */
  stepOnce(): void;
  readonly timeScale: number;
  readonly paused: boolean;
  readonly running: boolean;
  destroy(): void;
}

export function createLoop<M extends SteppableModel = SteppableModel>({
  model,
  fixedDt = 0.001,
  maxStepsPerFrame = 4000,
  onFrame = () => {},
  raf = (cb) => requestAnimationFrame(cb),
  caf = (id) => {
    cancelAnimationFrame(id);
  },
}: LoopOptions<M>): Loop {
  let acc = 0;
  let timeScale = 1;
  let paused = false;
  let running = false;
  let rafId = 0;
  let last: number | null = null;

  /** Avanza un frame de `realDt` segundos reales. Devuelve los pasos dados. */
  function tick(realDt: number): number {
    const dt = clamp(realDt, 0, MAX_FRAME_DT);
    let steps = 0;
    let simDt = 0;
    if (!paused) {
      acc += dt * timeScale;
      while (acc >= fixedDt - EPS && steps < maxStepsPerFrame) {
        model.step(fixedDt);
        acc -= fixedDt;
        if (acc < 0) acc = 0;
        steps++;
      }
      // Si se alcanzó el tope se descarta el atraso: mejor ir lento que en espiral.
      if (steps >= maxStepsPerFrame) acc = 0;
      simDt = steps * fixedDt;
    }
    onFrame(simDt, steps);
    return steps;
  }

  function frame(ts: number): void {
    if (!running) return;
    const realDt = last === null ? 0 : (ts - last) / 1000;
    last = ts;
    tick(realDt);
    rafId = raf(frame);
  }

  const loop: Loop = {
    tick,
    start() {
      if (running) return;
      running = true;
      last = null;
      rafId = raf(frame);
    },
    stop() {
      running = false;
      caf(rafId);
    },
    setTimeScale(x) {
      timeScale = clamp(x, TIME_SCALE_MIN, TIME_SCALE_MAX);
    },
    setPaused(b) {
      paused = b;
    },
    stepOnce() {
      model.step(fixedDt);
      onFrame(fixedDt, 1);
    },
    get timeScale() {
      return timeScale;
    },
    get paused() {
      return paused;
    },
    get running() {
      return running;
    },
    destroy() {
      loop.stop();
    },
  };
  return loop;
}
