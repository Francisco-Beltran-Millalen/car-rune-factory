// Drawers eléctricos del combustible (A7): batería, llave, relé, ECU y el
// arnés de los inyectores. Las coordenadas son relativas a `part.x/part.y`.

import { expSmooth, wrap } from '../../../core/math.ts';
import { group, el, label, roundedPathD } from '../../../core/svg.ts';
import type { DrawerFactory } from '../types.ts';
import { channelBool, channelNumber, channelString } from '../util.ts';

const KEY_LABEL: Readonly<Record<string, string>> = {
  off: 'Apagado',
  on: 'Contacto',
  start: 'Arranque',
  run: 'Marcha',
};
const KEY_ANGLE: Readonly<Record<string, number>> = { off: -45, on: 0, start: 45, run: 20 };

/** Batería: cuerpo, bornes y tensión. Canal: `v` (V). */
export const batteryDrawer: DrawerFactory = ({ part, layers }) => {
  const g = group(layers.parts, { part: part.id });
  el('rect', { x: part.x, y: part.y, width: 80, height: 60, rx: 6, class: 'part-body' }, g);
  el('rect', { x: part.x + 15, y: part.y - 8, width: 12, height: 8, class: 'part-body' }, g);
  el('rect', { x: part.x + 53, y: part.y - 8, width: 12, height: 8, class: 'part-body' }, g);
  const text = label(g, part.x + 40, part.y + 36, '', { anchor: 'middle', className: 'lbl lbl-mono' });
  label(g, part.x + 40, part.y + 78, 'Batería', { anchor: 'middle', className: 'lbl-small part-label' });
  return {
    g,
    ports: { '+': [part.x + 80, part.y + 30], '-': [part.x + 80, part.y + 60] },
    update(channels): void {
      text.textContent = `${channelNumber(channels, 'v').toFixed(1).replace('.', ',')} V`;
    },
  };
};

/** Llave de contacto: cuerpo, lengüeta y etiqueta. Canal: `position`. */
export const keyDrawer: DrawerFactory = ({ part, layers }) => {
  const g = group(layers.parts, { part: part.id });
  el('rect', { x: part.x, y: part.y, width: 80, height: 60, rx: 30, class: 'part-body' }, g);
  const blade = el('line', { x1: part.x + 40, y1: part.y + 30, x2: part.x + 40, y2: part.y + 8, class: 'key-blade' }, g);
  const text = label(g, part.x + 40, part.y + 78, '', { anchor: 'middle', className: 'lbl-small' });
  let last = '';
  return {
    g,
    ports: { a: [part.x, part.y + 30], b: [part.x + 80, part.y + 30] },
    update(channels): void {
      const pos = channelString(channels, 'position', 'off');
      if (pos === last) return;
      last = pos;
      text.textContent = KEY_LABEL[pos] ?? pos;
      blade.setAttribute('transform', `rotate(${KEY_ANGLE[pos] ?? 0} ${part.x + 40} ${part.y + 30})`);
    },
  };
};

/** Relé: contactos y brazo. Canal: `closed`. */
export const relayDrawer: DrawerFactory = ({ part, layers }) => {
  const g = group(layers.parts, { part: part.id });
  el('rect', { x: part.x, y: part.y, width: 80, height: 60, rx: 6, class: 'part-body' }, g);
  el('circle', { cx: part.x + 20, cy: part.y + 40, r: 3, class: 'contact' }, g);
  el('circle', { cx: part.x + 60, cy: part.y + 40, r: 3, class: 'contact' }, g);
  const arm = el('line', { x1: part.x + 20, y1: part.y + 40, x2: part.x + 60, y2: part.y + 40, class: 'relay-arm' }, g);
  label(g, part.x + 40, part.y + 20, 'Relé', { anchor: 'middle', className: 'lbl-small part-label' });
  let closed: boolean | null = null;
  return {
    g,
    ports: { a: [part.x, part.y + 30], b: [part.x + 80, part.y + 30] },
    update(channels): void {
      const now = channelBool(channels, 'closed');
      if (now === closed) return;
      closed = now;
      arm.setAttribute('transform', now ? '' : `rotate(-28 ${part.x + 20} ${part.y + 40})`);
    },
  };
};

/** ECU: caja y rpm. Canal: `rpm`. */
export const ecuDrawer: DrawerFactory = ({ part, layers }) => {
  const g = group(layers.parts, { part: part.id });
  el('rect', { x: part.x, y: part.y, width: 120, height: 60, rx: 6, class: 'part-body ecu-body' }, g);
  label(g, part.x + 60, part.y + 27, 'ECU', { anchor: 'middle', className: 'lbl part-label' });
  const text = label(g, part.x + 60, part.y + 48, '', { anchor: 'middle', className: 'lbl-small lbl-mono' });
  return {
    g,
    update(channels): void {
      const rpm = channelNumber(channels, 'rpm');
      text.textContent = rpm > 0 ? `${Math.round(rpm)} rpm` : '';
    },
  };
};

const FIRING_OFFSETS = [0, 540, 180, 360]; // inyectores 1..4, orden 1-3-4-2

/** Arnés ECU → inyectores: un trazo por inyector que pulsa al abrir. */
export const wiresDrawer: DrawerFactory = ({ part, def, layers }) => {
  const g = group(layers.pipes);
  const injectors = def.parts.filter((p) => p.visual === 'injector');
  const yTop = part.y;
  const wires = injectors.map((inj) =>
    el(
      'path',
      {
        d: roundedPathD([[part.x, yTop], [inj.x + 26, yTop], [inj.x + 26, yTop + 152], [inj.x + 12, yTop + 152]], 6),
        class: 'signal-wire',
        part: part.id,
      },
      g,
    ),
  );
  let prevCrank: number | null = null;
  const intensity = wires.map(() => 0);
  return {
    g,
    update(channels, dt): void {
      const crank = channelNumber(channels, 'crank');
      const rpm = channelNumber(channels, 'rpm');
      const delta = prevCrank === null ? 0 : wrap(crank - prevCrank, 720);
      wires.forEach((wire, i) => {
        const offset = FIRING_OFFSETS[i] ?? 0;
        const crossed = rpm > 0 && delta > 0 && wrap(offset - (prevCrank ?? 0), 720) < delta;
        intensity[i] = crossed ? 1 : expSmooth(intensity[i] ?? 0, 0, dt, 0.04);
        wire.classList.toggle('pulse', (intensity[i] ?? 0) > 0.5);
      });
      prevCrank = crank;
    },
  };
};
