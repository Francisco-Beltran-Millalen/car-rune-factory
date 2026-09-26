// Diagrama P-V del cilindro visto (A11, spec §8): ejes lineales, traza del
// último ciclo y punto actual. La traza es estado de la vista, no del modelo.

import { el, group, label } from '../../../../core/svg.ts';
import type { DrawerFactory } from '../../types.ts';
import { channelNumber } from '../../util.ts';

const W = 340;
const H = 300;
const V_MAX = 600; // cm³
const P_MAX = 80; // bar abs

/** Traza P-V: acumula los puntos que le llegan y la reinicia cada ciclo. */
export const pvDiagramDrawer: DrawerFactory = ({ part, layers }) => {
  const ox = part.x + 10;
  const oy = part.y + 30;
  const g = group(layers.parts);
  el('rect', { x: ox - 6, y: oy - 10, width: W + 40, height: H + 60, rx: 10, class: 'panel-box' }, g);
  el('line', { x1: ox, y1: oy + H, x2: ox + W, y2: oy + H, class: 'axis' }, g);
  el('line', { x1: ox, y1: oy + H, x2: ox, y2: oy, class: 'axis' }, g);
  label(g, ox + W / 2, oy + H + 30, 'V (cm³) →', { anchor: 'middle', className: 'lbl-small' });
  label(g, ox - 24, oy + H / 2, 'p (bar)', { anchor: 'middle', className: 'lbl-small' });
  label(g, ox + W / 2, oy - 24, 'Diagrama P-V', { anchor: 'middle', className: 'lbl part-label' });
  for (let v = 0; v <= V_MAX; v += 200) {
    label(g, ox + (v / V_MAX) * W, oy + H + 14, String(v), { anchor: 'middle', className: 'lbl-small' });
  }
  for (let p = 0; p <= P_MAX; p += 20) {
    el('line', { x1: ox, y1: oy + H - (p / P_MAX) * H, x2: ox + W, y2: oy + H - (p / P_MAX) * H, class: 'grid-line' }, g);
    label(g, ox - 8, oy + H - (p / P_MAX) * H, String(p), { anchor: 'end', className: 'lbl-small' });
  }
  const trace = el('polyline', { class: 'pv-trace' }, g);
  const dot = el('circle', { r: 4, class: 'pv-dot' }, g);

  let points: string[] = [];
  let lastCycle = -1;

  return {
    g,
    update(channels): void {
      const pressure = channelNumber(channels, 'pressure');
      const volume = channelNumber(channels, 'volume');
      const cycle = channelNumber(channels, 'cycle');
      if (cycle !== lastCycle) {
        lastCycle = cycle;
        points = [];
      }
      const x = ox + (Math.max(0, Math.min(V_MAX, volume)) / V_MAX) * W;
      const y = oy + H - (Math.max(0, Math.min(P_MAX, pressure)) / P_MAX) * H;
      points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
      if (points.length > 1400) points.shift();
      trace.setAttribute('points', points.join(' '));
      dot.setAttribute('cx', x.toFixed(1));
      dot.setAttribute('cy', y.toFixed(1));
    },
  };
};
