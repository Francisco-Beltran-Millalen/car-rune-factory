// Drawers de la lubricación (A14). Coordenadas relativas a `part.x/part.y`.

import { clamp } from '../../../../core/math.ts';
import { el, group, label } from '../../../../core/svg.ts';
import type { DrawerFactory, GeometryFn } from '../../types.ts';
import { channelNumber } from '../../util.ts';

/** Cárter: la rejilla (sub-pieza) entrega arriba a la bomba; los retornos
 *  caen por `ret`, arriba a la derecha. */
export const sumpGeometry: GeometryFn = (part) => ({
  box: { x: part.x, y: part.y, w: 420, h: 150 },
  ports: { ret: [part.x + 400, part.y] },
  subparts: {
    pickup: { box: { x: part.x + 60, y: part.y + 40, w: 40, h: 70 }, ports: { b: [part.x + 80, part.y + 40] } },
    drainPlug: { box: { x: part.x + 290, y: part.y + 132, w: 20, h: 18 } },
  },
});

/** Cárter con nivel, inclinación, chupador y tapón. Canales: `level`, `tilt`,
 *  `air`, `pickupDirt` (rejilla) y `drip` (tapón). */
export const sumpDrawer: DrawerFactory = ({ part, layers }) => {
  const g = group(layers.parts, { part: part.id });
  const W = 420;
  const H = 150;
  el('rect', { x: part.x, y: part.y, width: W, height: H, rx: 12, class: 'part-body' }, g);
  const oil = group(g);
  const liquid = el('rect', { x: part.x + 6, y: part.y + 40, width: W - 12, height: H - 46, rx: 8, class: 'liquid fluid-oil' }, oil);
  const drops = [0, 1, 2].map(() => el('circle', { r: 3, class: 'p-air', opacity: 0 }, g));
  const pickup = group(g, { part: 'pickup' });
  el('rect', { x: part.x + 60, y: part.y + 40, width: 40, height: 70, rx: 6, class: 'pickup-screen' }, pickup);
  for (let i = 0; i < 5; i++) {
    el('line', { x1: part.x + 62, y1: part.y + 48 + i * 12, x2: part.x + 98, y2: part.y + 48 + i * 12, class: 'screen-mesh' }, pickup);
  }
  const screenDirt = el('rect', { x: part.x + 62, y: part.y + 42, width: 36, height: 66, rx: 5, class: 'filter-dirt' }, pickup);
  const plug = group(g, { part: 'drainPlug' });
  el('circle', { cx: part.x + 300, cy: part.y + H - 8, r: 10, class: 'drain-plug' }, plug);
  const drip = el('circle', { cx: part.x + 300, cy: part.y + H + 14, r: 4, class: 'drop-oil' }, g);
  label(g, part.x + W - 12, part.y + 24, 'Cárter', { anchor: 'end', className: 'lbl part-label' });
  const text = label(g, part.x + W - 12, part.y + H - 14, '', { anchor: 'end', className: 'lbl-small lbl-mono' });
  let t = 0;
  return {
    g,
    update(channels, dt): void {
      const level = clamp(channelNumber(channels, 'level'), 0, 5);
      const h = (level / 5) * (H - 46);
      liquid.setAttribute('y', String(part.y + H - 6 - h));
      liquid.setAttribute('height', String(h));
      text.textContent = `${level.toFixed(2).replace('.', ',')} L`;
      const tilt = clamp(channelNumber(channels, 'tilt'), 0, 1);
      oil.setAttribute('transform', `rotate(${(-tilt * 4).toFixed(1)} ${part.x + W / 2} ${part.y + H})`);
      const air = clamp(channelNumber(channels, 'air'), 0, 1);
      t += dt;
      drops.forEach((drop, i) => {
        const ph = (t * 1.5 + i / 3) % 1;
        drop.setAttribute('cx', String(part.x + 120 + i * 70));
        drop.setAttribute('cy', String(part.y + H - 20 - ph * 60));
        drop.style.opacity = air > 0.1 ? ((1 - ph) * air).toFixed(2) : '0';
      });
      screenDirt.style.opacity = String(clamp(channelNumber(channels, 'pickupDirt'), 0, 1) * 0.7);
      const dripping = channelNumber(channels, 'drip') > 0;
      const fall = (t * 0.8) % 1;
      drip.setAttribute('cy', String(part.y + H + 4 + fall * 24));
      drip.style.opacity = dripping ? (1 - fall).toFixed(2) : '0';
    },
  };
};

/** Aspira por abajo (de la rejilla) e impulsa por la derecha. */
export const gearPumpGeometry: GeometryFn = (part) => ({
  box: { x: part.x, y: part.y, w: 120, h: 100 },
  ports: { in: [part.x + 60, part.y + 100], out: [part.x + 120, part.y + 50] },
});

/** Bomba de engranajes: dos ruedas que giran ∝ rpm. Canales: `rpm`, `air`. */
export const gearPumpDrawer: DrawerFactory = ({ part, layers }) => {
  const g = group(layers.parts, { part: part.id });
  el('rect', { x: part.x, y: part.y, width: 120, height: 100, rx: 10, class: 'part-body' }, g);
  const gearA = group(g);
  const gearB = group(g);
  for (const [cx, cy, grp] of [
    [part.x + 42, part.y + 50, gearA],
    [part.x + 78, part.y + 50, gearB],
  ] as const) {
    el('circle', { cx, cy, r: 22, class: 'gear-body' }, grp);
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      el('line', { x1: cx + Math.cos(a) * 22, y1: cy + Math.sin(a) * 22, x2: cx + Math.cos(a) * 30, y2: cy + Math.sin(a) * 30, class: 'gear-tooth' }, grp);
    }
  }
  label(g, part.x + 60, part.y - 8, 'Bomba de aceite', { anchor: 'middle', className: 'lbl-small part-label' });
  let angle = 0;
  return {
    g,
    update(channels, dt): void {
      // Vista lenta a propósito: 1 vuelta/s a 1500 rpm.
      angle = (angle + channelNumber(channels, 'rpm') * dt * 0.24) % 360;
      gearA.setAttribute('transform', `rotate(${angle.toFixed(1)} ${part.x + 42} ${part.y + 50})`);
      gearB.setAttribute('transform', `rotate(${(-angle).toFixed(1)} ${part.x + 78} ${part.y + 50})`);
      const air = channelNumber(channels, 'air');
      gearA.style.opacity = air > 0.5 ? '0.6' : '1';
      gearB.style.opacity = air > 0.5 ? '0.6' : '1';
    },
  };
};

/** Entra por la izquierda (presión de la bomba) y descarga por abajo al cárter. */
export const reliefValveGeometry: GeometryFn = (part) => ({
  box: { x: part.x, y: part.y, w: 90, h: 110 },
  ports: { in: [part.x, part.y + 50], ret: [part.x + 45, part.y + 110] },
});

/** Válvula de alivio con resorte. Canales: `open`, `pressure`. */
export const reliefValveDrawer: DrawerFactory = ({ part, layers }) => {
  const g = group(layers.parts, { part: part.id });
  el('rect', { x: part.x, y: part.y, width: 90, height: 110, rx: 10, class: 'part-body' }, g);
  const ball = el('circle', { cx: part.x + 45, cy: part.y + 50, r: 10, class: 'valve-ball' }, g);
  const spring: [number, number][] = [];
  for (let i = 0; i <= 10; i++) spring.push([part.x + 45 + (i % 2 ? 8 : -8), part.y + 18 + i * 2.4]);
  el('polyline', { points: spring.map((p) => p.join(',')).join(' '), class: 'spring' }, g);
  label(g, part.x + 45, part.y - 8, 'Alivio', { anchor: 'middle', className: 'lbl-small part-label' });
  return {
    g,
    update(channels): void {
      const open = clamp(channelNumber(channels, 'open') / 2000, 0, 1);
      ball.setAttribute('transform', `translate(0 ${(open * 14).toFixed(1)})`);
    },
  };
};

/** Entra por abajo y sale por arriba; el bypass (sub-pieza) a su izquierda
 *  y, en el enroscable, la válvula antirretorno arriba. */
export const oilFilterGeometry: GeometryFn = (part, def) => ({
  box: { x: part.x, y: part.y, w: 90, h: 120 },
  ports: { a: [part.x + 45, part.y + 120], b: [part.x + 45, part.y] },
  subparts: {
    filterBypass: {
      box: { x: part.x - 40, y: part.y + 40, w: 20, h: 50 },
      ports: { in: [part.x - 30, part.y + 90], ret: [part.x - 30, part.y + 40] },
    },
    ...(def.id === 'lubrication-lamp'
      ? { antiDrainback: { box: { x: part.x + 37, y: part.y + 8, w: 16, h: 16 } } }
      : {}),
  },
});

/** Filtro: carcasa o enroscable, suciedad y bypass. Canales: `dirt`, `bypass`,
 *  `leak`, `dp` y `antiDrainbackFailed` (sólo enroscable). */
export const oilFilterDrawer: DrawerFactory = ({ part, def, layers }) => {
  const g = group(layers.parts, { part: part.id });
  const spinOn = def.id === 'lubrication-lamp';
  el('rect', { x: part.x, y: part.y, width: 90, height: 120, rx: spinOn ? 14 : 6, class: 'part-body' }, g);
  const dirt = el('rect', { x: part.x + 4, y: part.y + 4, width: 82, height: 112, rx: 10, class: 'filter-dirt' }, g);
  dirt.style.opacity = '0';
  label(g, part.x + 98, part.y + 24, spinOn ? 'Filtro enroscable' : 'Filtro de cartucho', { className: 'lbl part-label' });
  const bypass = group(g, { part: 'filterBypass' });
  el('line', { x1: part.x - 30, y1: part.y + 40, x2: part.x - 30, y2: part.y + 90, class: 'bypass-line' }, bypass);
  const flap = el('line', { x1: part.x - 40, y1: part.y + 90, x2: part.x - 20, y2: part.y + 70, class: 'bypass-flap' }, bypass);
  const leak = el('circle', { cx: part.x + 80, cy: part.y + 130, r: 4, class: 'drop-oil' }, g);
  const anti = spinOn ? el('circle', { cx: part.x + 45, cy: part.y + 16, r: 8, class: 'anti-drainback' }, group(g, { part: 'antiDrainback' })) : null;
  const dp = label(g, part.x + 98, part.y + 44, '', { className: 'lbl-small lbl-mono' });
  let t = 0;
  return {
    g,
    update(channels, dt): void {
      dirt.style.opacity = String(clamp(channelNumber(channels, 'dirt'), 0, 1) * 0.7);
      const open = clamp(channelNumber(channels, 'bypass'), 0, 1);
      flap.setAttribute('transform', `rotate(${(-60 * open).toFixed(1)} ${part.x - 40} ${part.y + 90})`);
      t += dt;
      leak.style.opacity = channelNumber(channels, 'leak') > 0.3 ? ((0.5 + 0.5 * Math.sin(t * 8))).toFixed(2) : '0';
      dp.textContent = `Δp ${channelNumber(channels, 'dp').toFixed(2).replace('.', ',')} bar`;
      anti?.classList.toggle('failed', channelNumber(channels, 'antiDrainbackFailed') > 0.5);
    },
  };
};

/** La galería es un tramo de tubo grueso: las derivaciones corren por dentro. */
export const galleryGeometry: GeometryFn = (part) => ({
  box: { x: part.x, y: part.y, w: 260, h: 34 },
  ports: { a: [part.x, part.y + 17] },
  inline: true,
});

/** Galería con las derivaciones a los cojinetes. Canales: `pressure`, `flow`. */
export const galleryDrawer: DrawerFactory = ({ part, layers }) => {
  const g = group(layers.parts, { part: part.id });
  el('rect', { x: part.x, y: part.y, width: 260, height: 34, rx: 17, class: 'gallery-body' }, g);
  label(g, part.x + 130, part.y - 10, 'Galería principal', { anchor: 'middle', className: 'lbl part-label' });
  const text = label(g, part.x + 130, part.y + 52, '', { anchor: 'middle', className: 'lbl-small lbl-mono' });
  return {
    g,
    update(channels): void {
      text.textContent = `${channelNumber(channels, 'pressure').toFixed(2).replace('.', ',')} bar`;
    },
  };
};

/** Recibe arriba (de la galería) y gotea abajo (al cárter). */
export const bearingGeometry: GeometryFn = (part) => ({
  box: { x: part.x + 12, y: part.y - 18, w: 36, h: 36 },
  ports: { a: [part.x + 30, part.y - 18], b: [part.x + 30, part.y + 18] },
});

/** Cojinete: casco con desgaste y golpeteo. Canales: `wear`, `knock`. */
export const bearingDrawer: DrawerFactory = ({ part, layers }) => {
  const g = group(layers.parts, { part: part.id });
  const shell = el('circle', { cx: part.x + 30, cy: part.y, r: 18, class: 'bearing-shell' }, g);
  el('circle', { cx: part.x + 30, cy: part.y, r: 8, class: 'bearing-hole' }, g);
  label(g, part.x + 52, part.y + 4, part.label ?? 'Cojinete', { className: 'lbl-small part-label' });
  return {
    g,
    update(channels): void {
      const wear = clamp(channelNumber(channels, 'wear'), 0, 1);
      shell.classList.toggle('worn', wear > 0.5);
      const knock = clamp(channelNumber(channels, 'knock'), 0, 1);
      g.setAttribute('transform', knock > 0.3 ? `translate(0 ${(Math.sin(knock * 40) * 2).toFixed(1)})` : '');
    },
  };
};

/** Testigo del tablero: entra por la izquierda (llave) y sale por abajo (al interruptor). */
export const warningLampGeometry: GeometryFn = (part) => ({
  box: { x: part.x + 2, y: part.y + 2, w: 36, h: 36 },
  ports: { a: [part.x + 2, part.y + 20], b: [part.x + 20, part.y + 38] },
});

/** Testigo de presión de aceite. Canal: `on`. */
export const warningLampDrawer: DrawerFactory = ({ part, layers }) => {
  const g = group(layers.parts, { part: part.id });
  el('circle', { cx: part.x + 20, cy: part.y + 20, r: 18, class: 'lamp-face' }, g);
  const glow = el('circle', { cx: part.x + 20, cy: part.y + 20, r: 14, class: 'lamp-glow' }, g);
  label(g, part.x + 44, part.y + 16, 'Testigo', { className: 'lbl-small part-label' });
  label(g, part.x + 44, part.y + 30, 'de aceite', { className: 'lbl-small part-label' });
  return {
    g,
    update(channels): void {
      glow.style.opacity = channelNumber(channels, 'on') > 0.5 ? '0.9' : '0';
    },
  };
};

/** Interruptor de presión atornillado a la galería: cable arriba, masa por el bloque. */
export const oilPressureSwitchGeometry: GeometryFn = (part) => ({
  box: { x: part.x, y: part.y, w: 28, h: 28 },
  ports: { a: [part.x + 14, part.y] },
});

/** Interruptor de presión: abre con presión, cierra a masa bajo 0,5 bar. Canal: `closed`. */
export const oilPressureSwitchDrawer: DrawerFactory = ({ part, layers }) => {
  const g = group(layers.parts, { part: part.id });
  el('rect', { x: part.x, y: part.y, width: 28, height: 28, rx: 5, class: 'part-body' }, g);
  const arm = el('line', { x1: part.x + 6, y1: part.y + 16, x2: part.x + 22, y2: part.y + 16, class: 'relay-arm' }, g);
  // Masa por el bloque (el enlace a `battery.-` es sólo del modelo).
  el('path', { d: `M ${part.x + 14} ${part.y + 28} v 6 m -8 0 h 16 m -12 4 h 8 m -5 4 h 2`, class: 'ground-mark' }, g);
  label(g, part.x + 34, part.y + 12, 'Interruptor', { className: 'lbl-small part-label' });
  label(g, part.x + 34, part.y + 26, 'de presión', { className: 'lbl-small part-label' });
  return {
    g,
    update(channels): void {
      arm.setAttribute('transform', channelNumber(channels, 'closed') > 0.5 ? '' : `rotate(-25 ${part.x + 6} ${part.y + 16})`);
    },
  };
};

export const oilGaugeGeometry: GeometryFn = (part) => ({
  box: { x: part.x + 8, y: part.y + 8, w: 104, h: 104 },
});

/** Manómetro de aceite. Canales: `pressure`, `real`. */
export const oilGaugeDrawer: DrawerFactory = ({ part, layers }) => {
  const g = group(layers.parts, { part: part.id });
  const cx = part.x + 60;
  const cy = part.y + 60;
  el('circle', { cx, cy, r: 52, class: 'gauge-face' }, g);
  for (let i = 0; i <= 6; i++) {
    const a = ((i * 40 - 120) * Math.PI) / 180;
    el('line', { x1: cx + Math.cos(a) * 40, y1: cy + Math.sin(a) * 40, x2: cx + Math.cos(a) * 48, y2: cy + Math.sin(a) * 48, class: 'gauge-tick' }, g);
  }
  const needle = el('line', { x1: cx, y1: cy, x2: cx, y2: cy - 40, class: 'gauge-needle' }, g);
  el('circle', { cx, cy, r: 4, class: 'gauge-hub' }, g);
  label(g, cx, cy + 74, 'Presión de aceite', { anchor: 'middle', className: 'lbl part-label' });
  const text = label(g, cx, cy + 92, '', { anchor: 'middle', className: 'lbl-small lbl-mono' });
  return {
    g,
    update(channels): void {
      const p = clamp(channelNumber(channels, 'pressure'), 0, 6);
      const a = -120 + (p / 6) * 240;
      needle.setAttribute('transform', `rotate(${a.toFixed(1)} ${cx} ${cy})`);
      text.textContent = `${p.toFixed(2).replace('.', ',')} bar`;
    },
  };
};
