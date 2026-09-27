// Drawer de la cuba del carburador (A16): flotador y aguja de la entrada.
// La bencina sale hacia los surtidores por dentro del cuerpo (spec §1): no
// se dibuja ese tramo. Coordenadas relativas a `part.x/y`.

import { clamp } from '../../../../core/math.ts';
import { el, group, label } from '../../../../core/svg.ts';
import type { DrawerFactory, GeometryFn } from '../../types.ts';
import { channelBool, channelNumber } from '../../util.ts';

const W = 220;
const H = 200;
const CAPACITY = 0.1;

/** La aguja (sub-pieza) recibe la bencina del filtro por su borde izquierdo. */
export const floatBowlGeometry: GeometryFn = (part) => ({
  box: { x: part.x, y: part.y, w: W, h: H },
  subparts: {
    needleValve: {
      box: { x: part.x - 20, y: part.y + 30, w: 20, h: 30 },
      ports: { a: [part.x - 20, part.y + 45] },
    },
  },
});

/** Cuba: nivel, flotador, aguja y rebalse. Canales: `level` (L, 0..0,1),
 *  `needleOpen` (0..1) y `flooding` (bool). */
export const floatBowlDrawer: DrawerFactory = ({ part, layers }) => {
  const g = group(layers.parts, { part: part.id });
  el('rect', { x: part.x, y: part.y, width: W, height: H, rx: 12, class: 'part-body bowl-body' }, g);
  const liquid = el('rect', { x: part.x + 6, y: part.y + H - 6, width: W - 12, height: 0, class: 'liquid fluid-fuel bowl-liquid' }, g);
  const float = el('circle', { r: 10, class: 'float-ball' }, group(g, { part: 'float' }));
  const needle = group(g, { part: 'needleValve' });
  el('rect', { x: part.x - 20, y: part.y + 30, width: 20, height: 30, rx: 4, class: 'needle-body' }, needle);
  const needlePin = el('line', {
    x1: part.x - 16, y1: part.y + 45, x2: part.x, y2: part.y + 45, class: 'needle-pin',
  }, needle);
  label(g, part.x + W / 2, part.y - 10, 'Cuba', { anchor: 'middle', className: 'lbl part-label' });
  const text = label(g, part.x + W / 2, part.y + H + 16, '', { anchor: 'middle', className: 'lbl-small lbl-mono' });
  return {
    g,
    update(channels): void {
      const level = clamp(channelNumber(channels, 'level'), 0, CAPACITY);
      const hgt = (level / CAPACITY) * (H - 30);
      liquid.setAttribute('y', (part.y + H - 6 - hgt).toFixed(1));
      liquid.setAttribute('height', hgt.toFixed(1));
      float.setAttribute('cx', String(part.x + W / 2));
      float.setAttribute('cy', (part.y + H - 6 - hgt).toFixed(1));
      const open = clamp(channelNumber(channels, 'needleOpen'), 0, 1);
      needlePin.setAttribute('transform', `translate(${(open * 10).toFixed(1)} 0)`);
      g.classList.toggle('flooding', channelBool(channels, 'flooding'));
      text.textContent = `${(level * 1000).toFixed(0)} mL`;
    },
  };
};
