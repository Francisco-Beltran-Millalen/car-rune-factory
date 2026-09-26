// Etiquetas de los tramos que se dibujan como conexiones (A7): la línea de
// alimentación (con el goteo de su fuga) y la de retorno. El tubo lo dibuja el
// enlace con `owner`.

import { group, el, label } from '../../../core/svg.ts';
import type { DrawerFactory } from '../types.ts';
import { channelNumber } from '../util.ts';

/** Línea de alimentación: etiqueta y gotas de la fuga. Canal: `leak` (L/h). */
export const feedLineDrawer: DrawerFactory = ({ part, layers }) => {
  const g = group(layers.parts, { part: part.id });
  label(g, part.x, part.y, 'Alimentación →', { className: 'lbl-small part-label' });
  const drops = [0, 1, 2].map(() => el('circle', { r: 3, class: 'drop', opacity: 0 }, layers.fx));
  let t = 0;
  return {
    g,
    update(channels, dt): void {
      t += dt;
      const on = channelNumber(channels, 'leak') > 0.05;
      drops.forEach((drop, i) => {
        const ph = (t * 1.5 + i / 3) % 1;
        drop.setAttribute('cx', String(part.x + 90));
        drop.setAttribute('cy', (part.y + 20 + ph * 50).toFixed(1));
        drop.setAttribute('opacity', on ? (1 - ph).toFixed(2) : '0');
      });
    },
  };
};

/** Línea de retorno: sólo su etiqueta de nombre. */
export const returnLineDrawer: DrawerFactory = ({ part, layers }) => {
  const g = group(layers.parts, { part: part.id });
  label(g, part.x, part.y, '← Retorno al estanque', { className: 'lbl-small part-label' });
  return { g, update(): void {} };
};
