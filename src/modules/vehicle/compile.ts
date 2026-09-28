// `compileVehicle` (A15, plan del vehículo §4): compila los sistemas de un
// `VehicleDef` en un solo modelo, con los buses compartidos fundidos en
// nodos comunes (§30) y un bus de señales de varios dueños (§28). Único
// punto que conoce todos los módulos a la vez (§11: la excepción es el
// propio vehículo). Simplificación deliberada del §10 (D-V3): **un solo
// solver** para todo el vehículo, no uno por componente conexa — el
// benchmark (§10, `tests/vehicle/benchmark.test.ts`) mide que igual sobra
// margen (~90 nodos, presupuesto 4000 pasos/s); particionar en componentes
// queda como optimización futura si algún día hiciera falta (el "Plan B" de
// P23 §14.2 que el propio plan deja abierto).

import { createRng, type Rng } from '../../core/rng.ts';
import type { Model, ParamRecord } from '../../core/types.ts';
import { compileNet, solverElementsOf } from '../../sim/circuit/net.ts';
import { translateCircuit } from '../../sim/circuit/translate.ts';
import type { CircuitDef } from '../../sim/circuit/types.ts';
import { createVehicleEngineCore } from '../../sim/controllers/engineCore.ts';
import type { ControllerContext, ControllerDef } from '../../sim/controllers/index.ts';
import { ELEMENT_TYPES } from '../../sim/elements/index.ts';
import { createSolver } from '../../sim/solver/nodal.ts';
import type { ElementDef, Solver } from '../../sim/solver/types.ts';
import { createLabBusController, createVehicleBus, type LabBus } from '../../sim/signals/bus.ts';
import { createSignalStubs } from '../../sim/signals/stubs.ts';
import type { VehicleDef } from '../../sim/vehicle/types.ts';
import { SYSTEM_REGISTRY, type SystemWiring } from './registry.ts';

export interface CompiledVehicle {
  model: Model<ParamRecord, ParamRecord, Record<string, unknown>>;
  solver: Solver;
  elements: Readonly<Record<string, ElementDef>>;
  portToNode: Readonly<Record<string, number>>;
  bus: LabBus;
  /** `translated` es `undefined` para `kind: 'mechanism'` (sin red). */
  systems: readonly { id: string; wiring: SystemWiring; translated?: CircuitDef }[];
}

/** Params/faults del vehículo que NO llevan prefijo (plan §4 paso 6). */
const SHARED_PARAM_KEYS: readonly string[] = ['ignitionKey', 'throttle', 'rpm', 'vehicleSpeedKmh'];

/** Vista reusada: mismo objeto entre pasos, `refresh()` le copia encima sólo
 *  sus propias claves (una lista fija, calculada una vez al construirla —
 *  no un `Proxy` ni un escaneo de las ~80-100 claves del vehículo entero en
 *  cada paso: medido, cualquiera de los dos bajaba el benchmark de A15 §10
 *  por debajo del presupuesto de 4000 pasos/s). */
interface RefreshableView {
  readonly view: ParamRecord;
  refresh(): void;
}

/**
 * `params` que ve un sistema: sus propias claves (sin el prefijo) más las
 * compartidas del vehículo (`ctx.params['throttle']`, `ctx.params['batteryV']`
 * …), y `rpm`/`load` **reales** (`engine.rpm`/`engine.load` del bus, no el
 * slider ni un stub): `cooling`, `carburetor` e `ignition` los leen de
 * `params` (herencia del laboratorio, no `bus.get`), y en el vehículo deben
 * ver la rpm/carga que calcula `engineCore` (250 en el arranque), tal como
 * pide cada spec §12.
 */
function paramsView(all: Readonly<ParamRecord>, prefix: string, sharedKeys: readonly string[], bus: LabBus): RefreshableView {
  const withColon = `${prefix}:`;
  const ownKeys = Object.keys(all)
    .filter((k) => k.startsWith(withColon))
    .map((k) => [k.slice(withColon.length), k] as const);
  const view: ParamRecord = {};
  return {
    view,
    refresh(): void {
      for (const key of sharedKeys) {
        const value = all[key];
        if (value !== undefined) view[key] = value;
      }
      for (const [local, full] of ownKeys) {
        const value = all[full];
        if (value !== undefined) view[local] = value;
      }
      view['rpm'] = bus.get('engine.rpm');
      view['load'] = bus.get('engine.load');
    },
  };
}

function faultsView(all: Readonly<ParamRecord>, prefix: string): RefreshableView {
  const withColon = `${prefix}:`;
  const ownKeys = Object.keys(all)
    .filter((k) => k.startsWith(withColon))
    .map((k) => [k.slice(withColon.length), k] as const);
  const view: ParamRecord = {};
  return {
    view,
    refresh(): void {
      for (const [local, full] of ownKeys) {
        const value = all[full];
        if (value !== undefined) view[local] = value;
      }
    },
  };
}

/** Los elementos no cambian de referencia entre pasos (ni siquiera en
 *  `reset()`, sólo su `.state`/`.control`): a diferencia de `params`/
 *  `faults`, un objeto filtrado una sola vez es correcto y más rápido que
 *  un `Proxy` (nada que mantener "vivo"). */
function scopedElementsView(all: Readonly<Record<string, ElementDef>>, prefix: string): Record<string, ElementDef> {
  const out: Record<string, ElementDef> = {};
  const withColon = `${prefix}:`;
  for (const [key, value] of Object.entries(all)) {
    if (key.startsWith(withColon)) out[key.slice(withColon.length)] = value;
  }
  return out;
}

/** El `source` de un bus, si este sistema no es su proveedor, se excluye
 *  (§4 paso 3): sus puertos siguen registrados vía `CircuitDef.buses`
 *  (`compileNet`), así que los enlaces que lo mencionan igual se funden. */
function withoutForeignSources(def: CircuitDef, vehicle: VehicleDef, systemId: string): CircuitDef {
  let parts = def.parts;
  for (const busDef of vehicle.buses) {
    if (busDef.provider === systemId) continue;
    const source = def.buses?.[busDef.id]?.source;
    if (source === undefined) continue;
    parts = parts.filter((p) => p.id !== source);
  }
  return parts === def.parts ? def : { ...def, parts };
}

interface BuiltSystem {
  id: string;
  wiring: SystemWiring;
  /** `undefined` para `kind: 'mechanism'` (sin red). */
  translated?: CircuitDef;
}

/** Un controlador con su vista de `params`/`faults`/`elements`/sondas ya
 *  armada (una vez, no en cada paso — ver `scopedParamsView`); `owner` es
 *  `undefined` para los de alcance de vehículo (`bus`, `engineCore`). */
interface OwnedController {
  controller: ControllerDef;
  params: ParamRecord;
  faults: ParamRecord;
  elements: Record<string, ElementDef>;
  read: (probe: string) => number;
  /** No-op para los de alcance de vehículo (ya leen el record real). */
  refresh(): void;
  /** `undefined` = alcance de vehículo (sin prefijo, `publish` copia tal cual). */
  owner: string | undefined;
  /** `[clave local, clave con prefijo]` de `controller.state`, calculado una
   *  sola vez (sus claves no cambian, sólo los valores): evita reconstruir
   *  el string `${owner}:${key}` en cada paso dentro de `publish()`. */
  statePairs?: readonly (readonly [string, string])[];
}

export function compileVehicle(def: VehicleDef): CompiledVehicle {
  const built: BuiltSystem[] = def.systems.map((sys) => {
    const key = sys.circuit ?? sys.id;
    const wiring = SYSTEM_REGISTRY[key];
    if (!wiring) throw new Error(`compileVehicle: sistema desconocido '${key}'`);
    if (wiring.kind === 'mechanism') return { id: sys.id, wiring };
    const withoutForeign = withoutForeignSources(wiring.rawDef, def, sys.id);
    return { id: sys.id, wiring, translated: translateCircuit(withoutForeign, sys.at, sys.id) };
  });

  // 1. Red por sistema (numeración local) + desplazamiento a un espacio global.
  const nets = new Map<string, ReturnType<typeof compileNet>>();
  const offsets = new Map<string, number>();
  let totalLocalNodes = 0;
  for (const b of built) {
    if (b.wiring.kind !== 'circuit' || !b.translated) continue;
    const net = compileNet(b.translated, ELEMENT_TYPES);
    nets.set(b.id, net);
    offsets.set(b.id, totalLocalNodes);
    totalLocalNodes += net.nodes.count;
  }

  // 2. Union-find global: enlaces (ya resueltos dentro de cada red) + puertos
  // de bus (entre sistemas), sobre el espacio [0, totalLocalNodes).
  const parent = new Array<number>(totalLocalNodes);
  for (let i = 0; i < totalLocalNodes; i++) parent[i] = i;
  function find(i: number): number {
    let root = i;
    while ((parent[root] ?? root) !== root) root = parent[root] ?? root;
    let walk = i;
    while ((parent[walk] ?? root) !== root) {
      const next = parent[walk] ?? root;
      parent[walk] = root;
      walk = next;
    }
    return root;
  }
  function union(a: number, b: number): void {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  }
  function globalOf(systemId: string, local: number): number {
    return (offsets.get(systemId) ?? 0) + local;
  }

  for (const busDef of def.buses) {
    let first: number | undefined;
    for (const b of built) {
      const net = nets.get(b.id);
      if (!net || !b.translated) continue;
      const ports = b.translated.buses?.[busDef.id]?.ports ?? [];
      for (const port of ports) {
        const local = net.portToNode[port];
        if (local === undefined) continue;
        const g = globalOf(b.id, local);
        if (first === undefined) first = g;
        else union(first, g);
      }
    }
  }

  // 3. Numeración final densa + `portToNode` + `fixed` global.
  const rootToDense = new Map<number, number>();
  const fixed: number[] = [];
  const portToNode: Record<string, number> = {};
  for (const b of built) {
    const net = nets.get(b.id);
    if (!net) continue;
    for (const [port, local] of Object.entries(net.portToNode)) {
      const root = find(globalOf(b.id, local));
      let dense = rootToDense.get(root);
      if (dense === undefined) {
        dense = fixed.length;
        rootToDense.set(root, dense);
        fixed.push(NaN);
      }
      portToNode[port] = dense;
      const localFixed = net.nodes.fixed[local] ?? NaN;
      if (!Number.isNaN(localFixed)) fixed[dense] = localFixed;
    }
  }
  const nodeCount = fixed.length;

  // 4. Elementos fundidos + estado inicial especial (cuba del carburador,
  // cárter de lubricación: no arrancan con el nivel genérico de `tank`).
  const elements: Record<string, ElementDef> = {};
  for (const net of nets.values()) Object.assign(elements, net.elements);
  const solverElements = solverElementsOf(elements, portToNode);
  function initElements(): void {
    for (const element of Object.values(elements)) element.init?.({});
    for (const b of built) {
      if (b.wiring.kind === 'circuit') b.wiring.initState?.(elements, b.id);
    }
  }
  initElements();

  // 5. Bus del vehículo (§5, D-V4).
  const bus = createVehicleBus({
    signals: def.signals.map((s) => ({
      id: s.id,
      owner: s.owner,
      ...(s.latency !== undefined ? { latency: s.latency } : {}),
    })),
    stubs: createSignalStubs(),
  });

  // 6. `params`/`faults` planos, con prefijo salvo los compartidos (§4.6).
  const params: ParamRecord = {};
  const faults: ParamRecord = {};
  for (const b of built) {
    const dp = b.wiring.moduleDescriptor.defaultParams;
    const df = b.wiring.moduleDescriptor.defaultFaults;
    for (const [key, value] of Object.entries(dp)) {
      if (SHARED_PARAM_KEYS.includes(key)) params[key] = value;
      else params[`${b.id}:${key}`] = value;
    }
    for (const [key, value] of Object.entries(df)) faults[`${b.id}:${key}`] = value;
  }
  const initialParams: ParamRecord = { ...params };
  const initialFaults: ParamRecord = { ...faults };

  // 7. `engineCore` del vehículo (hoisted, §4 paso 5): el sistema de
  // alimentación (el único con `fluid: 'fuel'`) aporta `manifold` y, si lo
  // tiene, `vacuumHose` (D-V7); el carburador no tiene el segundo.
  const alimentacion = built.find((b) => b.translated?.fluid === 'fuel');
  const hasVacuumHose = alimentacion?.translated?.parts.some((p) => p.id === `${alimentacion.id}:vacuumHose`) ?? false;
  const engineCoreOptions = alimentacion
    ? {
        bus,
        elementIds: {
          manifold: `${alimentacion.id}:manifold`,
          ...(hasVacuumHose ? { vacuumHose: `${alimentacion.id}:vacuumHose` } : {}),
        },
        ...(hasVacuumHose ? { vacuumHoseOffFaultKey: `${alimentacion.id}:vacuumHoseOff` } : {}),
      }
    : { bus };

  // 8. Controladores, en orden: cierre del bus → motor (vehículo) →
  // sistemas en el orden de `VehicleDef.systems` (plan §4 paso 5; el motor
  // de 4 tiempos va primero entre los sistemas para que la fase same-step,
  // §5.2, llegue antes a quien la lee: encendido, combustible/carburador).
  let solver: Solver = createSolver({ nodeCount, elements: solverElements, ground: Float64Array.from(fixed) });

  function ownedControllerOf(owner: string | undefined, controller: ControllerDef): OwnedController {
    if (!owner) {
      return {
        owner,
        controller,
        params,
        faults,
        elements,
        read: (probe) => probeValues[probe] ?? 0,
        refresh(): void {
          // A propósito: ya lee `params`/`faults` reales, no una vista.
        },
      };
    }
    const p = paramsView(params, owner, SHARED_PARAM_KEYS, bus);
    const f = faultsView(faults, owner);
    return {
      owner,
      controller,
      params: p.view,
      faults: f.view,
      elements: scopedElementsView(elements, owner),
      read: (probe: string): number => probeValues[`${owner}:${probe}`] ?? 0,
      refresh(): void {
        p.refresh();
        f.refresh();
      },
      ...(controller.state
        ? { statePairs: Object.keys(controller.state).map((key) => [key, `${owner}:${key}`] as const) }
        : {}),
    };
  }

  function buildControllers(): OwnedController[] {
    const out: OwnedController[] = [];
    out.push(ownedControllerOf(undefined, createLabBusController('bus', bus)));
    out.push(ownedControllerOf(undefined, createVehicleEngineCore('engineCore', engineCoreOptions)));
    for (const b of built) {
      if (b.wiring.kind === 'mechanism') {
        out.push(ownedControllerOf(b.id, b.wiring.createController(`${b.id}:mechanism`, bus)));
        continue;
      }
      if (!b.translated) continue;
      const setPotential = (part: string, port: string, value: number): void => {
        const node = portToNode[`${b.id}:${part}.${port}`];
        if (node !== undefined) solver.setPotential(node, value);
      };
      const controllerTypes = b.wiring.buildControllerTypes({ bus, setPotential });
      for (const cdef of b.translated.controllers ?? []) {
        if (cdef.type === 'labBus') continue;
        const factory = controllerTypes[cdef.type];
        if (!factory) continue;
        out.push(ownedControllerOf(b.id, factory(cdef.id, cdef.params ?? {})));
      }
    }
    return out;
  }
  let probeValues: Record<string, number> = {};
  let controllers: OwnedController[] = buildControllers();

  const probeDefs: Record<string, { node?: string; element?: string; probe?: string }> = {};
  for (const b of built) {
    if (!b.translated?.probes) continue;
    Object.assign(probeDefs, b.translated.probes);
  }
  const state: Record<string, unknown> = {};
  const rng: Rng = createRng(12345);
  let time = 0;

  // Buffer reusado entre sondas (como `compileCircuit`): una sonda por
  // elemento no necesita alocar un `Float64Array` en cada paso.
  let maxPorts = 1;
  for (const element of Object.values(elements)) {
    if (element.ports.length > maxPorts) maxPorts = element.ports.length;
  }
  const pot = new Float64Array(maxPorts);

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

  const probeNames = Object.keys(probeDefs);
  const signalKeys = def.signals.map((s) => [s.id, `signal.${s.id}`] as const);

  function publish(): void {
    for (const name of probeNames) {
      const value = readProbe(name);
      probeValues[name] = value;
      state[name] = value;
    }
    for (const oc of controllers) {
      const controllerState = oc.controller.state;
      if (!controllerState) continue;
      if (!oc.statePairs) {
        Object.assign(state, controllerState);
        continue;
      }
      for (const [key, prefixedKey] of oc.statePairs) state[prefixedKey] = controllerState[key];
    }
    for (const [id, key] of signalKeys) state[key] = bus.get(id);
    state['time'] = time;
  }

  function step(dt: number): void {
    for (const oc of controllers) {
      oc.refresh();
      const ctx: ControllerContext = {
        dt,
        read: oc.read,
        params: oc.params,
        faults: oc.faults,
        elements: oc.elements,
        rng,
      };
      oc.controller.update(ctx);
    }
    solver.step(dt);
    publish();
    time += dt;
  }

  function reset(): void {
    Object.assign(params, initialParams);
    Object.assign(faults, initialFaults);
    initElements();
    solver = createSolver({ nodeCount, elements: solverElements, ground: Float64Array.from(fixed) });
    controllers = buildControllers();
    probeValues = {};
    time = 0;
    publish();
  }

  publish();

  const model: Model<ParamRecord, ParamRecord, Record<string, unknown>> = {
    params,
    faults,
    state,
    actions: {},
    get time(): number {
      return time;
    },
    step,
    reset,
  };

  return {
    model,
    get solver(): Solver {
      return solver;
    },
    elements,
    portToNode,
    bus,
    systems: built.map((b) => ({ id: b.id, wiring: b.wiring, ...(b.translated ? { translated: b.translated } : {}) })),
  };
}
