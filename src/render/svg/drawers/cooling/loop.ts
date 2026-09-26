// Drawers del radiador, ventilador, depósito, calefactor y reloj (A13).

import { clamp } from '../../../../core/math.ts';
import { el, group, label } from '../../../../core/svg.ts';
import type { DrawerFactory } from '../../types.ts';
import { channelNumber } from '../../util.ts';

/** Radiador: panal, suciedad y tapa. Canales: `temp`, `dirt`; `radiatorCap.failed`. */
export const radiatorDrawer: DrawerFactory = ({ part, layers }) => {
  const g = group(layers.parts, { part: part.id });
  el('rect', { x: part.x, y: part.y, width: 90, height: 320, rx: 10, class: 'part-body radiator-body' }, g);
  const fins = group(g);
  for (let i = 0; i < 16; i++) {
    el('line', { x1: part.x + 6, y1: part.y + 12 + i * 19, x2: part.x + 84, y2: part.y + 12 + i * 19, class: 'fins' }, fins);
  }
  const dirt = el('rect', { x: part.x + 4, y: part.y + 4, width: 82, height: 312, rx: 8, class: 'dirt' }, g);
  dirt.style.opacity = '0';
  const cap = group(g, { part: 'radiatorCap' });
  el('rect', { x: part.x + 24, y: part.y - 18, width: 42, height: 20, rx: 6, class: 'part-body' }, cap);
  label(g, part.x + 45, part.y - 28, 'Tapa', { anchor: 'middle', className: 'lbl-small part-label' });
  label(g, part.x + 45, part.y + 345, 'Radiador', { anchor: 'middle', className: 'lbl part-label' });
  const temp = label(g, part.x + 45, part.y + 365, '', { anchor: 'middle', className: 'lbl-small lbl-mono' });
  return {
    g,
    update(channels): void {
      const t = channelNumber(channels, 'temp');
      const k = clamp((t - 40) / 70, 0, 1);
      for (const n of fins.querySelectorAll<SVGElement>('.fins')) {
        n.style.stroke = `color-mix(in srgb, var(--coolant) ${((1 - k) * 100).toFixed(0)}%, var(--coolant-hot))`;
      }
      dirt.style.opacity = String(clamp(channelNumber(channels, 'dirt'), 0, 1) * 0.75);
      temp.textContent = `${t.toFixed(1).replace('.', ',')} °C`;
    },
  };
};

/** Ventilador: aspas, motor/termocontacto (eléctrico) o embrague (viscoso). */
export const fanDrawer: DrawerFactory = ({ part, layers }) => {
  const g = group(layers.parts, { part: part.id });
  const cx = part.x + 80;
  const cy = part.y + 100;
  const blades = group(g);
  for (let i = 0; i < 5; i++) {
    el('ellipse', { cx: cx - 34, cy, rx: 34, ry: 12, class: 'fan-blade', transform: `rotate(${i * 72} ${cx} ${cy})` }, blades);
  }
  el('circle', { cx, cy, r: 12, class: 'dist-hub' }, g);
  el('circle', { cx, cy, r: 82, class: 'fan-shroud' }, g);

  const motor = group(g, { part: 'fanMotor' });
  el('rect', { x: cx + 60, y: cy + 70, width: 46, height: 26, rx: 5, class: 'part-body' }, motor);
  const relay = group(g, { part: 'fanRelay' });
  el('rect', { x: cx + 10, y: cy + 90, width: 44, height: 26, rx: 5, class: 'part-body' }, relay);
  const sw = group(g, { part: 'fanSwitch' });
  el('circle', { cx: cx - 60, cy: cy + 100, r: 14, class: 'part-body' }, sw);
  const fuse = group(g, { part: 'fuse' });
  el('rect', { x: cx - 120, y: cy + 88, width: 34, height: 20, rx: 9, class: 'part-body fuse' }, fuse);
  const clutch = group(g, { part: 'fanClutch' });
  el('circle', { cx, cy, r: 26, class: 'clutch' }, clutch);
  label(g, cx, cy + 118, 'Ventilador', { anchor: 'middle', className: 'lbl-small part-label' });

  let angle = 0;
  return {
    g,
    update(channels, dt): void {
      const speed = channelNumber(channels, 'speed');
      angle = (angle + speed * dt * 45) % 360;
      blades.setAttribute('transform', `rotate(${angle.toFixed(1)} ${cx} ${cy})`);
      const dead = channelNumber(channels, 'dead') > 0.5;
      for (const n of g.querySelectorAll<SVGElement>('.fan-blade')) {
        n.style.fill = dead ? 'var(--muted)' : 'var(--metal)';
      }
    },
  };
};

/** Depósito de expansión: nivel y presión. Canales: `level`, `pressure`. */
export const expansionTankDrawer: DrawerFactory = ({ part, layers }) => {
  const g = group(layers.parts, { part: part.id });
  el('rect', { x: part.x, y: part.y, width: 120, height: 120, rx: 12, class: 'part-body' }, g);
  const liquid = el('rect', { x: part.x + 6, y: part.y + 6, width: 108, height: 0, rx: 8, class: 'liquid fluid-coolant' }, g);
  const text = label(g, part.x + 60, part.y + 62, '', { anchor: 'middle', className: 'lbl-small lbl-mono' });
  const press = label(g, part.x + 60, part.y + 82, '', { anchor: 'middle', className: 'lbl-small lbl-mono' });
  label(g, part.x + 60, part.y - 10, 'Depósito', { anchor: 'middle', className: 'lbl part-label' });
  return {
    g,
    update(channels): void {
      const level = clamp(channelNumber(channels, 'level'), 0, 7);
      const h = (level / 7) * 108;
      liquid.setAttribute('y', String(part.y + 114 - h));
      liquid.setAttribute('height', String(h));
      text.textContent = `${level.toFixed(2).replace('.', ',')} L`;
      press.textContent = `${channelNumber(channels, 'pressure').toFixed(2).replace('.', ',')} bar`;
    },
  };
};

/** Calefactor: panal interior y llave. Canales: `temp`, `on`. */
export const heaterCoreDrawer: DrawerFactory = ({ part, layers }) => {
  const g = group(layers.parts, { part: part.id });
  el('rect', { x: part.x, y: part.y, width: 80, height: 80, rx: 8, class: 'part-body' }, g);
  const glow = el('rect', { x: part.x + 4, y: part.y + 4, width: 72, height: 72, rx: 6, class: 'heater-glow' }, g);
  glow.style.opacity = '0';
  const valve = group(g, { part: 'heaterValve' });
  el('circle', { cx: part.x + 110, cy: part.y + 40, r: 16, class: 'part-body' }, valve);
  el('line', { x1: part.x + 110, y1: part.y + 40, x2: part.x + 110, y2: part.y + 22, class: 'valve-flap' }, valve);
  label(g, part.x + 40, part.y - 10, 'Calefactor', { anchor: 'middle', className: 'lbl part-label' });
  return {
    g,
    update(channels): void {
      glow.style.opacity = channelNumber(channels, 'on') > 0.5 ? '0.5' : '0';
      glow.style.fill = clamp(channelNumber(channels, 'temp'), 0, 120) > 60 ? 'var(--coolant-hot)' : 'var(--coolant)';
    },
  };
};

/** Reloj de temperatura: aguja y sonda. Canales: `reading`, `real`. */
export const tempGaugeDrawer: DrawerFactory = ({ part, layers }) => {
  const g = group(layers.parts, { part: part.id });
  const cx = part.x + 70;
  const cy = part.y + 60;
  el('circle', { cx, cy, r: 52, class: 'gauge-face' }, g);
  for (let i = 0; i <= 6; i++) {
    const a = ((i * 40 - 120) * Math.PI) / 180;
    el('line', { x1: cx + Math.cos(a) * 40, y1: cy + Math.sin(a) * 40, x2: cx + Math.cos(a) * 48, y2: cy + Math.sin(a) * 48, class: 'gauge-tick' }, g);
  }
  const needle = el('line', { x1: cx, y1: cy, x2: cx, y2: cy - 40, class: 'gauge-needle' }, g);
  el('circle', { cx, cy, r: 4, class: 'gauge-hub' }, g);
  label(g, cx, cy + 74, 'Reloj', { anchor: 'middle', className: 'lbl-small part-label' });
  const sensor = group(g, { part: 'tempSensor' });
  el('circle', { cx: cx + 70, cy: cy + 30, r: 10, class: 'part-body' }, sensor);
  const text = label(g, cx + 70, cy + 58, '', { anchor: 'middle', className: 'lbl-small lbl-mono' });
  return {
    g,
    update(channels): void {
      const reading = clamp(channelNumber(channels, 'reading'), -40, 130);
      const a = -120 + ((reading + 40) / 170) * 240;
      needle.setAttribute('transform', `rotate(${a.toFixed(1)} ${cx} ${cy})`);
      const real = channelNumber(channels, 'real');
      text.textContent = `${reading.toFixed(0)} °C`;
      sensor.style.fill = Math.abs(reading - real) > 15 ? 'var(--bad)' : 'var(--metal)';
    },
  };
};
