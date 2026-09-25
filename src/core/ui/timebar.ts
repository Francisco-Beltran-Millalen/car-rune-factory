// Barra de tiempo: pausa, paso a paso, velocidad y reinicio.

import { h } from '../dom.ts';
import { fmt } from '../format.ts';
import { TIME_SCALES, type Loop } from '../loop.ts';

const scaleLabel = (s: number): string => `${fmt(s, s < 1 ? 2 : 0)}×`;

export interface Timebar {
  sync(): void;
  setClock(t: number): void;
  setMaxScale(maxScale: number): void;
  destroy(): void;
}

export interface TimebarOptions {
  loop: Loop;
  onReset: () => void;
}

export function createTimebar(container: HTMLElement, { loop, onReset }: TimebarOptions): Timebar {
  const pauseBtn = h('button', {
    type: 'button',
    class: 'btn tb-pause',
    title: 'Pausa (espacio)',
    onclick: () => {
      togglePause();
    },
  });
  const stepBtn = h(
    'button',
    {
      type: 'button',
      class: 'btn',
      title: 'Avanzar 1 ms',
      onclick: () => {
        loop.stepOnce();
      },
    },
    '⏭',
  );
  const scaleBtns = TIME_SCALES.map((s) =>
    h(
      'button',
      {
        type: 'button',
        class: 'seg-btn',
        onclick: () => {
          loop.setTimeScale(s);
          sync();
        },
      },
      scaleLabel(s),
    ),
  );
  const resetBtn = h('button', { type: 'button', class: 'btn', title: 'Reiniciar', onclick: onReset }, '⟲');
  const clock = h('span', { class: 'tb-clock', title: 'Tiempo simulado' });

  container.append(
    h('div', { class: 'timebar' }, pauseBtn, stepBtn, h('div', { class: 'segmented' }, scaleBtns), resetBtn, clock),
  );

  function togglePause(): void {
    loop.setPaused(!loop.paused);
    sync();
  }
  function onKey(e: KeyboardEvent): void {
    const target = e.target;
    const inField = target instanceof Element && target.closest('input, button, select, textarea');
    if (e.code !== 'Space' || inField) return;
    e.preventDefault();
    togglePause();
  }
  window.addEventListener('keydown', onKey);

  function sync(): void {
    pauseBtn.textContent = loop.paused ? '▶' : '⏸';
    stepBtn.disabled = !loop.paused;
    TIME_SCALES.forEach((s, i) => {
      scaleBtns[i]?.classList.toggle('active', s === loop.timeScale);
    });
  }
  sync();

  return {
    sync,
    setClock(t): void {
      clock.textContent = `t = ${fmt(t, 2)} s`;
    },
    setMaxScale(maxScale): void {
      TIME_SCALES.forEach((s, i) => {
        const btn = scaleBtns[i];
        if (btn) btn.disabled = s > maxScale;
      });
      if (loop.timeScale > maxScale) {
        loop.setTimeScale(maxScale);
        sync();
      }
    },
    destroy(): void {
      window.removeEventListener('keydown', onKey);
      container.replaceChildren();
    },
  };
}
