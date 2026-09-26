// Drawers del encendido (A12). Coordenadas relativas a `part.x/part.y`.

import { clamp } from '../../../../core/math.ts';
import { el, group, label } from '../../../../core/svg.ts';
import type { DrawerFactory } from '../../types.ts';
import { channelNumber } from '../../util.ts';

/** Balasto: resistencia en serie con el primario. Canal: `open`. */
export const ballastDrawer: DrawerFactory = ({ part, layers }) => {
  const g = group(layers.parts, { part: part.id });
  el('rect', { x: part.x, y: part.y, width: 100, height: 60, rx: 8, class: 'part-body' }, g);
  const zig: [number, number][] = [];
  for (let i = 0; i <= 8; i++) {
    zig.push([part.x + 18 + i * 8, part.y + 30 + (i % 2 ? -9 : 9)]);
  }
  el('polyline', { points: zig.map((p) => p.join(',')).join(' '), class: 'resistor-zig' }, g);
  label(g, part.x + 50, part.y - 8, 'Balasto', { anchor: 'middle', className: 'lbl-small part-label' });
  const cross = el('line', { x1: part.x + 12, y1: part.y + 10, x2: part.x + 88, y2: part.y + 50, class: 'open-cross' }, g);
  cross.style.opacity = '0';
  return {
    g,
    ports: { a: [part.x, part.y + 30], b: [part.x + 100, part.y + 30] },
    update(channels): void {
      cross.style.opacity = channelNumber(channels, 'open') > 0.5 ? '1' : '0';
    },
  };
};

/** Bobina (única en platinos, una por cilindro en COP). Canal: `current`. */
export const coilDrawer: DrawerFactory = ({ part, layers }) => {
  const g = group(layers.parts, { part: part.id });
  el('rect', { x: part.x, y: part.y, width: 120, height: 80, rx: 8, class: 'part-body coil-body' }, g);
  const core = el('rect', { x: part.x + 46, y: part.y + 12, width: 28, height: 56, class: 'coil-core' }, g);
  for (let i = 0; i < 4; i++) {
    el('line', { x1: part.x + 20, y1: part.y + 22 + i * 12, x2: part.x + 100, y2: part.y + 22 + i * 12, class: 'coil-wind' }, g);
  }
  label(g, part.x + 60, part.y + 70, 'Bobina', { anchor: 'middle', className: 'lbl-small part-label' });
  const glow = el('circle', { cx: part.x + 60, cy: part.y + 40, r: 46, class: 'coil-glow' }, g);
  glow.style.opacity = '0';
  return {
    g,
    ports: { a: [part.x + 60, part.y], b: [part.x + 60, part.y + 80] },
    update(channels): void {
      const current = channelNumber(channels, 'current');
      const dead = channelNumber(channels, 'dead') > 0.5;
      core.setAttribute('fill', dead ? 'var(--bad)' : 'var(--metal-dark)');
      glow.style.opacity = current > 0.2 ? clamp(current / 4, 0, 0.5).toFixed(2) : '0';
    },
  };
};

/** Bujía: electrodo, separación y destello. Canales: `spark`, `gap`, `flash`. */
export const sparkPlugDrawer: DrawerFactory = ({ part, layers }) => {
  const g = group(layers.parts, { part: part.id });
  const cx = part.x + 30;
  el('rect', { x: cx - 10, y: part.y + 10, width: 20, height: 60, rx: 4, class: 'plug-ceramic' }, g);
  el('line', { x1: cx, y1: part.y + 70, x2: cx, y2: part.y + 96, class: 'plug-electrode' }, g);
  const ground = el('path', { d: '', class: 'plug-ground' }, g);
  const flash = el('circle', { cx, cy: part.y + 104, r: 12, class: 'spark-flash' }, g);
  flash.style.opacity = '0';
  label(g, cx, part.y + 140, 'Bujía', { anchor: 'middle', className: 'lbl-small part-label' });
  return {
    g,
    update(channels): void {
      const gap = clamp(channelNumber(channels, 'gap', 0.7), 0.4, 2);
      const tip = part.y + 96;
      ground.setAttribute('d', `M ${cx + 12} ${tip - 8 - gap * 7} L ${cx + 12} ${tip + 2} L ${cx} ${tip + 2}`);
      flash.style.opacity = clamp(channelNumber(channels, 'flash'), 0, 1).toFixed(2);
      const fouled = channelNumber(channels, 'fouled');
      flash.setAttribute('fill', fouled > 0.3 ? 'var(--muted)' : 'var(--burn)');
    },
  };
};
