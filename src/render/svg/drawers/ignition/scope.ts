// Osciloscopio del encendido (A12, spec ignition §8): dos trazos analíticos,
// el de corriente del primario y el de tensión del secundario.

import { clamp } from '../../../../core/math.ts';
import { el, group, label } from '../../../../core/svg.ts';
import type { DrawerFactory } from '../../types.ts';
import { channelNumber } from '../../util.ts';

const W = 300;
const H = 150;
/** Escalas de los trazos: A lleno y kV lleno. */
const I_MAX = 9;
const V_MAX = 36;

/** Osciloscopio de dos canales (se congela si no hay eventos). */
export const scopeDrawer: DrawerFactory = ({ part, layers }) => {
  const ox = part.x + 20;
  const oy = part.y + 30;
  const g = group(layers.parts);
  el('rect', { x: ox - 8, y: oy - 22, width: W + 40, height: H + 70, rx: 10, class: 'scope-box' }, g);
  label(g, ox + W / 2, oy - 8, 'Osciloscopio', { anchor: 'middle', className: 'lbl part-label' });
  for (let i = 0; i <= 4; i++) {
    el('line', { x1: ox, y1: oy + (i * H) / 4, x2: ox + W, y2: oy + (i * H) / 4, class: 'grid-line' }, g);
  }
  const currentTrace = el('polyline', { class: 'scope-trace scope-i' }, g);
  const voltTrace = el('polyline', { class: 'scope-trace scope-v' }, g);
  const caption = label(g, ox, oy + H + 22, '', { className: 'lbl-small' });

  function points(values: readonly number[], scale: number): string {
    return values
      .map((v, i) => `${(ox + (i / (values.length - 1)) * W).toFixed(1)},${(oy + H - (clamp(v / scale, 0, 1) * H)).toFixed(1)}`)
      .join(' ');
  }

  return {
    g,
    update(channels): void {
      const iBreak = clamp(channelNumber(channels, 'i'), 0, I_MAX);
      const vPeak = clamp(channelNumber(channels, 'req'), 0, V_MAX);
      // El trazo se arma con la forma del último evento: dwell (rampa de
      // corriente), corte (pico de tensión) y arco con oscilación.
      const current: number[] = [];
      const volt: number[] = [];
      for (let i = 0; i <= 30; i++) {
        const t = i / 30;
        current.push(t < 0.55 ? iBreak * (1 - Math.exp(-t * 6)) : t < 0.6 ? iBreak * (1 - (t - 0.55) / 0.05) : 0);
        volt.push(t < 0.55 ? 0 : t < 0.62 ? (vPeak * (t - 0.55)) / 0.07 : t < 0.75 ? vPeak * 0.12 : vPeak * 0.12 * Math.exp(-(t - 0.75) * 14) * Math.cos((t - 0.75) * 60));
      }
      currentTrace.setAttribute('points', points(current, I_MAX));
      voltTrace.setAttribute('points', points(volt, V_MAX));
      const cyl = channelNumber(channels, 'cyl');
      caption.textContent = `Cilindro ${cyl > 0 ? cyl : '—'} · ${channelNumber(channels, 'i').toFixed(2).replace('.', ',')} A`;
    },
  };
};
