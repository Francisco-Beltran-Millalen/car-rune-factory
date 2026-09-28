// `translateCircuit` (A15, plan del vehículo §4 paso 2): desplaza el layout
// de un `CircuitDef` a la región del vehículo que le toca y prefija sus ids
// (`sistema:pieza`, nunca `sistema.pieza` — §3.1, el `.` sigue separando
// `part.port`). Puro (§1). Sólo toca topología/layout: `params`/`faults` (los
// valores por defecto) no llevan prefijo acá, lo arma `compileVehicle` al
// juntar el modelo (plan §4 paso 6).

import type {
  CircuitDef,
  CircuitLinkDef,
  CircuitPartDef,
  CircuitProbeDef,
} from './types.ts';

function prefixId(prefix: string, id: string): string {
  return `${prefix}:${id}`;
}

/** `'part.port'` → `'prefijo:part.port'` (el primer punto sigue separando). */
function prefixEndpoint(prefix: string, endpoint: string): string {
  const dot = endpoint.indexOf('.');
  if (dot < 0) return prefixId(prefix, endpoint);
  return `${prefixId(prefix, endpoint.slice(0, dot))}${endpoint.slice(dot)}`;
}

function translatePart(part: CircuitPartDef, dx: number, dy: number, prefix: string): CircuitPartDef {
  return {
    ...part,
    id: prefixId(prefix, part.id),
    x: part.x + dx,
    y: part.y + dy,
    ...(part.joinedBy !== undefined ? { joinedBy: prefixId(prefix, part.joinedBy) } : {}),
  };
}

function translateLink(link: CircuitLinkDef, dx: number, dy: number, prefix: string): CircuitLinkDef {
  return {
    ...link,
    id: prefixId(prefix, link.id),
    from: prefixEndpoint(prefix, link.from),
    to: prefixEndpoint(prefix, link.to),
    ...(link.via !== undefined ? { via: link.via.map(([x, y]) => [x + dx, y + dy] as const) } : {}),
    ...(link.visual !== undefined
      ? {
          visual: {
            ...link.visual,
            ...(link.visual.owner !== undefined ? { owner: prefixId(prefix, link.visual.owner) } : {}),
          },
        }
      : {}),
  };
}

function translateProbe(probe: CircuitProbeDef, prefix: string): CircuitProbeDef {
  return {
    ...probe,
    ...(probe.node !== undefined ? { node: prefixEndpoint(prefix, probe.node) } : {}),
    ...(probe.element !== undefined ? { element: prefixId(prefix, probe.element) } : {}),
  };
}

function prefixRecordKeys<V>(
  record: Readonly<Record<string, V>>,
  keyFn: (key: string) => string,
): Record<string, V> {
  const out: Record<string, V> = {};
  for (const [key, value] of Object.entries(record)) out[keyFn(key)] = value;
  return out;
}

/**
 * Copia `def` desplazando `parts[].x/y` y los `via` de los enlaces en
 * `at = [dx, dy]`, y prefijando ids (`prefijo:pieza`), `joinedBy`,
 * `links[].from/to`, `links[].visual.owner`, `probes` (nombre y `node`/
 * `element`), `fixed`, `initial` y `buses` (sus `ports` y `source`).
 * `params`/`faults` (valores por defecto) no se tocan: eso lo arma
 * `compileVehicle` al juntar el modelo.
 */
export function translateCircuit(
  def: CircuitDef,
  at: readonly [number, number],
  prefix: string,
): CircuitDef {
  const [dx, dy] = at;
  return {
    ...def,
    id: prefixId(prefix, def.id),
    parts: def.parts.map((part) => translatePart(part, dx, dy, prefix)),
    links: def.links.map((link) => translateLink(link, dx, dy, prefix)),
    ...(def.controllers !== undefined
      ? { controllers: def.controllers.map((c) => ({ ...c, id: prefixId(prefix, c.id) })) }
      : {}),
    ...(def.probes !== undefined
      ? {
          probes: Object.fromEntries(
            Object.entries(def.probes).map(([name, probe]) => [
              prefixId(prefix, name),
              translateProbe(probe, prefix),
            ]),
          ),
        }
      : {}),
    ...(def.fixed !== undefined
      ? { fixed: prefixRecordKeys(def.fixed, (k) => prefixEndpoint(prefix, k)) }
      : {}),
    ...(def.initial !== undefined
      ? { initial: prefixRecordKeys(def.initial, (k) => prefixEndpoint(prefix, k)) }
      : {}),
    ...(def.buses !== undefined
      ? {
          buses: Object.fromEntries(
            Object.entries(def.buses).map(([busId, bus]) => [
              busId,
              {
                ports: bus.ports.map((p) => prefixEndpoint(prefix, p)),
                ...(bus.source !== undefined ? { source: prefixId(prefix, bus.source) } : {}),
              },
            ]),
          ),
        }
      : {}),
  };
}
