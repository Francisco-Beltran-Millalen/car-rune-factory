// Drawers de la lubricación (A14). Coordenadas relativas a `part.x/part.y`.

import { clamp } from '../../../../core/math.ts';
import { el, group, label } from '../../../../core/svg.ts';
import type { DrawerFactory } from '../../types.ts';
import { channelNumber } from '../../util.ts';

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
  label(g, part.x + 60, part.y + 112, 'Bomba de aceite', { anchor: 'middle', className: 'lbl-small part-label' });
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

/** Válvula de alivio con resorte. Canales: `open`, `pressure`. */
export const reliefValveDrawer: DrawerFactory = ({ part, layers }) => {
  const g = group(layers.parts, { part: part.id });
  el('rect', { x: part.x, y: part.y, width: 90, height: 110, rx: 10, class: 'part-body' }, g);
  const ball = el('circle', { cx: part.x + 45, cy: part.y + 50, r: 10, class: 'valve-ball' }, g);
  const spring: [number, number][] = [];
  for (let i = 0; i <= 10; i++) spring.push([part.x + 45 + (i % 2 ? 8 : -8), part.y + 18 + i * 2.4]);
  el('polyline', { points: spring.map((p) => p.join(',')).join(' '), class: 'spring' }, g);
  label(g, part.x + 45, part.y + 128, 'Alivio', { anchor: 'middle', className: 'lbl-small part-label' });
  return {
    g,
    update(channels): void {
      const open = clamp(channelNumber(channels, 'open') / 2000, 0, 1);
      ball.setAttribute('transform', `translate(0 ${(open * 14).toFixed(1)})`);
    },
  };
};

/** Filtro: carcasa o enroscable, suciedad y bypass. Canales: `dirt`, `bypass`,
 *  `leak`, `dp` y `antiDrainbackFailed` (sólo enroscable). */
export const oilFilterDrawer: DrawerFactory = ({ part, def, layers }) => {
  const g = group(layers.parts, { part: part.id });
  const spinOn = def.id === 'lubrication-lamp';
  el('rect', { x: part.x, y: part.y, width: 90, height: 120, rx: spinOn ? 14 : 6, class: 'part-body' }, g);
  const dirt = el('rect', { x: part.x + 4, y: part.y + 4, width: 82, height: 112, rx: 10, class: 'filter-dirt' }, g);
  dirt.style.opacity = '0';
  label(g, part.x + 45, part.y - 10, spinOn ? 'Filtro enroscable' : 'Filtro de cartucho', { anchor: 'middle', className: 'lbl part-label' });
  const bypass = group(g, { part: 'filterBypass' });
  el('line', { x1: part.x - 30, y1: part.y + 40, x2: part.x - 30, y2: part.y + 90, class: 'bypass-line' }, bypass);
  const flap = el('line', { x1: part.x - 40, y1: part.y + 90, x2: part.x - 20, y2: part.y + 70, class: 'bypass-flap' }, bypass);
  const leak = el('circle', { cx: part.x + 45, cy: part.y + 140, r: 4, class: 'drop-oil' }, g);
  const anti = spinOn ? el('circle', { cx: part.x + 45, cy: part.y + 16, r: 8, class: 'anti-drainback' }, group(g, { part: 'antiDrainback' })) : null;
  const dp = label(g, part.x + 45, part.y + 156, '', { anchor: 'middle', className: 'lbl-small lbl-mono' });
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

/** Cojinete: casco con desgaste y golpeteo. Canales: `wear`, `knock`. */
export const bearingDrawer: DrawerFactory = ({ part, layers }) => {
  const g = group(layers.parts, { part: part.id });
  const shell = el('circle', { cx: part.x + 30, cy: part.y, r: 18, class: 'bearing-shell' }, g);
  el('circle', { cx: part.x + 30, cy: part.y, r: 8, class: 'bearing-hole' }, g);
  label(g, part.x + 30, part.y + 34, 'Cojinete', { anchor: 'middle', className: 'lbl-small part-label' });
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

/** Testigo y su interruptor de presión. Canales: `on`, `closed`. */
export const warningLampDrawer: DrawerFactory = ({ part, layers }) => {
  const g = group(layers.parts, { part: part.id });
  el('circle', { cx: part.x + 20, cy: part.y + 20, r: 18, class: 'lamp-face' }, g);
  const glow = el('circle', { cx: part.x + 20, cy: part.y + 20, r: 14, class: 'lamp-glow' }, g);
  label(g, part.x + 20, part.y + 50, 'Aceite', { anchor: 'middle', className: 'lbl-small part-label' });
  const sw = group(g, { part: 'pressureSwitch' });
  el('rect', { x: part.x - 40, y: part.y + 10, width: 34, height: 24, rx: 5, class: 'part-body' }, sw);
  const arm = el('line', { x1: part.x - 34, y1: part.y + 22, x2: part.x - 12, y2: part.y + 22, class: 'relay-arm' }, sw);
  return {
    g,
    update(channels): void {
      const on = channelNumber(channels, 'on') > 0.5;
      glow.style.opacity = on ? '0.9' : '0';
      arm.setAttribute('transform', channelNumber(channels, 'closed') > 0.5 ? '' : `rotate(-25 ${part.x - 34} ${part.y + 22})`);
    },
  };
};

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
