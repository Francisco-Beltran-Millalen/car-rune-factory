// Contratos de los drawers del renderer SVG (A7, P23 §8.5). Sólo tipos.

import type { Point } from '../../core/svg.ts';
import type { VisualValue } from '../../core/types.ts';
import type { CircuitDef, CircuitPartDef } from '../../sim/circuit/types.ts';

export type PartChannels = Readonly<Record<string, VisualValue>>;

/** Capas del escenario, en el orden del renderer (de abajo hacia arriba). */
export interface SvgLayers {
  pipes: SVGGElement;
  behind: SVGGElement;
  particles: SVGGElement;
  parts: SVGGElement;
  fx: SVGGElement;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Caja y puertos de una pieza dibujada dentro de otro drawer (plan V1). */
export interface SubGeometry {
  box: Rect;
  ports?: Readonly<Record<string, Point>>;
}

/**
 * Geometría pura de un tipo visual (plan V1 §2.1): la usan el renderer, el
 * chequeo de layout y la hoja. `box` es el cuerpo (sin etiquetas) y lo que
 * el drawer dibuja; los puertos van sobre su borde, en coordenadas absolutas.
 */
export interface PartGeometry {
  box: Rect;
  ports?: Readonly<Record<string, Point>>;
  subparts?: Readonly<Record<string, SubGeometry>>;
  /** Se dibuja detrás y aloja otras piezas (estanque, múltiple). */
  container?: boolean;
  /** Va montada sobre un tubo (válvula check): los tubos pueden cruzarla. */
  inline?: boolean;
}

export type GeometryFn = (part: CircuitPartDef, def: CircuitDef) => PartGeometry;

export interface DrawerContext {
  part: CircuitPartDef;
  def: CircuitDef;
  layers: SvgLayers;
  geo: PartGeometry;
}

/** Un drawer por tipo visual: dibuja una pieza y anima sus canales (§23). */
export interface Drawer {
  /** Grupo raíz: lleva `data-part` y es lo que resalta `highlight()`. */
  g: SVGGElement;
  update(channels: PartChannels, dt: number): void;
  destroy?(): void;
}

export type DrawerFactory = (ctx: DrawerContext) => Drawer;

/** Entrada del catálogo: geometría pura + dibujo (plan V1). */
export interface DrawerEntry {
  geometry: GeometryFn;
  draw: DrawerFactory;
}
