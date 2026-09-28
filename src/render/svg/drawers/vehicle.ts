// Drawer del vehículo (A15): la región de un sistema `mechanism` (4 tiempos,
// sin red de solver, D-V10) se dibuja como una caja rotulada, un "inset" muy
// simple. El plan del vehículo §9 deja pendiente una vista propia embebida
// (lo que A11 definiría); acá sólo el recuadro para no dejar la región vacía.

import { box } from '../../../core/svg.ts';
import type { DrawerFactory, GeometryFn } from '../types.ts';

const W = 420;
const H = 260;

export const mechanismInsetGeometry: GeometryFn = (part) => ({
  box: { x: part.x, y: part.y, w: W, h: H },
});

export const mechanismInsetDrawer: DrawerFactory = ({ part, layers, geo }) => {
  const { g } = box(layers.parts, {
    x: geo.box.x,
    y: geo.box.y,
    w: geo.box.w,
    h: geo.box.h,
    label: part.label ?? 'Mecanismo',
    part: part.id,
    className: 'part vehicle-inset',
  });
  return { g, update(): void {} };
};
