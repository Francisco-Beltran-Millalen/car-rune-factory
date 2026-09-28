// Compilador de circuitos: `CircuitDef` → modelo con solver y controladores
// (P23 §8.4). Puro (§1). Los tipos exactos están en ./types.ts.

import { createRng, type Rng } from '../../core/rng.ts';
import type { Model, ParamRecord, ParamValue } from '../../core/types.ts';
import { createControllers, type ControllerContext, type ControllerDef } from '../controllers/index.ts';
import { createSolver } from '../solver/nodal.ts';
import type { Solver } from '../solver/types.ts';
import { compileNet, solverElementsOf } from './net.ts';
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
  const net = compileNet(def, types);
  const { elements, portToNode, linkToNodes } = net;
  const { count: nodeCount, fixed } = net.nodes;

  const initOverrides = options.init ?? {};
  for (const element of Object.values(elements)) element.init?.(initOverrides);

  const solverElements = solverElementsOf(elements, portToNode);

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
  const pot = new Float64Array(net.maxPorts);
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

  /** `CircuitDef.initial`: potencial de arranque de nodos libres (A13). */
  function applyInitial(): void {
    for (const [key, value] of Object.entries(def.initial ?? {})) {
      const node = portToNode[key];
      if (node !== undefined) solver.setPotential(node, value);
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
    applyInitial();
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

  applyInitial();
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
    nodes: net.nodes,
    portToNode,
    linkToNodes,
    issues,
  };
}
