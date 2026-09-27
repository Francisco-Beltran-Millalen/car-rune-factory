// Drawer de la bomba mecánica de diafragma (A16): excéntrica que gira a
// rpm/2 (movida por el árbol de levas) y diafragma que late; fuga a la
// atmósfera si el diafragma está roto. Coordenadas relativas a `part.x/y`.

import { clamp } from '../../../../core/math.ts';
import { el, group, label } from '../../../../core/svg.ts';
import type { DrawerFactory, GeometryFn } from '../../types.ts';
import { channelNumber } from '../../util.ts';

const W = 180;
const H = 120;

/** Aspira por arriba (línea de alimentación) y descarga por la derecha. */
export const mechPumpGeometry: GeometryFn = (part) => ({
  box: { x: part.x, y: part.y, w: W, h: H },
  ports: { in: [part.x + 90, part.y], out: [part.x + W, part.y + 60] },
});

/** Bomba mecánica: excéntrica, diafragma y goteo de la fuga. Canales:
 *  `rpm` (de la excéntrica, ya en rpm/2), `wear`, `leak` (0/1, diafragma roto). */
export const mechPumpDrawer: DrawerFactory = ({ part, layers }) => {
  const g = group(layers.parts, { part: part.id });
  el('rect', { x: part.x, y: part.y, width: W, height: H, rx: 10, class: 'part-body' }, g);
  const cam = group(g, { part: 'pumpCam' });
  const camCx = part.x + 40;
  const camCy = part.y + 60;
  el('circle', { cx: camCx, cy: camCy, r: 26, class: 'cam-body' }, cam);
  el('circle', { cx: camCx + 12, cy: camCy, r: 6, class: 'cam-lobe' }, cam);
  const diaphragm = el('line', {
    x1: part.x + 90, y1: part.y + 34, x2: part.x + 90, y2: part.y + 86,
    class: 'diaphragm-line',
  }, g);
  label(g, part.x + W / 2, part.y + H + 16, 'Bomba mecánica', { anchor: 'middle', className: 'lbl-small part-label' });
  const drops = [0, 1].map(() => el('circle', { r: 3, class: 'drop-fuel', opacity: 0 }, layers.fx));
  let angle = 0;
  let t = 0;
  return {
    g,
    update(channels, dt): void {
      // Vista lenta a propósito, como el resto de los mecanismos rotantes.
      angle = (angle + channelNumber(channels, 'rpm') * dt * 0.6) % 360;
      cam.setAttribute('transform', `rotate(${angle.toFixed(1)} ${camCx} ${camCy})`);
      const stroke = clamp(Math.sin((angle * Math.PI) / 180), -1, 1) * 12;
      diaphragm.setAttribute('transform', `translate(0 ${stroke.toFixed(1)})`);
      cam.classList.toggle('worn', channelNumber(channels, 'wear') > 0.5);
      t += dt;
      const leaking = channelNumber(channels, 'leak') > 0.5;
      drops.forEach((drop, i) => {
        const ph = (t * 1.3 + i / 2) % 1;
        drop.setAttribute('cx', String(part.x + 90 + i * 6));
        drop.setAttribute('cy', (part.y + H + 4 + ph * 30).toFixed(1));
        drop.setAttribute('opacity', leaking ? (1 - ph).toFixed(2) : '0');
      });
    },
  };
};
