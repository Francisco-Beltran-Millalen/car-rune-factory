// Validación estructural de un `CircuitDef` (P23 §8.4). Puro (§1).
// Devuelve errores (impiden un circuito sano) y avisos (didácticos, p. ej.
// un puerto abierto en el armado). No compila nada.

import type { ControllerFactory } from '../controllers/index.ts';
import type { ElementTypeInfo } from '../elements/index.ts';
import type { CircuitDef, CircuitIssue } from './types.ts';
import { buildParts, findPort, parseEndpoint } from './parts.ts';

export function validateCircuit(
  def: CircuitDef,
  types: Readonly<Record<string, ElementTypeInfo>>,
  controllerTypes?: Readonly<Record<string, ControllerFactory>>,
): CircuitIssue[] {
  const issues: CircuitIssue[] = [];
  const parts = buildParts(def, types);

  const seenParts = new Set<string>();
  for (const part of def.parts) {
    if (seenParts.has(part.id)) {
      issues.push({
        level: 'error',
        code: 'duplicate-part',
        message: `La parte '${part.id}' está repetida.`,
        part: part.id,
      });
    }
    seenParts.add(part.id);
  }
  for (const [id, built] of parts) {
    if (!built.info) {
      issues.push({
        level: 'error',
        code: 'unknown-type',
        message: `La parte '${id}' usa el tipo desconocido '${built.part.type}'.`,
        part: id,
      });
    }
    if (built.part.fluid2 !== undefined && built.info && !built.info.crossFluid) {
      issues.push({
        level: 'error',
        code: 'invalid-cross-fluid',
        message: `La parte '${id}' declara 'fluid2' pero su tipo '${built.part.type}' no es crossFluid (§30).`,
        part: id,
      });
    }
  }

  const seenLinks = new Set<string>();
  const linkCount = new Map<string, number>();
  for (const link of def.links) {
    if (seenLinks.has(link.id)) {
      issues.push({
        level: 'error',
        code: 'duplicate-link',
        message: `La conexión '${link.id}' está repetida.`,
        link: link.id,
      });
    }
    seenLinks.add(link.id);

    const from = parseEndpoint(link.from);
    const to = parseEndpoint(link.to);
    const portFrom = findPort(parts, from);
    const portTo = findPort(parts, to);
    if (!portFrom) {
      issues.push({
        level: 'error',
        code: 'unknown-port',
        message: `La conexión '${link.id}' sale de un puerto inexistente (${link.from}).`,
        link: link.id,
        part: from.part,
        port: from.port,
      });
    }
    if (!portTo) {
      issues.push({
        level: 'error',
        code: 'unknown-port',
        message: `La conexión '${link.id}' llega a un puerto inexistente (${link.to}).`,
        link: link.id,
        part: to.part,
        port: to.port,
      });
    }
    if (link.from === link.to) {
      issues.push({
        level: 'error',
        code: 'self-link',
        message: `La conexión '${link.id}' conecta un puerto consigo mismo.`,
        link: link.id,
      });
    }
    if (portFrom && portTo && link.from !== link.to) {
      if (portFrom.domain !== portTo.domain) {
        issues.push({
          level: 'error',
          code: 'domain-mismatch',
          message: `La conexión '${link.id}' une dominios distintos (${portFrom.domain} y ${portTo.domain}).`,
          link: link.id,
        });
      } else if (portFrom.domain === 'hydraulic' && portFrom.fluid !== portTo.fluid) {
        issues.push({
          level: 'error',
          code: 'fluid-mismatch',
          message: `La conexión '${link.id}' mezcla fluidos (${portFrom.fluid ?? '?'} y ${portTo.fluid ?? '?'}) (§30).`,
          link: link.id,
        });
      }
    }
    linkCount.set(link.from, (linkCount.get(link.from) ?? 0) + 1);
    linkCount.set(link.to, (linkCount.get(link.to) ?? 0) + 1);
  }

  for (const [key, count] of linkCount) {
    if (count <= 1) continue;
    const endpoint = parseEndpoint(key);
    const built = parts.get(endpoint.part);
    if (built?.info?.multiple) continue;
    issues.push({
      level: 'error',
      code: 'multiple-links',
      message: `El puerto '${key}' tiene ${count} conexiones.`,
      part: endpoint.part,
      port: endpoint.port,
    });
  }

  for (const [id, built] of parts) {
    for (const port of built.ports) {
      if (!linkCount.has(`${id}.${port.id}`)) {
        issues.push({
          level: 'warning',
          code: 'unconnected-port',
          message: `El puerto '${id}.${port.id}' quedó sin conectar.`,
          part: id,
          port: port.id,
        });
      }
    }
  }

  const seenControllers = new Set<string>();
  for (const controller of def.controllers ?? []) {
    if (seenControllers.has(controller.id)) {
      issues.push({
        level: 'error',
        code: 'duplicate-controller',
        message: `El controlador '${controller.id}' está repetido.`,
        controller: controller.id,
      });
    }
    seenControllers.add(controller.id);
    if (controllerTypes && !controllerTypes[controller.type]) {
      issues.push({
        level: 'error',
        code: 'unknown-controller',
        message: `El controlador '${controller.id}' usa el tipo desconocido '${controller.type}'.`,
        controller: controller.id,
      });
    }
  }

  for (const [name, probe] of Object.entries(def.probes ?? {})) {
    let valid = false;
    if (probe.node) {
      valid = findPort(parts, parseEndpoint(probe.node)) !== undefined;
    } else if (probe.element && probe.probe) {
      const element = parts.get(probe.element)?.element;
      valid = element?.probes?.[probe.probe] !== undefined;
    }
    if (!valid) {
      issues.push({
        level: 'error',
        code: 'invalid-probe',
        message: `La sonda '${name}' no referencia un nodo o sonda existente.`,
        probe: name,
      });
    }
  }

  for (const key of Object.keys(def.fixed ?? {})) {
    if (!findPort(parts, parseEndpoint(key))) {
      issues.push({
        level: 'error',
        code: 'invalid-fixed',
        message: `El nodo fijo '${key}' no es un puerto existente.`,
        port: key,
      });
    }
  }

  return issues;
}
