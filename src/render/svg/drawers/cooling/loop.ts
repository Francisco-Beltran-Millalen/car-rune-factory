// Drawers del radiador, ventilador, depósito, calefactor y reloj (A13).

import { clamp } from '../../../../core/math.ts';
import { el, group, label } from '../../../../core/svg.ts';
import type { DrawerFactory, GeometryFn } from '../../types.ts';
import { channelNumber } from '../../util.ts';

/** Entra arriba a la izquierda y sale por abajo; la tapa es sub-pieza. */
export const radiatorGeometry: GeometryFn = (part) => ({
  box: { x: part.x, y: part.y, w: 90, h: 320 },
  ports: { a: [part.x, part.y + 15], b: [part.x + 45, part.y + 320] },
  subparts: { radiatorCap: { box: { x: part.x + 24, y: part.y - 18, w: 42, h: 18 } } },
});

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
  label(g, part.x + 98, part.y + 160, 'Radiador', { className: 'lbl part-label' });
  const temp = label(g, part.x + 98, part.y + 180, '', { className: 'lbl-small lbl-mono' });
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

// `p.id` puede venir prefijado dentro de un vehículo (`cooling:fanMotor`,
// A15 §3.1): además del nombre bien de siempre, alcanza con que termine así.
const hasElectricFan = (def: { parts: readonly { id: string }[] }): boolean =>
  def.parts.some((p) => p.id === 'fanMotor' || p.id.endsWith(':fanMotor'));

/**
 * Ventilador con su carcasa. Eléctrico: fila de fusible → relé → motor bajo la
 * carcasa (sub-piezas cableadas; el motor va a masa) y el termocontacto a la
 * derecha. Viscoso: el embrague en el cubo.
 */
export const fanGeometry: GeometryFn = (part, def) => {
  const cx = part.x + 80;
  const cy = part.y + 100;
  const row = cy + 96;
  const box = { x: cx - 82, y: cy - 82, w: 164, h: 164 };
  if (!hasElectricFan(def)) {
    return { box, subparts: { fanClutch: { box: { x: cx - 26, y: cy - 26, w: 52, h: 52 } } } };
  }
  return {
    box,
    subparts: {
      fuse: { box: { x: cx - 110, y: row, w: 34, h: 20 }, ports: { a: [cx - 110, row + 10], b: [cx - 76, row + 10] } },
      fanRelay: { box: { x: cx - 50, y: row - 4, w: 44, h: 28 }, ports: { a: [cx - 50, row + 10], b: [cx - 6, row + 10] } },
      fanMotor: { box: { x: cx + 30, y: row - 5, w: 46, h: 30 }, ports: { a: [cx + 30, row + 10], b: [cx + 76, row + 10] } },
      fanSwitch: { box: { x: cx + 110, y: row - 4, w: 28, h: 28 } },
    },
  };
};

// Giro dibujado por m/s de aire (`speed`). Con 45 el viscoso en ralentí frío
// (0,56 m/s) giraba 25 °/s y parecía quieto; con 200 gira 112 °/s, y a tope
// (9 m/s) 1800 °/s = 30° por cuadro a 60 fps, bajo los 36° en que 5 aspas
// parecen girar al revés.
const FAN_DEG_PER_S_PER_MS = 200;

/** Ventilador: aspas, motor/termocontacto (eléctrico) o embrague (viscoso).
 *  Canales: `speed`, `dead`, `relay` (relé cerrado), `switch` (termocontacto). */
export const fanDrawer: DrawerFactory = ({ part, def, layers }) => {
  const g = group(layers.parts, { part: part.id });
  const cx = part.x + 80;
  const cy = part.y + 100;
  const row = cy + 96;
  const blades = group(g);
  const bladeEls: SVGElement[] = [];
  for (let i = 0; i < 5; i++) {
    bladeEls.push(el('ellipse', { cx: cx - 34, cy, rx: 34, ry: 12, class: 'fan-blade', transform: `rotate(${i * 72} ${cx} ${cy})` }, blades));
  }
  el('circle', { cx, cy, r: 12, class: 'dist-hub' }, g);
  el('circle', { cx, cy, r: 82, class: 'fan-shroud' }, g);
  label(g, cx, cy - 90, 'Ventilador', { anchor: 'middle', className: 'lbl-small part-label' });

  let relayArm: SVGElement | null = null;
  let switchDot: SVGElement | null = null;
  if (hasElectricFan(def)) {
    const fuse = group(g, { part: 'fuse' });
    el('rect', { x: cx - 110, y: row, width: 34, height: 20, rx: 9, class: 'part-body fuse' }, fuse);
    label(g, cx - 93, row + 36, 'Fusible', { anchor: 'middle', className: 'lbl-small part-label' });
    const relay = group(g, { part: 'fanRelay' });
    el('rect', { x: cx - 50, y: row - 4, width: 44, height: 28, rx: 5, class: 'part-body' }, relay);
    relayArm = el('line', { x1: cx - 42, y1: row + 10, x2: cx - 14, y2: row + 10, class: 'relay-arm' }, relay);
    label(g, cx - 28, row + 38, 'Relé', { anchor: 'middle', className: 'lbl-small part-label' });
    const motor = group(g, { part: 'fanMotor' });
    el('rect', { x: cx + 30, y: row - 5, width: 46, height: 30, rx: 6, class: 'part-body' }, motor);
    el('text', { x: cx + 53, y: row + 15, 'text-anchor': 'middle', class: 'lbl-small', text: 'M' }, motor);
    // El motor va a masa por la carrocería (el enlace a `battery.-` no se dibuja).
    el('path', { d: `M ${cx + 76} ${row + 10} h 12 v 8 m -8 0 h 16 m -12 4 h 8 m -5 4 h 2`, class: 'ground-mark' }, motor);
    const sw = group(g, { part: 'fanSwitch' });
    el('circle', { cx: cx + 124, cy: row + 10, r: 14, class: 'part-body' }, sw);
    switchDot = el('circle', { cx: cx + 124, cy: row + 10, r: 5, class: 'switch-dot' }, sw);
    label(g, cx + 124, row + 40, 'Termocontacto', { anchor: 'middle', className: 'lbl-small part-label' });
  } else {
    const clutch = group(g, { part: 'fanClutch' });
    el('circle', { cx, cy, r: 26, class: 'clutch' }, clutch);
  }

  let angle = 0;
  let dead: boolean | null = null;
  return {
    g,
    update(channels, dt): void {
      const speed = channelNumber(channels, 'speed');
      angle = (angle + speed * dt * FAN_DEG_PER_S_PER_MS) % 360;
      blades.setAttribute('transform', `rotate(${angle.toFixed(1)} ${cx} ${cy})`);
      const nowDead = channelNumber(channels, 'dead') > 0.5;
      if (nowDead !== dead) {
        dead = nowDead;
        for (const n of bladeEls) n.classList.toggle('dead', nowDead);
      }
      relayArm?.setAttribute('transform', channelNumber(channels, 'relay') > 0.5 ? '' : `rotate(-25 ${cx - 42} ${row + 10})`);
      switchDot?.classList.toggle('on', channelNumber(channels, 'switch') > 0.5);
    },
  };
};

/** Conecta por abajo a la aspiración de la bomba. */
export const expansionTankGeometry: GeometryFn = (part) => ({
  box: { x: part.x, y: part.y, w: 120, h: 120 },
  ports: { a: [part.x + 60, part.y + 120] },
});

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

/** La llave (sub-pieza) a la derecha: entra por su derecha y pasa al panal;
 *  el panal devuelve por abajo. */
export const heaterCoreGeometry: GeometryFn = (part) => ({
  box: { x: part.x, y: part.y, w: 80, h: 80 },
  ports: { a: [part.x + 80, part.y + 40], b: [part.x + 40, part.y + 80] },
  subparts: {
    heaterValve: {
      box: { x: part.x + 94, y: part.y + 24, w: 32, h: 32 },
      ports: { a: [part.x + 126, part.y + 40], b: [part.x + 94, part.y + 40] },
    },
  },
});

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

export const tempGaugeGeometry: GeometryFn = (part) => ({
  box: { x: part.x + 18, y: part.y + 8, w: 104, h: 104 },
  subparts: { tempSensor: { box: { x: part.x + 130, y: part.y + 80, w: 20, h: 20 } } },
});

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
