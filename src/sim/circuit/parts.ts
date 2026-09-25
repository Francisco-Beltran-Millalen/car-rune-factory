// Construcción de las partes de un circuito: tipo, puertos y elemento. Puro (§1).

import type { ElementTypeInfo } from '../elements/index.ts';
import type { ElementDef, Fluid, PortDef } from '../solver/types.ts';
import type { CircuitDef, CircuitPartDef } from './types.ts';

export interface BuiltPart {
  part: CircuitPartDef;
  /** `undefined` si el tipo no está en el registro (lo reporta `validate`). */
  info?: ElementTypeInfo;
  ports: readonly PortDef[];
  /** `undefined` si el tipo no está en el registro. */
  element?: ElementDef;
}

/** Fluido del elemento: el de la parte, el del circuito o `fuel` (§30). */
export function fluidOf(part: CircuitPartDef, def: CircuitDef): Fluid {
  return part.fluid ?? def.fluid ?? 'fuel';
}

export function buildParts(
  def: CircuitDef,
  types: Readonly<Record<string, ElementTypeInfo>>,
): Map<string, BuiltPart> {
  const parts = new Map<string, BuiltPart>();
  for (const part of def.parts) {
    const info = types[part.type];
    if (!info) {
      parts.set(part.id, { part, ports: [] });
      continue;
    }
    const element = info.create(part.params ?? {}, fluidOf(part, def));
    parts.set(part.id, { part, info, ports: element.ports, element });
  }
  return parts;
}

export interface Endpoint {
  part: string;
  port: string;
  key: string;
}

/** `'part.port'` → `{ part, port }` (el primer punto separa). */
export function parseEndpoint(key: string): Endpoint {
  const dot = key.indexOf('.');
  if (dot < 0) return { part: key, port: '', key };
  return { part: key.slice(0, dot), port: key.slice(dot + 1), key };
}

export function findPort(
  parts: ReadonlyMap<string, BuiltPart>,
  endpoint: Endpoint,
): PortDef | undefined {
  return parts.get(endpoint.part)?.ports.find((p) => p.id === endpoint.port);
}
