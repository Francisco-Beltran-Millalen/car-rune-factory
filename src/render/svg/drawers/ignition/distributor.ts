// Distribuidor de platinos (A12): leva de 4 lóbulos, contactos, rotor, tapa,
// contrapesos, cápsula de vacío y cables a las bujías.

import { clamp } from '../../../../core/math.ts';
import { el, group, label, roundedPathD } from '../../../../core/svg.ts';
import type { DrawerFactory, GeometryFn } from '../../types.ts';
import { channelNumber } from '../../util.ts';

const R = 78;
const TERMINALS = [45, 135, 225, 315]; // cilindros 1..4

/** Distribuidor con avance centrífugo y por vacío (spec ignition §8). */
/** La tapa (con su borne central); condensador y avance por vacío son sub-piezas. */
export const distributorGeometry: GeometryFn = (part) => ({
  box: { x: part.x + 140 - R, y: part.y + 140 - R - 18, w: 2 * R, h: 2 * R + 18 },
  subparts: {
    condenser: { box: { x: part.x + 22, y: part.y + 160, w: 34, h: 50 } },
    vacuumAdvance: { box: { x: part.x + 10, y: part.y + 42, w: 44, h: 44 } },
  },
});

export const distributorDrawer: DrawerFactory = ({ part, def, layers }) => {
  const g = group(layers.parts);
  const cx = part.x + 140;
  const cy = part.y + 140;

  // Tapa con terminales y cable central.
  const cap = group(g, { part: 'distributorCap' });
  el('circle', { cx, cy, r: R, class: 'dist-cap' }, cap);
  for (let i = 0; i < 4; i++) {
    const a = ((TERMINALS[i] ?? 0) - 90) * (Math.PI / 180);
    el('circle', { cx: cx + Math.cos(a) * (R - 12), cy: cy + Math.sin(a) * (R - 12), r: 6, class: 'dist-terminal' }, cap);
  }
  el('rect', { x: cx - 8, y: cy - R - 18, width: 16, height: 20, rx: 3, class: 'dist-terminal' }, cap);

  // Cables de alta a cada bujía (el central, a la bobina).
  const plugs = def.parts.filter((p) => p.id.startsWith('sparkPlug'));
  const coilPart = def.parts.find((p) => p.visual === 'coil');
  for (let i = 0; i < plugs.length; i++) {
    const plug = plugs[i];
    if (!plug) continue;
    const lead = group(g, { part: `htLead${i + 1}` });
    const a = ((TERMINALS[i] ?? 0) - 90) * (Math.PI / 180);
    el(
      'path',
      {
        d: roundedPathD(
          [
            [cx + Math.cos(a) * (R - 12), cy + Math.sin(a) * (R - 12)],
            [cx + Math.cos(a) * (R + 30), cy + Math.sin(a) * (R + 30)],
            [plug.x + 30, cy + 60],
            [plug.x + 30, plug.y + 8],
          ],
          18,
        ),
        class: 'ht-wire',
      },
      lead,
    );
  }
  if (coilPart) {
    const lead = group(g, { part: 'coilLead' });
    el('path', { d: roundedPathD([[cx, cy - R - 18], [cx, cy - R - 60], [coilPart.x + 60, cy - R - 60], [coilPart.x + 60, coilPart.y + 80]], 16), class: 'ht-wire' }, lead);
  }

  // Rotor y leva (giran con la leva).
  const rotor = group(g, { part: 'rotor' });
  el('line', { x1: cx, y1: cy, x2: cx, y2: cy - R + 22, class: 'rotor-arm' }, rotor);
  const lobes = group(g, { part: 'points' });
  for (let i = 0; i < 4; i++) {
    el('ellipse', { cx, cy: cy - 16, rx: 5, ry: 16, class: 'cam-lobe', transform: `rotate(${i * 90} ${cx} ${cy})` }, lobes);
  }
  el('circle', { cx, cy, r: 14, class: 'dist-hub' }, lobes);
  const contactCam = el('circle', { cx: cx + 22, cy: cy - 2, r: 6, class: 'cam-rider' }, lobes);

  // Contactos (se abren en el corte).
  const contactB = el('circle', { cx: cx + 26, cy: cy + 40, r: 5, class: 'contact' }, lobes);
  const pitting = el('circle', { cx: cx + 26, cy: cy + 40, r: 5, class: 'points-pit' }, lobes);

  // Condensador.
  const condenser = group(g, { part: 'condenser' });
  el('rect', { x: cx - 118, y: cy + 20, width: 34, height: 50, rx: 6, class: 'part-body' }, condenser);
  label(g, cx - 101, cy + 90, 'Condensador', { anchor: 'middle', className: 'lbl-small part-label' });

  // Avance centrífugo: contrapesos.
  const weights = group(g, { part: 'centrifugalAdvance' });
  const weightA = el('rect', { x: cx - 40, y: cy - 10, width: 26, height: 10, rx: 4, class: 'weight' }, weights);
  const weightB = el('rect', { x: cx + 14, y: cy - 10, width: 26, height: 10, rx: 4, class: 'weight' }, weights);
  label(g, cx, cy + 116, 'Contrapesos', { anchor: 'middle', className: 'lbl-small part-label' });

  // Cápsula de vacío y manguera.
  const vacuum = group(g, { part: 'vacuumAdvance' });
  const rod = el('line', { x1: cx - 90, y1: cy - 66, x2: cx - 40, y2: cy - 40, class: 'vac-rod' }, vacuum);
  el('circle', { cx: cx - 108, cy: cy - 76, r: 22, class: 'part-body' }, vacuum);
  label(g, cx - 108, cy - 108, 'Avance por vacío', { anchor: 'middle', className: 'lbl-small part-label' });
  const line = group(g, { part: 'vacuumLine' });
  el('path', { d: `M ${cx - 128} ${cy - 76} C ${cx - 190} ${cy - 76} ${cx - 190} ${cy - 170} ${cx - 240} ${cy - 170}`, class: 'vac-line' }, line);

  // Puntos de la leva (4 lóbulos dibujados arriba; el palpador los sigue).

  return {
    g,
    update(channels): void {
      const cam = channelNumber(channels, 'cam');
      const target = Math.round(clamp(channelNumber(channels, 'target', 1), 1, 4));
      const open = channelNumber(channels, 'pointsOpen') > 0.5;
      const weightsIn = clamp(channelNumber(channels, 'weights') / 5000, 0, 1);
      const vacuum = clamp(channelNumber(channels, 'vacuum'), 0, 1);

      rotor.setAttribute('transform', `rotate(${cam / 2 + (target - 1) * 90} ${cx} ${cy})`);
      lobes.setAttribute('transform', `rotate(${cam / 2} ${cx} ${cy})`);
      contactB.setAttribute('cy', String(cy + 40 + (open ? 12 : -1)));
      pitting.style.opacity = channelNumber(channels, 'pitting') > 0.3 ? '0.8' : '0';
      weightA.setAttribute('transform', `translate(${(-weightsIn * 14).toFixed(1)} ${(-weightsIn * 6).toFixed(1)}) rotate(${(-weightsIn * 16).toFixed(1)} ${cx - 27} ${cy - 5})`);
      weightB.setAttribute('transform', `translate(${(weightsIn * 14).toFixed(1)} ${(-weightsIn * 6).toFixed(1)}) rotate(${(weightsIn * 16).toFixed(1)} ${cx + 27} ${cy - 5})`);
      rod.setAttribute('x1', String(cx - 90 - vacuum * 10));
      contactCam.setAttribute('cy', String(cy - 2 - (open ? 6 : 0)));
    },
  };
};
