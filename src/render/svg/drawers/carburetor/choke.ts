// Drawer del estrangulador (choke) manual (A16): chapaleta en la boca de
// aire. Coordenadas relativas a `part.x/y`.

import { clamp } from '../../../../core/math.ts';
import { el, group, label } from '../../../../core/svg.ts';
import type { DrawerFactory, GeometryFn } from '../../types.ts';
import { channelNumber } from '../../util.ts';

const W = 140;
const H = 50;

export const chokeGeometry: GeometryFn = (part) => ({
  box: { x: part.x, y: part.y, w: W, h: H },
});

/** Chapaleta del choke: de plano (abierta) a vertical (cerrada). Canal:
 *  `chokeEff` (0..1). */
export const chokeDrawer: DrawerFactory = ({ part, layers }) => {
  const g = group(layers.parts, { part: part.id });
  const cx = part.x + W / 2;
  const cy = part.y + H / 2;
  el('rect', { x: part.x, y: part.y, width: W, height: H, rx: 8, class: 'part-body choke-body' }, g);
  const flap = el('line', {
    x1: cx - W / 2 + 8, y1: cy, x2: cx + W / 2 - 8, y2: cy, class: 'choke-flap',
  }, g);
  label(g, cx, part.y - 8, 'Choke', { anchor: 'middle', className: 'lbl-small part-label' });
  return {
    g,
    update(channels): void {
      const eff = clamp(channelNumber(channels, 'chokeEff'), 0, 1);
      flap.setAttribute('transform', `rotate(${(-eff * 80).toFixed(1)} ${cx} ${cy})`);
      g.classList.toggle('choke-closed', eff > 0.5);
    },
  };
};
