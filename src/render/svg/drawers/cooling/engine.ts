// Drawers de la refrigeración (A13). Coordenadas relativas a `part.x/part.y`.

import { clamp } from '../../../../core/math.ts';
import { el, group, label } from '../../../../core/svg.ts';
import type { DrawerFactory } from '../../types.ts';
import { channelNumber } from '../../util.ts';

/** Camisa del motor: bloque con canales, calor y vapor. Canales: `temp`, `boiling`. */
export const engineJacketDrawer: DrawerFactory = ({ part, layers }) => {
  const g = group(layers.parts, { part: part.id });
  el('rect', { x: part.x, y: part.y, width: 220, height: 200, rx: 12, class: 'part-body' }, g);
  for (let i = 0; i < 4; i++) {
    el('rect', { x: part.x + 18, y: part.y + 20 + i * 46, width: 184, height: 20, rx: 8, class: 'jacket-channel' }, g);
  }
  label(g, part.x + 110, part.y - 10, 'Motor', { anchor: 'middle', className: 'lbl part-label' });
  const tempText = label(g, part.x + 110, part.y + 214, '', { anchor: 'middle', className: 'lbl-small lbl-mono' });
  const steam = group(g);
  const puffs = [0, 1, 2].map(() =>
    el('circle', { cx: part.x + 40, cy: part.y, r: 10, class: 'steam' }, steam),
  );
  let t = 0;
  return {
    g,
    update(channels, dt): void {
      const temp = channelNumber(channels, 'temp');
      const boiling = channelNumber(channels, 'boiling') > 0.5;
      const k = clamp((temp - 40) / 70, 0, 1);
      for (const n of g.querySelectorAll<SVGElement>('.jacket-channel')) {
        n.style.fill = `color-mix(in srgb, var(--coolant) ${((1 - k) * 100).toFixed(0)}%, var(--coolant-hot))`;
      }
      tempText.textContent = `${temp.toFixed(1).replace('.', ',')} °C`;
      t += dt;
      puffs.forEach((puff, i) => {
        const ph = ((t * 0.5 + i / 3) % 1);
        puff.setAttribute('cx', String(part.x + 60 + i * 50));
        puff.setAttribute('cy', String(part.y + 20 - ph * 30));
        puff.style.opacity = boiling ? ((1 - ph) * 0.7).toFixed(2) : '0';
      });
    },
  };
};

/** Bomba: polea, rotor y fuga. Canales: `flow`, `leak`. */
export const waterPumpDrawer: DrawerFactory = ({ part, layers }) => {
  const g = group(layers.parts, { part: part.id });
  const cx = part.x + 60;
  const cy = part.y + 40;
  el('circle', { cx, cy, r: 36, class: 'part-body' }, g);
  const rotor = group(g);
  for (let i = 0; i < 4; i++) {
    el('line', { x1: cx, y1: cy, x2: cx + 26, y2: cy, class: 'pump-vane', transform: `rotate(${i * 90} ${cx} ${cy})` }, rotor);
  }
  el('circle', { cx, cy, r: 8, class: 'dist-hub' }, g);
  label(g, cx, part.y + 92, 'Bomba', { anchor: 'middle', className: 'lbl-small part-label' });
  const belt = group(g, { part: 'pumpBelt' });
  el('path', { d: `M ${cx} ${cy - 36} C ${cx - 90} ${cy - 120} ${cx - 190} ${cy - 60} ${cx - 200} ${cy + 40}`, class: 'belt' }, belt);
  const drop = el('circle', { cx: cx + 30, cy: cy + 40, r: 4, class: 'drop' }, g);
  drop.style.opacity = '0';
  let angle = 0;
  return {
    g,
    update(channels, dt): void {
      const flow = channelNumber(channels, 'flow');
      angle = (angle + flow * dt * 0.6) % 360;
      rotor.setAttribute('transform', `rotate(${angle.toFixed(1)} ${cx} ${cy})`);
      drop.style.opacity = channelNumber(channels, 'leak') > 0.5 ? '0.8' : '0';
      belt.style.opacity = flow > 50 ? '1' : '0.5';
    },
  };
};

/** Termostato: válvula que se abre con la cera. Canal: `open`. */
export const thermostatDrawer: DrawerFactory = ({ part, layers }) => {
  const g = group(layers.parts, { part: part.id });
  el('rect', { x: part.x, y: part.y, width: 80, height: 70, rx: 10, class: 'part-body' }, g);
  const flap = el('line', { x1: part.x + 14, y1: part.y + 35, x2: part.x + 66, y2: part.y + 35, class: 'valve-flap' }, g);
  label(g, part.x + 40, part.y - 10, 'Termostato', { anchor: 'middle', className: 'lbl-small part-label' });
  const text = label(g, part.x + 40, part.y + 88, '', { anchor: 'middle', className: 'lbl-small lbl-mono' });
  return {
    g,
    update(channels): void {
      const open = clamp(channelNumber(channels, 'open'), 0, 1);
      flap.setAttribute('transform', `rotate(${(-70 * open).toFixed(1)} ${part.x + 14} ${part.y + 35})`);
      text.textContent = `${(open * 100).toFixed(0)} %`;
    },
  };
};
