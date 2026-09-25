// Registro y creación de controladores (P23 §8.3). Puro (§1).

import type { CircuitControllerDef } from '../circuit/types.ts';
import type { ControllerDef, ControllerFactory } from './base.ts';

export type { ControllerContext, ControllerDef, ControllerFactory } from './base.ts';

/**
 * Instancia los controladores declarados en el circuito. Un tipo sin fábrica
 * registrada se omite (el compilador lo reporta como error de validación).
 */
export function createControllers(
  defs: readonly CircuitControllerDef[],
  types: Readonly<Record<string, ControllerFactory>>,
): ControllerDef[] {
  const controllers: ControllerDef[] = [];
  for (const def of defs) {
    const factory = types[def.type];
    if (!factory) continue;
    controllers.push(factory(def.id, def.params ?? {}));
  }
  return controllers;
}
