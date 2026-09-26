// Drawer del inyector (A7): cuerpo, aguja, número, cono de spray y goteo.
// El orden de encendido 1-3-4-2 sale del número de instancia (`injectorN`).

import { clamp, expSmooth, wrap } from '../../../core/math.ts';
import { group, el, label } from '../../../core/svg.ts';
import type { DrawerFactory } from '../types.ts';
import { channelNumber } from '../util.ts';

const FIRING_OFFSETS = [0, 540, 180, 360];

export const injectorDrawer: DrawerFactory = ({ part, layers }) => {
  const n = Number(/(\d+)$/.exec(part.id)?.[1] ?? 0);
  const offset = FIRING_OFFSETS[n - 1] ?? 0;
  const x = part.x;
  const y = part.y;
  const g = group(layers.parts, { part: part.id });
  el('rect', { x: x - 12, y: y + 12, width: 24, height: 54, rx: 5, class: 'part-body' }, g);
  el('path', { d: `M ${x - 7} ${y + 66} L ${x + 7} ${y + 66} L ${x} ${y + 80} Z`, class: 'part-body' }, g);
  const needle = el('line', { x1: x, y1: y + 20, x2: x, y2: y + 72, class: 'needle' }, g);
  label(g, x, y + 44, String(n), { anchor: 'middle', className: 'lbl-small inj-num' });
  const spray = el('path', { d: `M ${x} ${y + 80} L ${x - 22} ${y + 140} Q ${x} ${y + 150} ${x + 22} ${y + 140} Z`, class: 'spray', opacity: 0 }, layers.fx);
  const drops = [0, 1].map(() => el('circle', { r: 2.5, class: 'drop', opacity: 0 }, layers.fx));
  let prevCrank: number | null = null;
  let intensity = 0;
  let dripT = 0;
  return {
    g,
    ports: { in: [x, y], out: [x, y + 80] },
    update(channels, dt): void {
      const crank = channelNumber(channels, 'crank');
      const rpm = channelNumber(channels, 'rpm');
      const mixture = channelNumber(channels, 'mixture', 1);
      const delta = prevCrank === null ? 0 : wrap(crank - prevCrank, 720);
      const crossed = prevCrank !== null && delta > 0 && wrap(offset - prevCrank, 720) < delta;
      const hit = channels['open'] === true || (crossed && rpm > 0);
      intensity = hit ? 1 : expSmooth(intensity, 0, dt, 0.04);
      const k = intensity * clamp(mixture || 1, 0.2, 1.3);
      spray.setAttribute('opacity', k.toFixed(2));
      needle.setAttribute('transform', intensity > 0.5 ? 'translate(0 -5)' : '');
      dripT += dt;
      const leak = channelNumber(channels, 'leak');
      drops.forEach((drop, i) => {
        const ph = (dripT * 1.2 + i / 2) % 1;
        drop.setAttribute('cx', String(x));
        drop.setAttribute('cy', (y + 82 + ph * 40).toFixed(1));
        drop.setAttribute('opacity', leak > 0.02 ? (1 - ph).toFixed(2) : '0');
      });
      prevCrank = crank;
    },
  };
};
