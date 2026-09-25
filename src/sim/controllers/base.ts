// Contrato de los controladores (§25, P23 §8.3). Puro (§1).
// Corren ANTES de resolver: leen sondas del paso anterior y escriben `control`
// de los elementos. Su estado lo avanza `update` y el compilador lo publica.

import type { Rng } from '../../core/rng.ts';
import type { ParamRecord } from '../../core/types.ts';
import type { ElementDef } from '../solver/types.ts';

export type ControllerStateValue = number | string | boolean | readonly unknown[];

export interface ControllerContext {
  dt: number;
  /** Sonda medida en el paso anterior (§25). Devuelve 0 si no existe. */
  read(probe: string): number;
  /** Params del modelo compilado (los escribe el modo). */
  params: Readonly<ParamRecord>;
  /** Fallas del modelo compilado, con claves planas del módulo. */
  faults: Readonly<ParamRecord>;
  /** Elementos del circuito por `partId`. */
  elements: Readonly<Record<string, ElementDef>>;
  /** El rng del modelo (semilla), compartido en orden de creación (§3). */
  rng: Rng;
}

export interface ControllerDef {
  readonly id: string;
  /** Sondas que lee; documental (los tests la usan para fijar el retraso). */
  readonly probes?: readonly string[];
  /** Estado que el compilador publica en `model.state` (mismas claves). */
  readonly state?: Record<string, ControllerStateValue>;
  update(ctx: ControllerContext): void;
}

export type ControllerFactory = (id: string, params: Readonly<ParamRecord>) => ControllerDef;
