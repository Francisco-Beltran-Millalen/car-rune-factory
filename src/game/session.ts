// Sesión de simulación desacoplada del shell (CONTRATOS.md §6.1).
// Pura, testeable en Node sin DOM (§1).

import { createRecorder } from '../core/history.ts';
import { createLoop } from '../core/loop.ts';
import type { Model } from '../core/types.ts';
import type { Session, SessionOptions } from './types.ts';

export function createSession<M extends Model>({
  createModel,
  readouts = [],
  driver = 'raf',
  raf,
  caf,
}: SessionOptions<M>): Session<M> {
  const model = createModel();
  const recorder = createRecorder(readouts);
  const listeners = new Set<(simDt: number, steps: number) => void>();

  function onFrame(simDt: number, steps: number): void {
    recorder.sample(model);
    for (const cb of listeners) {
      cb(simDt, steps);
    }
  }

  const defaultRaf =
    typeof requestAnimationFrame !== 'undefined'
      ? (cb: FrameRequestCallback): number => requestAnimationFrame(cb)
      : (): number => 0;
  const defaultCaf =
    typeof cancelAnimationFrame !== 'undefined'
      ? (id: number): void => {
          cancelAnimationFrame(id);
        }
      : (): void => {};

  const loop = createLoop({
    model,
    onFrame,
    raf: raf ?? defaultRaf,
    caf: caf ?? defaultCaf,
  });

  return {
    model,
    loop,
    recorder,
    tick(realDt): number {
      return loop.tick(realDt);
    },
    onFrame(cb): () => void {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    start(): void {
      if (driver !== 'external') {
        loop.start();
      }
    },
    stop(): void {
      loop.stop();
    },
    reset(): void {
      model.reset();
      recorder.clear();
    },
    destroy(): void {
      loop.destroy();
      listeners.clear();
    },
  };
}
