// Barra de tiempo: pausa, paso a paso, velocidad y reinicio.

import { h, fmt } from '../dom.js';
import { TIME_SCALES } from '../loop.js';

const scaleLabel = (s) => `${fmt(s, s < 1 ? 2 : 0)}×`;

/**
 * @param {HTMLElement} container
 * @param {{ loop: ReturnType<import('../loop.js').createLoop>, onReset: () => void }} opts
 */
export function createTimebar(container, { loop, onReset }) {
  const pauseBtn = h('button', { type: 'button', class: 'btn tb-pause', title: 'Pausa (espacio)', onclick: togglePause });
  const stepBtn = h(
    'button',
    { type: 'button', class: 'btn', title: 'Avanzar 1 ms', onclick: () => loop.stepOnce() },
    '⏭',
  );
  const scaleBtns = TIME_SCALES.map((s) =>
    h('button', { type: 'button', class: 'seg-btn', onclick: () => (loop.setTimeScale(s), sync()) }, scaleLabel(s)),
  );
  const resetBtn = h('button', { type: 'button', class: 'btn', title: 'Reiniciar', onclick: onReset }, '⟲');
  const clock = h('span', { class: 'tb-clock', title: 'Tiempo simulado' });

  container.append(
    h('div', { class: 'timebar' }, pauseBtn, stepBtn, h('div', { class: 'segmented' }, scaleBtns), resetBtn, clock),
  );

  function togglePause() {
    loop.setPaused(!loop.paused);
    sync();
  }
  function onKey(e) {
    if (e.code !== 'Space' || e.target.closest?.('input, button, select, textarea')) return;
    e.preventDefault();
    togglePause();
  }
  window.addEventListener('keydown', onKey);

  function sync() {
    pauseBtn.textContent = loop.paused ? '▶' : '⏸';
    stepBtn.disabled = !loop.paused;
    TIME_SCALES.forEach((s, i) => scaleBtns[i].classList.toggle('active', s === loop.timeScale));
  }
  sync();

  return {
    sync,
    setClock(t) {
      clock.textContent = `t = ${fmt(t, 2)} s`;
    },
    setMaxScale(maxScale) {
      TIME_SCALES.forEach((s, i) => {
        scaleBtns[i].disabled = s > maxScale;
      });
      if (loop.timeScale > maxScale) {
        loop.setTimeScale(maxScale);
        sync();
      }
    },
    destroy() {
      window.removeEventListener('keydown', onKey);
      container.replaceChildren();
    },
  };
}
