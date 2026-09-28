// Red de un circuito, sin modelo ni controladores (A15, plan del vehículo
// §4 paso 1): se factoriza de `compileCircuit` para que `compileVehicle`
// pueda compilar la red de cada sistema por separado y fundir sus buses
// antes de armar el solver. Puro (§1).

import type { ElementTypeInfo } from '../elements/index.ts';
import type { ElementDef, SolverElement } from '../solver/types.ts';
import { buildParts } from './parts.ts';
import type { CircuitDef, CircuitNodes } from './types.ts';

export interface CompiledNet {
  elements: Readonly<Record<string, ElementDef>>;
  nodes: CircuitNodes;
  /** `'part.port'` → índice de nodo. */
  portToNode: Readonly<Record<string, number>>;
  linkToNodes: Readonly<Record<string, { from: number; to: number }>>;
  /** El mayor número de puertos entre todos los elementos (buffer de `pot`). */
  maxPorts: number;
}

/**
 * Compila la red de un circuito: nodos (union-find de puertos, enlaces,
 * elementos `joint` y puertos de `buses`), elementos y el mapa de puertos a
 * nodo. No arma ni solver ni controladores (eso lo hace `compileCircuit`, o
 * `compileVehicle` tras fundir los buses compartidos entre sistemas).
 */
export function compileNet(
  def: CircuitDef,
  types: Readonly<Record<string, ElementTypeInfo>>,
): CompiledNet {
  const parts = buildParts(def, types);
  const elements: Record<string, ElementDef> = {};
  let maxPorts = 1;
  for (const [id, built] of parts) {
    const element = built.element;
    if (!element) continue;
    elements[id] = element;
    if (element.ports.length > maxPorts) maxPorts = element.ports.length;
  }

  // Union-find de puertos: las conexiones y los elementos `joint` unen nodos.
  const portKeys: string[] = [];
  const parent: number[] = [];
  const indexOf = new Map<string, number>();
  function register(key: string): number {
    const existing = indexOf.get(key);
    if (existing !== undefined) return existing;
    const index = parent.length;
    indexOf.set(key, index);
    parent.push(index);
    portKeys.push(key);
    return index;
  }
  function find(index: number): number {
    let root = index;
    while ((parent[root] ?? root) !== root) {
      root = parent[root] ?? root;
    }
    let walk = index;
    while ((parent[walk] ?? root) !== root) {
      const next = parent[walk] ?? root;
      parent[walk] = root;
      walk = next;
    }
    return root;
  }
  function union(a: number, b: number): void {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parent[rootB] = rootA;
  }

  // Puertos de un bus (A15): quedan registrados aunque su elemento (la
  // fuente duplicada de un sistema que no es el proveedor) no exista, para
  // que los enlaces que los mencionan igual se fundan con el nodo del bus.
  for (const bus of Object.values(def.buses ?? {})) {
    for (const port of bus.ports) register(port);
  }

  for (const [id, built] of parts) {
    for (const port of built.ports) register(`${id}.${port.id}`);
  }
  for (const [id, built] of parts) {
    if (!built.info?.joint || built.ports.length === 0) continue;
    const first = register(`${id}.${built.ports[0]?.id ?? ''}`);
    for (const port of built.ports) union(first, register(`${id}.${port.id}`));
  }
  for (const link of def.links) {
    const from = indexOf.get(link.from);
    const to = indexOf.get(link.to);
    if (from !== undefined && to !== undefined) union(from, to);
  }

  const rootToNode = new Map<number, number>();
  const portToNode: Record<string, number> = {};
  const nodePorts: string[][] = [];
  for (const key of portKeys) {
    const root = find(indexOf.get(key) ?? 0);
    let node = rootToNode.get(root);
    if (node === undefined) {
      node = nodePorts.length;
      rootToNode.set(root, node);
      nodePorts.push([]);
    }
    portToNode[key] = node;
    nodePorts[node]?.push(key);
  }
  const nodeCount = nodePorts.length;
  const fixed = new Float64Array(nodeCount).fill(NaN);
  for (const [key, value] of Object.entries(def.fixed ?? {})) {
    const node = portToNode[key];
    if (node !== undefined) fixed[node] = value;
  }
  const linkToNodes: Record<string, { from: number; to: number }> = {};
  for (const link of def.links) {
    const from = portToNode[link.from];
    const to = portToNode[link.to];
    if (from !== undefined && to !== undefined) linkToNodes[link.id] = { from, to };
  }

  return {
    elements,
    nodes: { count: nodeCount, ports: nodePorts, fixed },
    portToNode,
    linkToNodes,
    maxPorts,
  };
}

/** `SolverElement[]` a partir de una red compilada (lo arma `compileCircuit`
 *  y, tras fundir los buses, `compileVehicle`). */
export function solverElementsOf(
  elements: Readonly<Record<string, ElementDef>>,
  portToNode: Readonly<Record<string, number>>,
): SolverElement[] {
  const out: SolverElement[] = [];
  for (const [id, element] of Object.entries(elements)) {
    out.push({
      def: element,
      nodes: element.ports.map((port) => portToNode[`${id}.${port.id}`] ?? 0),
    });
  }
  return out;
}
