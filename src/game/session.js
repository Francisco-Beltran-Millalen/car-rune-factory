// Sesión de simulación desacoplada del shell (CONTRATOS.md §6.1).
// Pura, testeable en Node sin DOM (§1).

import { createLoop } from '../core/loop.js';
import { createRecorder } from '../core/history.js';

/**
 * @param {Object} opts
 * @param {() => import('../core/types.js').Model} opts.createModel
 * @param {import('../core/types.js').ReadoutSpec[]} [opts.readouts]
 * @param {'raf'|'external'} [opts.driver]
 * @param {(cb: FrameRequestCallback) => number} [opts.raf]
 * @param {(id: number) => void} [opts.caf]
 * @returns {import('./types.js').Session}
 */
export function createSession({
  createModel,
  readouts = [],
  driver = 'raf',
  raf,
  caf,
}) {
  const model = createModel();
  const recorder = createRecorder(readouts);
  const listeners = new Set();

  function onFrame(simDt, steps) {
    recorder.sample(model);
    for (const cb of listeners) {
      cb(simDt, steps);
    }
  }

  const defaultRaf = typeof requestAnimationFrame !== 'undefined' ? (cb) => requestAnimationFrame(cb) : () => 0;
  const defaultCaf = typeof cancelAnimationFrame !== 'undefined' ? (id) => cancelAnimationFrame(id) : () => {};

  const loop = createLoop({
    model,
    onFrame,
    raf: raf || defaultRaf,
    caf: caf || defaultCaf,
  });

  return {
    model,
    loop,
    recorder,
    tick(realDt) {
      return loop.tick(realDt);
    },
    onFrame(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    start() {
      if (driver !== 'external') {
        loop.start();
      }
    },
    stop() {
      loop.stop();
    },
    reset() {
      model.reset();
      recorder.clear();
    },
    destroy() {
      loop.destroy();
      listeners.clear();
    },
  };
}
