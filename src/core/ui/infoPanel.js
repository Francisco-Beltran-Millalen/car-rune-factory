// Ficha de la pieza seleccionada + barra de narración "¿Qué está pasando?".

import { h, clear } from '../dom.js';

/** @param {HTMLElement} container @param {Record<string, import('../types.ts').PartInfo>} parts */
export function createInfoPanel(container, parts) {
  function empty() {
    clear(container);
    container.append(h('p', { class: 'muted' }, 'Haz clic en una pieza del diagrama para ver qué es y cómo falla.'));
  }
  empty();
  return {
    show(partId) {
      const p = parts[partId];
      if (!p) return empty();
      clear(container);
      container.append(
        h('h3', { class: 'part-name' }, p.name),
        p.what ? h('p', {}, h('strong', {}, '¿Qué es? '), p.what) : null,
        p.why ? h('p', {}, h('strong', {}, '¿Para qué sirve? '), p.why) : null,
        p.how ? h('p', {}, h('strong', {}, '¿Cómo funciona? '), p.how) : null,
        p.failures?.length
          ? h('div', {}, h('strong', {}, 'Fallas típicas'), h('ul', { class: 'failures' }, p.failures.map((f) => h('li', {}, f))))
          : null,
      );
    },
    clear: empty,
  };
}

const ORDER = { bad: 0, warn: 1, info: 2 };
const ICON = { bad: '⛔', warn: '⚠️', info: 'ℹ️' };

/** Ordena por severidad (estable) y se queda con `max`. Puro, testeable. */
export function pickNarrations(list, max = 3) {
  return list
    .map((n, i) => ({ n, i }))
    .sort((a, b) => ORDER[a.n.level] - ORDER[b.n.level] || a.i - b.i)
    .slice(0, max)
    .map((x) => x.n);
}

/** @param {HTMLElement} container */
export function createNarrationBar(container) {
  let lastKey = '';
  return {
    /** @param {import('../types.ts').Narration[]} list */
    set(list) {
      const top = pickNarrations(list || []);
      const key = top.map((n) => n.level + n.text).join('|');
      if (key === lastKey) return;
      lastKey = key;
      clear(container);
      if (!top.length) {
        container.append(h('span', { class: 'muted' }, 'Todo en reposo.'));
        return;
      }
      for (const n of top) container.append(h('span', { class: `narr narr-${n.level}` }, `${ICON[n.level]} ${n.text}`));
    },
  };
}
