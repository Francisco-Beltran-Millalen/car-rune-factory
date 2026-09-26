// Corte del cilindro (A11, spec §8). Geometría una vez; en `update` sólo se
// mutan atributos (§9). Colores por variables CSS.

import { el, group, label } from '../../../../core/svg.ts';
import type { DrawerFactory, GeometryFn } from '../../types.ts';
import { channelNumber, channelString } from '../../util.ts';

const BORE_C = 300;
const BORE_L = 250;
const BORE_R = 350;
const HEAD_BOTTOM = 230;
const TDC_TOP = 250;
const TRAVEL_PX = 100; // = carrera de 86 mm
const CRANK_Y = 496;
const CRANK_R = 50;
const VALVE_SEAT = 228;
const INTAKE_X = 282;
const EXHAUST_X = 318;

const RAD = Math.PI / 180;

/** Distancia del pistón al PMS (mm), igual que `sim/engine/geometry.ts` (§22:
 *  la vista no importa sim, así que repite esta cinemática de dibujo). */
function drop(deg: number): number {
  const r = 43;
  const l = 143;
  const t = deg * RAD;
  const s = Math.sin(t);
  return r + l - (r * Math.cos(t) + Math.sqrt(l * l - r * r * s * s));
}

function valve(x: number, parent: SVGGElement, part: string): { g: SVGGElement } {
  const g = group(parent, { part });
  el('line', { x1: x, y1: 148, x2: x, y2: VALVE_SEAT, class: 'valve-stem' }, g);
  el('ellipse', { cx: x, cy: VALVE_SEAT, rx: 12, ry: 4, class: 'valve-head' }, g);
  return { g };
}

/** Corte del cilindro visto: culata, válvulas, pistón, biela y cigüeñal. */
/** Culata con lumbreras, cilindro y cárter (x 150–450, y 100–560). */
export const cylinderSectionGeometry: GeometryFn = (part) => ({
  box: { x: part.x + 150, y: part.y + 100, w: 300, h: 460 },
});

export const cylinderSectionDrawer: DrawerFactory = ({ part, layers }) => {
  const ox = part.x;
  const oy = part.y;
  const g = group(layers.parts);
  const moving = group(g);

  // Culata, conductos y paredes.
  el('rect', { x: ox + 225, y: oy + 150, width: 150, height: 80, rx: 8, class: 'cyl-head' }, moving);
  el('rect', { x: ox + 150, y: oy + 168, width: 75, height: 38, rx: 6, class: 'cyl-port', part: 'intakePort' }, moving);
  el('rect', { x: ox + 375, y: oy + 168, width: 75, height: 38, rx: 6, class: 'cyl-port', part: 'exhaustPort' }, moving);
  label(g, ox + 150, oy + 210, 'Admisión →', { className: 'lbl-small part-label' });
  label(g, ox + 450, oy + 210, '→ Escape', { anchor: 'end', className: 'lbl-small part-label' });
  el('rect', { x: ox + 245, y: oy + HEAD_BOTTOM, width: 6, height: 215, class: 'cyl-wall' }, moving);
  el('rect', { x: ox + 349, y: oy + HEAD_BOTTOM, width: 6, height: 215, class: 'cyl-wall' }, moving);
  el('rect', { x: ox + 210, y: oy + 430, width: 180, height: 130, rx: 16, class: 'crankcase' }, moving);

  // Gas del cilindro (detrás del pistón).
  const gas = el('rect', { x: ox + BORE_L + 1, y: oy + HEAD_BOTTOM + 2, width: BORE_R - BORE_L - 2, height: 0, class: 'cyl-gas' }, moving);

  // Cilindro visto (zona clickeable, se re-etiqueta con `view`).
  const cylHit = el('rect', { x: ox + BORE_L, y: oy + HEAD_BOTTOM, width: BORE_R - BORE_L, height: 215, class: 'cyl-hit', part: 'cyl1' }, moving);

  // Pistón, anillos y biela.
  const piston = group(moving, { part: 'piston' });
  const pistonBody = el('rect', { x: ox + BORE_L + 1, y: oy + TDC_TOP, width: BORE_R - BORE_L - 2, height: 38, rx: 3, class: 'piston-body' }, piston);
  const ring1 = el('line', { x1: ox + BORE_L + 3, y1: oy + TDC_TOP + 8, x2: ox + BORE_R - 3, y2: oy + TDC_TOP + 8, class: 'piston-ring' }, moving);
  const ring2 = el('line', { x1: ox + BORE_L + 3, y1: oy + TDC_TOP + 14, x2: ox + BORE_R - 3, y2: oy + TDC_TOP + 14, class: 'piston-ring' }, moving);
  const rod = group(moving, { part: 'rod' });
  const rodLine = el('line', { x1: ox + BORE_C, y1: oy + TDC_TOP + 28, x2: ox + BORE_C, y2: oy + CRANK_Y, class: 'rod' }, rod);

  // Cigüeñal: disco con contrapeso y muñequilla.
  const crank = group(moving, { part: 'crank' });
  el('circle', { cx: ox + BORE_C, cy: oy + CRANK_Y, r: 26, class: 'crank-disc' }, crank);
  const crankMark = el('line', { x1: ox + BORE_C, y1: oy + CRANK_Y, x2: ox + BORE_C, y2: oy + CRANK_Y - 22, class: 'crank-mark' }, crank);
  const crankPin = el('circle', { cx: ox + BORE_C, cy: oy + CRANK_Y - CRANK_R, r: 9, class: 'crank-pin' }, crank);

  // Bujía y destello.
  el('rect', { x: ox + 296, y: oy + 110, width: 8, height: 60, rx: 3, class: 'plug-body', part: 'sparkPlug' }, moving);
  label(g, ox + 310, oy + 118, 'Bujía', { className: 'lbl-small part-label' });
  const flash = el('circle', { cx: ox + BORE_C, cy: oy + 200, r: 16, class: 'spark-flash' }, moving);

  // Válvulas.
  const intake = valve(ox + INTAKE_X, moving, 'intakeValve');
  const exhaust = valve(ox + EXHAUST_X, moving, 'exhaustValve');

  // Tren de válvulas: varillas y balancines (OHV) o dos árboles (DOHC).
  const isOhv = (part.params?.['ohv'] ?? 1) === 1;
  if (isOhv) {
    const pushrod = group(moving, { part: 'pushrod' });
    el('line', { x1: ox + INTAKE_X - 12, y1: oy + 160, x2: ox + INTAKE_X - 12, y2: oy + 420, class: 'pushrod' }, pushrod);
    el('line', { x1: ox + EXHAUST_X + 12, y1: oy + 160, x2: ox + EXHAUST_X + 12, y2: oy + 420, class: 'pushrod' }, pushrod);
    const rocker = group(moving, { part: 'rocker' });
    el('line', { x1: ox + INTAKE_X - 20, y1: oy + 152, x2: ox + INTAKE_X + 12, y2: oy + 140, class: 'rocker-arm' }, rocker);
    el('line', { x1: ox + EXHAUST_X - 12, y1: oy + 140, x2: ox + EXHAUST_X + 20, y2: oy + 152, class: 'rocker-arm' }, rocker);
    el('circle', { cx: ox + INTAKE_X - 4, cy: oy + 146, r: 4, class: 'rocker-pivot' }, rocker);
    el('circle', { cx: ox + EXHAUST_X + 4, cy: oy + 146, r: 4, class: 'rocker-pivot' }, rocker);
  } else {
    const cams = group(moving, { part: 'camshaft' });
    for (const x of [INTAKE_X, EXHAUST_X]) {
      el('circle', { cx: ox + x, cy: oy + 120, r: 16, class: 'cam-base' }, cams);
      el('ellipse', { cx: ox + x, cy: oy + 120, rx: 6, ry: 16, class: 'cam-lobe' }, cams);
    }
  }

  label(g, ox + BORE_C, oy + 92, 'Cilindro', { anchor: 'middle', className: 'lbl part-label' });
  const strokeName = label(g, ox + BORE_C, oy + 640, '', { anchor: 'middle', className: 'stroke-name' });
  const volumeText = label(g, ox + BORE_C, oy + 132, '', { anchor: 'middle', className: 'lbl-small lbl-mono' });

  return {
    g,
    update(channels): void {
      const crankDeg = channelNumber(channels, 'crank');
      const stroke = channelString(channels, 'stroke', 'admisión');
      const liftI = channelNumber(channels, 'intakeLift');
      const liftE = channelNumber(channels, 'exhaustLift');
      const burn = channelNumber(channels, 'burn');
      const pressure = channelNumber(channels, 'pressure');
      const volume = channelNumber(channels, 'volume');
      const view = Math.round(channelNumber(channels, 'view', 1));

      const top = TDC_TOP + (drop(crankDeg) * TRAVEL_PX) / 86;
      pistonBody.setAttribute('y', String(oy + top));
      ring1.setAttribute('y1', String(oy + top + 8));
      ring1.setAttribute('y2', String(oy + top + 8));
      ring2.setAttribute('y1', String(oy + top + 14));
      ring2.setAttribute('y2', String(oy + top + 14));
      const t = crankDeg * RAD;
      const pinX = BORE_C + CRANK_R * Math.sin(t);
      const pinY = CRANK_Y - CRANK_R * Math.cos(t);
      rodLine.setAttribute('x2', String(ox + pinX));
      rodLine.setAttribute('y2', String(oy + pinY));
      crankPin.setAttribute('cx', String(ox + pinX));
      crankPin.setAttribute('cy', String(oy + pinY));
      crankMark.setAttribute('transform', `rotate(${crankDeg.toFixed(1)} ${ox + BORE_C} ${oy + CRANK_Y})`);

      const gasHeight = Math.max(0, top - HEAD_BOTTOM - 2);
      gas.setAttribute('height', gasHeight.toFixed(1));
      const burning = burn > 0.02 && burn < 0.98;
      gas.style.fill = burning ? 'var(--burn)' : stroke === 'escape' ? 'var(--exhaust)' : 'var(--mixture)';
      gas.style.opacity = (0.2 + Math.min(1, pressure / 60) * 0.75).toFixed(2);

      intake.g.setAttribute('transform', liftI > 0.01 ? `translate(0 ${(liftI * 1.3).toFixed(1)})` : '');
      exhaust.g.setAttribute('transform', liftE > 0.01 ? `translate(0 ${(liftE * 1.3).toFixed(1)})` : '');
      intake.g.classList.toggle('valve-overlap', channelNumber(channels, 'overlap') > 0 && liftI > 0.3 && liftE > 0.3);
      exhaust.g.classList.toggle('valve-overlap', channelNumber(channels, 'overlap') > 0 && liftI > 0.3 && liftE > 0.3);
      const hit = channelNumber(channels, 'hit') > 0;
      intake.g.classList.toggle('valve-hit', hit);
      exhaust.g.classList.toggle('valve-hit', hit);

      const spark = channelNumber(channels, 'spark') > 0.5;
      flash.style.opacity = spark && burning && burn < 0.4 ? '0.9' : '0';
      strokeName.textContent = stroke;
      volumeText.textContent = `${volume.toFixed(0)} cm³`;
      cylHit.setAttribute('data-part', `cyl${view}`);
    },
  };
};
