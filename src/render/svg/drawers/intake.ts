// Drawers del múltiple, la manguera de vacío y el regulador (A7).
// Las coordenadas son relativas a `part.x/part.y`.

import { group, el, label, pipe } from '../../../core/svg.ts';
import type { DrawerFactory, GeometryFn } from '../types.ts';
import { channelBool, channelNumber, channelString, springPoints } from '../util.ts';

const ENGINE_LABEL: Readonly<Record<string, string>> = {
  off: 'Motor detenido',
  cranking: 'Arrancando…',
  running: 'En marcha',
  misfire: 'Falla (mezcla)',
  stalled: 'Se detuvo',
};

export const manifoldGeometry: GeometryFn = (part) => ({
  box: { x: part.x, y: part.y, w: 440, h: 86 },
  ports: { a: [part.x + 210, part.y] },
  container: true,
});

/** Múltiple de admisión: caja y etiqueta del estado del motor. Canal: `engineState`. */
export const manifoldDrawer: DrawerFactory = ({ part, layers }) => {
  const g = group(layers.behind, { part: part.id });
  el('rect', { x: part.x, y: part.y, width: 440, height: 86, rx: 10, class: 'part-body manifold-body' }, g);
  label(g, part.x + 10, part.y + 78, 'Múltiple de admisión', { className: 'lbl-small part-label' });
  const tag = group(layers.parts, { class: 'engine-tag' });
  const tagBg = el('rect', { x: part.x + 270, y: part.y + 58, width: 160, height: 22, rx: 11, class: 'tag tag-off' }, tag);
  const tagText = label(tag, part.x + 350, part.y + 73, '', { anchor: 'middle', className: 'tag-text' });
  let last = '';
  return {
    g,
    update(channels): void {
      const state = channelString(channels, 'engineState', 'off');
      if (state === last) return;
      last = state;
      tagBg.setAttribute('class', `tag tag-${state}`);
      tagText.textContent = ENGINE_LABEL[state] ?? state;
    },
  };
};

/** Tramo en L del múltiple al regulador (lo dibuja el propio drawer). */
export const vacuumHoseGeometry: GeometryFn = (part) => ({
  box: { x: part.x - 42, y: part.y - 56, w: 42, h: 56 },
  ports: { a: [part.x - 42, part.y] },
});

/** Manguera de vacío: tramo conectado o suelto. Canal: `off`. */
export const vacuumHoseDrawer: DrawerFactory = ({ part, layers }) => {
  const g = group(layers.parts, { part: part.id });
  const on = pipe(g, [[part.x - 42, part.y], [part.x, part.y], [part.x, part.y - 56]], {
    width: 5,
    className: 'fluid-vacuum',
  });
  const off = group(g);
  pipe(off, [[part.x, part.y - 56], [part.x, part.y - 38], [part.x + 14, part.y - 24]], {
    width: 5,
    className: 'fluid-vacuum',
  });
  el('text', { x: part.x + 20, y: part.y - 8, class: 'lbl-small warn-text', text: '¡suelta!' }, off);
  let last: boolean | null = null;
  return {
    g,
    update(channels): void {
      const isOff = channelBool(channels, 'off');
      if (isOff === last) return;
      last = isOff;
      on.g.style.display = isOff ? 'none' : '';
      off.style.display = isOff ? '' : 'none';
    },
  };
};

export const regulatorGeometry: GeometryFn = (part) => ({
  box: { x: part.x, y: part.y, w: 64, h: 92 },
  ports: { in: [part.x, part.y + 20], ret: [part.x + 64, part.y + 20], ref: [part.x + 32, part.y + 92] },
});

/** Regulador: diafragma y resorte que se comprime. Canal: `open` (0..1). */
export const regulatorDrawer: DrawerFactory = ({ part, layers }) => {
  const g = group(layers.parts, { part: part.id });
  el('rect', { x: part.x, y: part.y, width: 64, height: 92, rx: 12, class: 'part-body' }, g);
  const diaphragm = el('line', { x1: part.x + 4, y1: part.y + 46, x2: part.x + 60, y2: part.y + 46, class: 'diaphragm' }, g);
  const spring = el('polyline', { points: springPoints(part.x + 32, part.y + 50, part.y + 88), class: 'spring' }, g);
  label(g, part.x + 32, part.y - 8, 'Regulador', { anchor: 'middle', className: 'lbl-small part-label' });
  let last = -1;
  return {
    g,
    update(channels): void {
      const open = channelNumber(channels, 'open');
      const key = Math.round(open * 100);
      if (key === last) return;
      last = key;
      const lift = 10 * open;
      diaphragm.setAttribute('transform', `translate(0 ${lift.toFixed(1)})`);
      spring.setAttribute('points', springPoints(part.x + 32, part.y + 50 + lift, part.y + 88));
    },
  };
};
