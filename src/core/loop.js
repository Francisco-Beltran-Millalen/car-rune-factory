// Bucle de paso fijo (§4): la física avanza en pasos de fixedDt sin importar el framerate.

import { clamp } from './math.js';

export const TIME_SCALES = [0.01, 0.05, 0.25, 1, 2, 4];
const MAX_FRAME_DT = 0.1;
const EPS = 1e-9; // evita perder un paso por redondeo (0.02 / 0.001 → 19,999…)

/**
 * @param {Object} opts
 * @param {import('./types.js').Model} opts.model
 * @param {number} [opts.fixedDt]
 * @param {number} [opts.maxStepsPerFrame]
 * @param {(simDt:number, steps:number)=>void} [opts.onFrame]
 * @param {(cb:FrameRequestCallback)=>number} [opts.raf]  Inyectable para tests.
 * @param {(id:number)=>void} [opts.caf]
 */
export function createLoop({
  model,
  fixedDt = 0.001,
  maxStepsPerFrame = 4000,
  onFrame = () => {},
  raf = (cb) => requestAnimationFrame(cb),
  caf = (id) => cancelAnimationFrame(id),
}) {
  let acc = 0;
  let timeScale = 1;
  let paused = false;
  let running = false;
  let rafId = 0;
  let last = null;

  /** Avanza un frame de `realDt` segundos reales. Devuelve los pasos dados. */
  function tick(realDt) {
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

  function frame(ts) {
    if (!running) return;
    const realDt = last === null ? 0 : (ts - last) / 1000;
    last = ts;
    tick(realDt);
    rafId = raf(frame);
  }

  return {
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
      timeScale = clamp(x, TIME_SCALES[0], TIME_SCALES[TIME_SCALES.length - 1]);
    },
    setPaused(b) {
      paused = !!b;
    },
    /** Da exactamente un paso aunque esté en pausa (botón "paso a paso"). */
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
      this.stop();
    },
  };
}
