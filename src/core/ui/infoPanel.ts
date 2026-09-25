// Ficha de la pieza seleccionada + barra de narración "¿Qué está pasando?".

import { h, clear, append } from '../dom.ts';
import type { Narration, PartInfo } from '../types.ts';

export interface InfoPanel {
  show(partId: string | null): void;
  clear(): void;
}

export function createInfoPanel(
  container: HTMLElement,
  parts: Readonly<Record<string, PartInfo>>,
): InfoPanel {
  function empty(): void {
    clear(container);
    container.append(h('p', { class: 'muted' }, 'Haz clic en una pieza del diagrama para ver qué es y cómo falla.'));
  }
  empty();
  return {
    show(partId): void {
      const p = partId === null ? undefined : parts[partId];
      if (!p) {
        empty();
        return;
      }
      clear(container);
      append(container, [
        h('h3', { class: 'part-name' }, p.name),
        p.what ? h('p', {}, h('strong', {}, '¿Qué es? '), p.what) : null,
        p.why ? h('p', {}, h('strong', {}, '¿Para qué sirve? '), p.why) : null,
        p.how ? h('p', {}, h('strong', {}, '¿Cómo funciona? '), p.how) : null,
        p.failures.length
          ? h('div', {}, h('strong', {}, 'Fallas típicas'), h('ul', { class: 'failures' }, p.failures.map((f) => h('li', {}, f))))
          : null,
      ]);
    },
    clear: empty,
  };
}

const ORDER: Record<Narration['level'], number> = { bad: 0, warn: 1, info: 2 };
const ICON: Record<Narration['level'], string> = { bad: '⛔', warn: '⚠️', info: 'ℹ️' };

/** Ordena por severidad (estable) y se queda con `max`. Puro, testeable. */
export function pickNarrations(list: readonly Narration[], max = 3): Narration[] {
  return list
    .map((n, i) => ({ n, i }))
    .sort((a, b) => ORDER[a.n.level] - ORDER[b.n.level] || a.i - b.i)
    .slice(0, max)
    .map((x) => x.n);
}

export interface NarrationBar {
  set(list: readonly Narration[]): void;
}

export function createNarrationBar(container: HTMLElement): NarrationBar {
  let lastKey = '';
  return {
    set(list): void {
      const top = pickNarrations(list);
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
