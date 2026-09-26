// Drawers del filtro, el riel (tubo + manómetro + partículas) y la fuga de
// la línea (A7). Las coordenadas son relativas a `part.x/part.y`.

import { clamp } from '../../../core/math.ts';
import { createFlow, PX_PER_LH, type Flow } from '../../../core/particles.ts';
import { group, el, label, pipe, gaugeSvg } from '../../../core/svg.ts';
import type { DrawerFactory } from '../types.ts';
import { channelNumber, pressureOpacity } from '../util.ts';

const RAIL_LEN = 430;

/** Filtro: cuerpo con pliegues, flecha y suciedad. Canal: `dirt` (0..1). */
export const filterDrawer: DrawerFactory = ({ part, layers }) => {
  const g = group(layers.parts, { part: part.id });
  el('rect', { x: part.x, y: part.y, width: 80, height: 44, rx: 12, class: 'part-body filter-body' }, g);
  for (let x = part.x + 12; x < part.x + 76; x += 8) {
    el('line', { x1: x, y1: part.y + 6, x2: x, y2: part.y + 38, class: 'filter-pleat' }, g);
  }
  const dirt = el('rect', { x: part.x + 2, y: part.y + 2, width: 0, height: 40, rx: 10, class: 'filter-dirt' }, g);
  el('line', { x1: part.x + 20, y1: part.y + 56, x2: part.x + 64, y2: part.y + 56, class: 'flow-arrow', 'marker-end': 'url(#arrow)' }, g);
  label(g, part.x + 40, part.y + 77, 'Filtro', { anchor: 'middle', className: 'lbl-small part-label' });
  return {
    g,
    ports: { a: [part.x, part.y + 22], b: [part.x + 80, part.y + 22] },
    update(channels): void {
      dirt.setAttribute('width', (76 * clamp(channelNumber(channels, 'dirt'), 0, 1)).toFixed(1));
    },
  };
};

/** Riel: tubo, manómetro en T y su propio caudal. Canales: `pressure`, `flow`. */
export const railDrawer: DrawerFactory = ({ part, layers }) => {
  const tube = pipe(layers.pipes, [[part.x, part.y], [part.x + RAIL_LEN, part.y]], {
    width: 16,
    part: part.id,
  });
  const g = tube.g;
  pipe(g, [[part.x - 25, part.y], [part.x - 25, part.y - 32]], { width: 4 });
  const gauge = gaugeSvg(g, {
    cx: part.x - 25,
    cy: part.y - 72,
    r: 40,
    min: 0,
    max: 8,
    green: [2.2, 3.8],
    unit: 'bar',
    ticks: 4,
  });
  label(g, part.x + 10, part.y - 16, 'Riel', { className: 'lbl-small part-label' });
  const flow: Flow = createFlow({ path: tube.path, layer: layers.particles, spacing: 16, radius: 3.5 });
  return {
    g,
    ports: { a: [part.x, part.y] },
    update(channels, dt): void {
      const pressure = channelNumber(channels, 'pressure');
      gauge.setValue(pressure);
      // style (no atributo): la regla CSS .pipe-fluid le ganaría a un atributo.
      tube.inner.style.opacity = pressureOpacity(pressure);
      const q = Math.max(0, channelNumber(channels, 'flow'));
      flow.setSpeed(q * PX_PER_LH);
      flow.setDensity(q > 0.3 ? 1 : 0);
      flow.update(dt);
    },
    destroy(): void {
      flow.destroy();
    },
  };
};
