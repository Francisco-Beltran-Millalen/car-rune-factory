// Barras de la prueba de compresión (A11, spec §8): 4 barras con la franja
// verde 11–15 bar y un aviso mientras se mide.

import { el, group, label } from '../../../../core/svg.ts';
import type { DrawerFactory, GeometryFn } from '../../types.ts';
import { channelNumber } from '../../util.ts';

const BAR_W = 38;
const BAR_GAP = 20;
const H = 180;
const P_MAX = 16;
const GREEN_LO = 11;
const GREEN_HI = 15;

const yOf = (bar: number): number => H - (Math.max(0, Math.min(P_MAX, bar)) / P_MAX) * H;

/** Compresión 1..4 con la franja verde de motor sano. */
export const compressionBarsGeometry: GeometryFn = (part) => ({
  box: { x: part.x + 6, y: part.y + 26, w: 4 * (BAR_W + BAR_GAP) + 20, h: H + 90 },
});

export const compressionBarsDrawer: DrawerFactory = ({ part, layers }) => {
  const ox = part.x + 20;
  const oy = part.y + 60;
  const g = group(layers.parts);
  el('rect', { x: ox - 14, y: oy - 34, width: 4 * (BAR_W + BAR_GAP) + 20, height: H + 90, rx: 10, class: 'panel-box' }, g);
  label(g, ox + 2 * (BAR_W + BAR_GAP), oy - 44, 'Prueba de compresión', { anchor: 'middle', className: 'lbl part-label' });
  el('rect', { x: ox - 6, y: oy + yOf(GREEN_HI), width: 4 * (BAR_W + BAR_GAP) - 2, height: (yOf(GREEN_LO) - yOf(GREEN_HI)).toFixed(1), class: 'green-band' }, g);
  label(g, ox + 4 * (BAR_W + BAR_GAP) + 4, oy + yOf(GREEN_HI) + 4, '15', { className: 'lbl-small' });
  label(g, ox + 4 * (BAR_W + BAR_GAP) + 4, oy + yOf(GREEN_LO) + 4, '11', { className: 'lbl-small' });
  const bars: { rect: SVGRectElement; text: SVGTextElement }[] = [];
  for (let i = 0; i < 4; i++) {
    const x = ox + i * (BAR_W + BAR_GAP);
    el('rect', { x, y: oy, width: BAR_W, height: H, rx: 4, class: 'bar-track' }, g);
    const rect = el('rect', { x, y: oy + H, width: BAR_W, height: 0, rx: 4, class: 'bar-fill', part: `cyl${i + 1}` }, g);
    const text = label(g, x + BAR_W / 2, oy + H + 20, `C${i + 1}`, { anchor: 'middle', className: 'lbl-small part-label' });
    bars.push({ rect, text });
  }
  const status = label(g, ox + 4 * (BAR_W + BAR_GAP), oy + H + 44, '', { anchor: 'end', className: 'lbl-small' });

  return {
    g,
    update(channels): void {
      for (let i = 0; i < 4; i++) {
        const value = channelNumber(channels, `c${i + 1}`);
        const bar = bars[i];
        if (!bar) continue;
        const y = yOf(value);
        bar.rect.setAttribute('y', String(oy + y));
        bar.rect.setAttribute('height', String(H - y));
        bar.rect.classList.toggle('low', value > 0 && value < GREEN_LO);
        bar.text.textContent = value > 0 ? `C${i + 1} · ${value.toFixed(1).replace('.', ',')}` : `C${i + 1}`;
      }
      status.textContent = channelNumber(channels, 'testing') > 0.5 ? 'Midiendo… (250 rpm, sin chispa)' : '';
    },
  };
};
