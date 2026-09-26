// Contratos de los drawers del renderer SVG (A7, P23 §8.5). Sólo tipos.

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

export interface DrawerContext {
  part: CircuitPartDef;
  def: CircuitDef;
  layers: SvgLayers;
}

/** Un drawer por tipo visual: dibuja una pieza y anima sus canales (§23). */
export interface Drawer {
  /** Grupo raíz: lleva `data-part` y es lo que resalta `highlight()`. */
  g: SVGGElement;
  /** Puertos en coordenadas absolutas, para la ruta automática de enlaces. */
  ports?: Readonly<Record<string, readonly [number, number]>>;
  update(channels: PartChannels, dt: number): void;
  destroy?(): void;
}

export type DrawerFactory = (ctx: DrawerContext) => Drawer;
