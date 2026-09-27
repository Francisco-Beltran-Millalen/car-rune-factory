// Drawer del cuerpo del carburador (A16): boca de aire, venturi con los dos
// surtidores, mariposa, tornillo de mezcla y bomba de aceleración. Las
// piezas que no tienen puerto propio (venturi, mariposa, surtidores, tornillo
// y bomba de aceleración) son sub-dibujos de este cuerpo, sin geometría en el
// catálogo (spec §1: no están en la red del solver). Coordenadas relativas a
// `part.x/y`.

import { clamp } from '../../../../core/math.ts';
import { el, group, label } from '../../../../core/svg.ts';
import type { DrawerFactory, GeometryFn } from '../../types.ts';
import { channelNumber } from '../../util.ts';

const W = 380;
const H = 380;

export const carbBodyGeometry: GeometryFn = (part) => ({
  box: { x: part.x, y: part.y, w: W, h: H },
});

/** Cuerpo del carburador. Canales: `airMass` (kg/h), `throttle` (0..1),
 *  `mainFraction` (φ), `fuelDelivered` (L/h), `accelBoost`. */
export const carbBodyDrawer: DrawerFactory = ({ part, layers }) => {
  const g = group(layers.parts, { part: part.id });
  const cx = part.x + W / 2;
  el('rect', { x: part.x, y: part.y, width: W, height: H, rx: 16, class: 'part-body carb-body' }, g);

  // Boca de aire (airHorn): funnel que se angosta hacia el venturi.
  const airHorn = group(g, { part: 'airHorn' });
  el('path', {
    d: `M ${cx - 90} ${part.y} L ${cx - 30} ${part.y + 100} L ${cx + 30} ${part.y + 100} L ${cx + 90} ${part.y} Z`,
    class: 'venturi-wall',
  }, airHorn);
  const airArrows = [0, 1, 2].map(() =>
    el('path', { d: 'M -8 0 L 0 10 L 8 0', class: 'air-arrow' }, layers.fx),
  );

  // Venturi: estrechamiento con el surtidor principal.
  const venturi = group(g, { part: 'venturi' });
  el('path', {
    d: `M ${cx - 30} ${part.y + 100} L ${cx - 14} ${part.y + 160} L ${cx + 14} ${part.y + 160} L ${cx + 30} ${part.y + 100}`,
    class: 'venturi-wall',
  }, venturi);
  const mainJet = group(g, { part: 'mainJet' });
  el('circle', { cx: cx - 14, cy: part.y + 150, r: 4, class: 'jet-nozzle' }, mainJet);
  const mainSpray = el('path', {
    d: `M ${cx - 14} ${part.y + 150} L ${cx - 4} ${part.y + 130} L ${cx} ${part.y + 150} Z`,
    class: 'jet-spray', opacity: 0,
  }, layers.fx);

  // Mariposa: eje al centro del ducto, bajo el venturi.
  const throttleY = part.y + 220;
  const throttlePlate = el('line', {
    x1: cx - 34, y1: throttleY, x2: cx + 34, y2: throttleY, class: 'throttle-plate',
  }, group(g, { part: 'throttlePlate' }));

  // Surtidor de ralentí, bajo la mariposa; tornillo de mezcla al lado.
  const idleJet = group(g, { part: 'idleJet' });
  el('circle', { cx: cx + 6, cy: part.y + 250, r: 3, class: 'jet-nozzle' }, idleJet);
  const idleSpray = el('path', {
    d: `M ${cx + 6} ${part.y + 250} L ${cx + 12} ${part.y + 236} L ${cx + 18} ${part.y + 250} Z`,
    class: 'jet-spray', opacity: 0,
  }, layers.fx);
  const idleScrew = group(g, { part: 'idleScrew' });
  el('circle', { cx: cx + 40, cy: part.y + 250, r: 8, class: 'idle-screw' }, idleScrew);
  el('line', { x1: cx + 34, y1: part.y + 250, x2: cx + 46, y2: part.y + 250, class: 'idle-screw-slot' }, idleScrew);

  // Bomba de aceleración: chorro directo al ducto cuando se pisa de golpe.
  const accelPump = group(g, { part: 'accelPump' });
  el('rect', { x: part.x + W - 70, y: part.y + 140, width: 40, height: 70, rx: 6, class: 'accel-body' }, accelPump);
  const plunger = el('rect', { x: part.x + W - 62, y: part.y + 150, width: 24, height: 14, rx: 3, class: 'accel-plunger' }, accelPump);
  const accelSquirt = el('path', {
    d: `M ${part.x + W - 70} ${part.y + 210} L ${cx + 30} ${throttleY - 6} L ${cx + 30} ${throttleY + 6} Z`,
    class: 'jet-spray', opacity: 0,
  }, layers.fx);

  el('path', {
    d: `M ${cx - 34} ${throttleY + 6} L ${cx - 34} ${part.y + H - 20} L ${cx + 34} ${part.y + H - 20} L ${cx + 34} ${throttleY + 6}`,
    class: 'venturi-wall',
  }, g);
  label(g, cx, part.y + H - 6, 'Al múltiple', { anchor: 'middle', className: 'lbl-small part-label' });

  let t = 0;
  let prevAccel = 0;
  let squirtT = 0;
  return {
    g,
    update(channels, dt): void {
      t += dt;
      const airMass = Math.max(0, channelNumber(channels, 'airMass'));
      const speed = clamp(airMass / 60, 0, 4);
      airArrows.forEach((arrow, i) => {
        const ph = (t * (0.6 + speed) + i / 3) % 1;
        arrow.setAttribute('transform', `translate(${cx - 8} ${part.y - 10 + ph * 110})`);
        arrow.setAttribute('opacity', airMass > 1 ? '0.7' : '0');
      });

      const throttle = clamp(channelNumber(channels, 'throttle'), 0, 1);
      const angle = 80 * (1 - throttle);
      throttlePlate.setAttribute('transform', `rotate(${angle.toFixed(1)} ${cx} ${throttleY})`);

      const phi = clamp(channelNumber(channels, 'mainFraction'), 0, 1);
      const delivered = Math.max(0, channelNumber(channels, 'fuelDelivered'));
      mainSpray.setAttribute('opacity', clamp((phi * delivered) / 25, 0, 1).toFixed(2));
      idleSpray.setAttribute('opacity', clamp(((1 - phi) * delivered) / 15, 0, 1).toFixed(2));

      const accelBoost = channelNumber(channels, 'accelBoost');
      if (accelBoost > prevAccel + 0.02) squirtT = 0.25;
      prevAccel = accelBoost;
      squirtT = Math.max(0, squirtT - dt);
      accelSquirt.setAttribute('opacity', squirtT > 0 ? '0.9' : '0');
      plunger.setAttribute('transform', squirtT > 0 ? 'translate(0 6)' : '');
    },
  };
};
