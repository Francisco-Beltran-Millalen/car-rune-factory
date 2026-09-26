// Drawers del estanque, el colador, la bomba y la válvula check (A7).
// Las coordenadas son relativas a `part.x/part.y`.

import { clamp } from '../../../core/math.ts';
import { group, el, label } from '../../../core/svg.ts';
import type { DrawerFactory, GeometryFn } from '../types.ts';
import { channelNumber } from '../util.ts';

const TANK_W = 320;
const TANK_H = 230;

export const tankGeometry: GeometryFn = (part) => ({
  box: { x: part.x, y: part.y, w: TANK_W, h: TANK_H },
  ports: { out: [part.x + 160, part.y], ret: [part.x + 280, part.y] },
  container: true,
});

/** Estanque: líquido, ondulación y litros. Canal: `level` (L). */
export const tankDrawer: DrawerFactory = ({ part, layers }) => {
  const g = group(layers.behind, { part: part.id });
  el('rect', { x: part.x, y: part.y, width: TANK_W, height: TANK_H, rx: 14, class: 'part-body tank-body' }, g);
  const liquid = el('rect', { x: part.x + 6, y: part.y, width: TANK_W - 12, height: 0, rx: 8, class: 'liquid fluid-fuel' }, g);
  const surface = el('path', { class: 'liquid-surface' }, g);
  label(g, part.x + TANK_W - 12, part.y + 22, 'Estanque', { anchor: 'end', className: 'lbl part-label' });
  const text = label(g, part.x + TANK_W - 12, part.y + 42, '', { anchor: 'end', className: 'lbl-small lbl-mono' });
  let wave = 0;
  return {
    g,
    update(channels, dt): void {
      const level = channelNumber(channels, 'level');
      const hgt = clamp(level / 50, 0, 1) * (TANK_H - 12);
      const top = part.y + TANK_H - 6 - hgt;
      liquid.setAttribute('y', top.toFixed(1));
      liquid.setAttribute('height', hgt.toFixed(1));
      wave += dt * 2.5;
      const amp = hgt > 2 ? 2 : 0;
      let d = `M ${part.x + 6} ${top}`;
      for (let x = part.x + 6; x <= part.x + TANK_W - 6; x += 20) {
        d += ` L ${x} ${(top + Math.sin(x / 25 + wave) * amp).toFixed(1)}`;
      }
      surface.setAttribute('d', d);
      text.textContent = `${level.toFixed(1).replace('.', ',')} L`;
    },
  };
};

/** Colador bajo la bomba: `a` desde el estanque, `b` arriba hacia la bomba. */
export const strainerGeometry: GeometryFn = (part) => ({
  box: { x: part.x, y: part.y, w: 64, h: 22 },
  ports: { a: [part.x, part.y + 11], b: [part.x + 32, part.y] },
});

/** Colador: malla punteada. Sin canales (la falla no se dibuja). */
export const strainerDrawer: DrawerFactory = ({ part, layers }) => {
  const g = group(layers.parts, { part: part.id });
  el('rect', { x: part.x, y: part.y, width: 64, height: 22, rx: 4, class: 'part-body strainer-body' }, g);
  label(g, part.x + 70, part.y + 16, 'Colador', { className: 'lbl-small part-label' });
  return {
    g,
    update(): void {},
  };
};

/** Bomba sumergida: aspira abajo, impulsa arriba; bornes a la izquierda. */
export const pumpGeometry: GeometryFn = (part) => ({
  box: { x: part.x, y: part.y, w: 48, h: 136 },
  ports: {
    in: [part.x + 24, part.y + 136],
    out: [part.x + 24, part.y],
    'e+': [part.x, part.y + 22],
    'e-': [part.x, part.y + 44],
  },
});

/** Bomba eléctrica: cuerpo, rotor. Canal: `flow` (L/h) gira el rotor. */
export const pumpDrawer: DrawerFactory = ({ part, layers }) => {
  const g = group(layers.parts, { part: part.id });
  el('rect', { x: part.x, y: part.y, width: 48, height: 136, rx: 10, class: 'part-body pump-body' }, g);
  const rotor = group(g);
  el('circle', { cx: part.x + 24, cy: part.y + 82, r: 15, class: 'rotor' }, rotor);
  el('line', { x1: part.x + 11, y1: part.y + 82, x2: part.x + 37, y2: part.y + 82, class: 'rotor-vane' }, rotor);
  el('line', { x1: part.x + 24, y1: part.y + 69, x2: part.x + 24, y2: part.y + 95, class: 'rotor-vane' }, rotor);
  el('text', { x: part.x + 24, y: part.y + 32, 'text-anchor': 'middle', class: 'lbl-small', text: 'M' }, g);
  label(g, part.x + 56, part.y + 122, 'Bomba', { className: 'lbl-small part-label' });
  let angle = 0;
  return {
    g,
    update(channels, dt): void {
      angle = (angle + channelNumber(channels, 'flow') * dt * 25) % 360;
      rotor.setAttribute('transform', `rotate(${angle.toFixed(1)} ${part.x + 24} ${part.y + 82})`);
    },
  };
};

/** Montada sobre el tubo de salida de la bomba. */
export const checkValveGeometry: GeometryFn = (part) => ({
  box: { x: part.x - 10, y: part.y - 10, w: 20, h: 20 },
  inline: true,
});

/** Válvula check: bola que se levanta con caudal. Canal: `flow` (L/h). */
export const checkValveDrawer: DrawerFactory = ({ part, layers }) => {
  const g = group(layers.parts, { part: part.id });
  el('circle', { cx: part.x, cy: part.y, r: 10, class: 'part-body' }, g);
  const flap = el('path', { d: `M ${part.x - 7} ${part.y + 4} L ${part.x + 7} ${part.y + 4} L ${part.x} ${part.y - 6} Z`, class: 'check-flap' }, g);
  label(g, part.x + 14, part.y - 4, 'Check', { className: 'lbl-small part-label' });
  let open = false;
  return {
    g,
    update(channels): void {
      const now = channelNumber(channels, 'flow') > 0.5;
      if (now === open) return;
      open = now;
      flap.setAttribute('transform', now ? 'translate(0 -4)' : '');
    },
  };
};
