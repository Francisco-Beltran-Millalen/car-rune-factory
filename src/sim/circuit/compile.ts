// Compilador de circuitos: `CircuitDef` → modelo con solver y controladores
// (P23 §8.4). Puro (§1). Los tipos exactos están en ./types.ts.

import { createRng, type Rng } from '../../core/rng.ts';
import type { Model, ParamRecord, ParamValue } from '../../core/types.ts';
import { createControllers, type ControllerContext, type ControllerDef } from '../controllers/index.ts';
import { createSolver } from '../solver/nodal.ts';
import type { ElementDef, Solver, SolverElement } from '../solver/types.ts';
import { buildParts } from './parts.ts';
import type {
  CircuitBinding,
  CircuitState,
  CompileOptions,
  CompiledCircuit,
} from './types.ts';
import { validateCircuit } from './validate.ts';

export function compileCircuit<S extends CircuitState = CircuitState>(
  options: CompileOptions<S>,
): CompiledCircuit<S> {
  const { def, types, state } = options;
  const issues = validateCircuit(def, types, options.controllerTypes);
  const parts = buildParts(def, types);

  const elements: Record<string, ElementDef> = {};
  let maxPorts = 1;
  for (const [id, built] of parts) {
    const element = built.element;
    if (!element) continue;
    elements[id] = element;
    if (element.ports.length > maxPorts) maxPorts = element.ports.length;
  }

  const initOverrides = options.init ?? {};
  for (const element of Object.values(elements)) element.init?.(initOverrides);

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

  const solverElements: SolverElement[] = [];
  for (const [id, built] of parts) {
    const element = built.element;
    if (!element) continue;
    solverElements.push({
      def: element,
      nodes: built.ports.map((port) => portToNode[`${id}.${port.id}`] ?? 0),
    });
  }

  const initialParams: ParamRecord = { ...(def.params ?? {}), ...(options.params ?? {}) };
  const initialFaults: ParamRecord = { ...(def.faults ?? {}), ...(options.faults ?? {}) };
  // Si el módulo entrega sus objetos tipados, el compilador los usa como
  // propios (así `createCompiledFuelModel` los expone sin cast); si no, copia.
  const params: ParamRecord = options.params ?? { ...(def.params ?? {}) };
  const faults: ParamRecord = options.faults ?? { ...(def.faults ?? {}) };

  const controllerDefs = def.controllers ?? [];
  const controllerTypes = options.controllerTypes ?? {};
  let controllers: ControllerDef[] = createControllers(controllerDefs, controllerTypes);
  let solver: Solver = createSolver({ nodeCount, elements: solverElements, ground: fixed });
  const rng: Rng = createRng(options.seed ?? 12345);

  const probeDefs = def.probes ?? {};
  let probeValues: Record<string, number> = {};
  const published: CircuitState = {};
  const pot = new Float64Array(maxPorts);
  let time = 0;

  function readProbe(name: string): number {
    const probe = probeDefs[name];
    if (!probe) return 0;
    if (probe.node) {
      const node = portToNode[probe.node];
      return node === undefined ? 0 : solver.potential(node);
    }
    if (probe.element) {
      const element = elements[probe.element];
      const probeFn = probe.probe ? element?.probes?.[probe.probe] : undefined;
      if (!element || !probeFn) return 0;
      for (let p = 0; p < element.ports.length; p++) {
        const portId = element.ports[p]?.id ?? '';
        pot[p] = solver.potential(portToNode[`${probe.element}.${portId}`] ?? 0);
      }
      return probeFn(pot);
    }
    return 0;
  }

  function publish(): void {
    for (const name of Object.keys(probeDefs)) {
      const value = readProbe(name);
      probeValues[name] = value;
      published[name] = value;
    }
    Object.assign(state, published);
    for (const controller of controllers) {
      if (controller.state) Object.assign(state, controller.state);
    }
  }

  const bindings: readonly CircuitBinding[] = options.bindings ?? [];
  function applyBindings(): void {
    for (const binding of bindings) {
      const value: ParamValue | undefined =
        binding.source === 'faults' ? faults[binding.key] : params[binding.key];
      if (typeof value !== 'number' && typeof value !== 'boolean') continue;
      const element = elements[binding.part];
      if (element) element.control[binding.input] = value;
    }
  }

  function step(dt: number): void {
    applyBindings();
    const context: ControllerContext = {
      dt,
      read: (probe) => probeValues[probe] ?? 0,
      params,
      faults,
      elements,
      rng,
    };
    for (const controller of controllers) controller.update(context);
    solver.step(dt);
    publish();
    time += dt;
  }

  function reset(): void {
    Object.assign(params, initialParams);
    Object.assign(faults, initialFaults);
    for (const element of Object.values(elements)) element.init?.(initOverrides);
    solver = createSolver({ nodeCount, elements: solverElements, ground: fixed });
    controllers = createControllers(controllerDefs, controllerTypes);
    probeValues = {};
    publish();
    time = 0;
  }

  const model: Model<ParamRecord, ParamRecord, S> = {
    params,
    faults,
    state,
    actions: options.actions ?? {},
    get time(): number {
      return time;
    },
    step,
    reset,
  };

  publish();

  return {
    model,
    get solver(): Solver {
      return solver;
    },
    elements,
    get controllers(): readonly ControllerDef[] {
      return controllers;
    },
    nodes: { count: nodeCount, ports: nodePorts, fixed },
    portToNode,
    linkToNodes,
    issues,
  };
}
