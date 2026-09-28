// Circuitos del encendido (A12): baja tensión sobre el solver + piezas
// visuales, y el controlador `ignitionCore`. Puro (§1). Los dos descriptores
// salen de acá (spec ignition §1).

import type { Model, ModelActions, ParamValue } from '../../core/types.ts';
import { compileCircuit } from '../../sim/circuit/compile.ts';
import type { CircuitDef, CircuitLinkDef, CompiledCircuit } from '../../sim/circuit/types.ts';
import type { ControllerFactory } from '../../sim/controllers/index.ts';
import { ELEMENT_TYPES } from '../../sim/elements/index.ts';
import { createLabBus, createLabBusController, type LabBus } from '../../sim/signals/bus.ts';
import { createSignalStubs } from '../../sim/signals/stubs.ts';
import type { IgnitionVariant } from './constants.ts';
import {
  DEFAULT_FAULTS,
  DEFAULT_PARAMS,
  createIgnition,
  createInitialIgnitionState,
  type IgnitionFaults,
  type IgnitionParams,
  type IgnitionState,
} from './core.ts';

export type IgnitionModel = Model<IgnitionParams, IgnitionFaults, IgnitionState>;

export interface IgnitionOverrides {
  seed?: number;
  params?: Partial<IgnitionParams>;
  faults?: Partial<IgnitionFaults>;
}

const OWNER = 'ignition';
const PUBLISHES = [
  'ignition.spark',
  'ignition.advance',
  'ignition.vacuumLeak',
  'ecu.sync',
] as const;

const WIRE = {
  pipeClass: 'fluid-electric',
  flowClass: 'p-electric',
  scale: 60,
  spacing: 10,
  radius: 2,
  width: 3,
} as const;

const PLAIN = { pipeClass: 'fluid-electric', radius: 2, width: 3 } as const;

function num(value: ParamValue | undefined, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** Baja tensión de platinos: batería → llave → (balasto ∥ puente) → bobina. */
export const IGNITION_POINTS_DEF: CircuitDef = {
  id: 'ignition-points',
  title: 'Encendido años 70 (platinos)',
  parts: [
    { id: 'battery', type: 'battery', visual: 'battery', x: 40, y: 40, params: { r: 0.01 } },
    { id: 'key', type: 'switch', visual: 'key', x: 170, y: 40, params: { rOn: 0.001, rOff: 1e7 } },
    { id: 'j1', type: 'junction', x: 270, y: 70 },
    { id: 'ballast', type: 'switch', visual: 'ballast', x: 300, y: 40, params: { rOn: 1.5, rOff: 1e7 } },
    // El contacto de arranque puentea el balasto en `start` (spec §5).
    { id: 'startBridge', type: 'switch', visual: 'relay', label: 'Puente (arranque)', x: 310, y: 130, params: { rOn: 0.001, rOff: 1e7 } },
    { id: 'j2', type: 'junction', x: 420, y: 70 },
    { id: 'coil', type: 'currentLoad', visual: 'coil', x: 500, y: 40 },
    { id: 'distributor', type: 'visual', visual: 'distributor', x: 140, y: 240 },
    { id: 'sparkPlug1', type: 'visual', visual: 'sparkPlug', x: 640, y: 240 },
    { id: 'sparkPlug2', type: 'visual', visual: 'sparkPlug', x: 780, y: 240 },
    { id: 'sparkPlug3', type: 'visual', visual: 'sparkPlug', x: 920, y: 240 },
    { id: 'sparkPlug4', type: 'visual', visual: 'sparkPlug', x: 1060, y: 240 },
    { id: 'scope', type: 'visual', visual: 'scope', x: 900, y: 470 },
  ],
  links: [
    { id: 'e-bat-key', from: 'battery.+', to: 'key.a', via: [[99, 20], [160, 20], [160, 70]], visual: { ...WIRE, owner: 'battery' } },
    { id: 'e-key-j1', from: 'key.b', to: 'j1.a', visual: { ...WIRE, owner: 'key' } },
    { id: 'e-j1-ballast', from: 'j1.b', to: 'ballast.a', visual: { ...PLAIN, owner: 'ballast' } },
    { id: 'e-j1-bridge', from: 'j1.c', to: 'startBridge.a', via: [[270, 160]], visual: { ...PLAIN, owner: 'startBridge' } },
    { id: 'e-ballast-j2', from: 'ballast.b', to: 'j2.a', visual: PLAIN },
    { id: 'e-bridge-j2', from: 'startBridge.b', to: 'j2.b', via: [[420, 160]], visual: { ...PLAIN, owner: 'startBridge' } },
    { id: 'e-j2-coil', from: 'j2.c', to: 'coil.a', via: [[420, 20], [560, 20]], visual: { ...WIRE, owner: 'coil' } },
    // Masa del primario (a través de los platinos): por arriba, al borne −.
    { id: 'e-coil-gnd', from: 'coil.b', to: 'battery.-', via: [[640, 80], [640, 10], [61, 10]], visual: PLAIN },
  ] satisfies readonly CircuitLinkDef[],
  controllers: [
    { id: 'labBus', type: 'labBus' },
    { id: 'ignition', type: 'ignition' },
  ],
  probes: {
    coilV: { node: 'ballast.a' },
  },
  params: DEFAULT_PARAMS,
  faults: DEFAULT_FAULTS,
  fixed: { 'battery.-': 0 },
  // A15, plan del vehículo §8: en `vehicle-70` este sistema provee el bus
  // `12v` (su batería/llave); si no es el proveedor, `compileVehicle` excluye
  // `battery` (§3.1, §4 paso 3) y sus puertos quedan igual fundidos al riel.
  buses: {
    '12v': { ports: ['battery.+'], source: 'battery' },
    chassis: { ports: ['battery.-'] },
  },
};

/** Baja tensión del COP: batería → llave → bus → 4 bobinas → masa. */
export const IGNITION_COP_DEF: CircuitDef = {
  id: 'ignition-cop',
  title: 'Encendido años 2000 (COP)',
  parts: [
    { id: 'battery', type: 'battery', visual: 'battery', x: 40, y: 40, params: { r: 0.01 } },
    { id: 'key', type: 'switch', visual: 'key', x: 170, y: 40, params: { rOn: 0.001, rOff: 1e7 } },
    { id: 'coilBus', type: 'junction', x: 290, y: 70 },
    { id: 'coil1', type: 'currentLoad', visual: 'coilCop', x: 380, y: 40 },
    { id: 'coil2', type: 'currentLoad', visual: 'coilCop', x: 560, y: 40 },
    { id: 'coil3', type: 'currentLoad', visual: 'coilCop', x: 740, y: 40 },
    { id: 'coil4', type: 'currentLoad', visual: 'coilCop', x: 920, y: 40 },
    { id: 'groundBus', type: 'junction', x: 290, y: 150 },
    { id: 'ecu', type: 'visual', visual: 'ecu', x: 240, y: 300 },
    { id: 'toothWheel', type: 'visual', visual: 'toothWheel', x: 560, y: 330 },
    { id: 'sparkPlug1', type: 'visual', visual: 'sparkPlug', x: 380, y: 250 },
    { id: 'sparkPlug2', type: 'visual', visual: 'sparkPlug', x: 560, y: 250 },
    { id: 'sparkPlug3', type: 'visual', visual: 'sparkPlug', x: 740, y: 250 },
    { id: 'sparkPlug4', type: 'visual', visual: 'sparkPlug', x: 920, y: 250 },
    { id: 'scope', type: 'visual', visual: 'scope', x: 940, y: 470 },
  ],
  links: [
    { id: 'e-bat-key', from: 'battery.+', to: 'key.a', via: [[99, 20], [160, 20], [160, 70]], visual: { ...WIRE, owner: 'battery' } },
    { id: 'e-key-bus', from: 'key.b', to: 'coilBus.a', visual: { ...WIRE, owner: 'key' } },
    // Alimentación por arriba (y = 20) y masas por abajo (y = 150): dos rieles.
    { id: 'e-bus-c1', from: 'coilBus.b', to: 'coil1.a', via: [[290, 20], [440, 20]], visual: { ...PLAIN, owner: 'coil1' } },
    { id: 'e-bus-c2', from: 'coilBus.c', to: 'coil2.a', via: [[290, 20], [620, 20]], visual: { ...PLAIN, owner: 'coil2' } },
    { id: 'e-bus-c3', from: 'coilBus.d', to: 'coil3.a', via: [[290, 20], [800, 20]], visual: { ...PLAIN, owner: 'coil3' } },
    { id: 'e-bus-c4', from: 'coilBus.e', to: 'coil4.a', via: [[290, 20], [980, 20]], visual: { ...PLAIN, owner: 'coil4' } },
    { id: 'e-c1-gnd', from: 'coil1.b', to: 'groundBus.a', via: [[530, 80], [530, 150]], visual: PLAIN },
    { id: 'e-c2-gnd', from: 'coil2.b', to: 'groundBus.b', via: [[710, 80], [710, 150]], visual: PLAIN },
    { id: 'e-c3-gnd', from: 'coil3.b', to: 'groundBus.c', via: [[890, 80], [890, 150]], visual: PLAIN },
    { id: 'e-c4-gnd', from: 'coil4.b', to: 'groundBus.d', via: [[1070, 80], [1070, 150]], visual: PLAIN },
    { id: 'e-gnd-bat', from: 'groundBus.e', to: 'battery.-', via: [[20, 150], [20, 10], [61, 10]], visual: PLAIN },
  ] satisfies readonly CircuitLinkDef[],
  controllers: [
    { id: 'labBus', type: 'labBus' },
    { id: 'ignition', type: 'ignition' },
  ],
  probes: {
    coilV: { node: 'coil1.a' },
  },
  params: DEFAULT_PARAMS,
  faults: DEFAULT_FAULTS,
  fixed: { 'battery.-': 0 },
  // A15, plan del vehículo §8: en `vehicle-70` este sistema provee el bus
  // `12v` (su batería/llave); si no es el proveedor, `compileVehicle` excluye
  // `battery` (§3.1, §4 paso 3) y sus puertos quedan igual fundidos al riel.
  buses: {
    '12v': { ports: ['battery.+'], source: 'battery' },
    chassis: { ports: ['battery.-'] },
  },
};

export function ignitionDef(variant: IgnitionVariant): CircuitDef {
  return variant === 'points' ? IGNITION_POINTS_DEF : IGNITION_COP_DEF;
}

interface IgnitionBuild {
  circuit: CompiledCircuit<IgnitionState>;
  params: IgnitionParams;
  faults: IgnitionFaults;
  state: IgnitionState;
  bus: LabBus;
}

function buildIgnition(variant: IgnitionVariant, overrides: IgnitionOverrides = {}): IgnitionBuild {
  const state = createInitialIgnitionState();
  const params: IgnitionParams = { ...DEFAULT_PARAMS, ...overrides.params };
  const faults: IgnitionFaults = { ...DEFAULT_FAULTS, ...overrides.faults };
  const bus = createLabBus({
    owner: OWNER,
    publishes: PUBLISHES,
    stubs: createSignalStubs({
      'engine.rpm': (p) => num(p['rpm']),
      'intake.map': (p) => -0.65 + 0.65 * num(p['throttle']),
      'engine.compression': (p) => num(p['compression'], 1),
    }),
  });
  const controllerTypes: Readonly<Record<string, ControllerFactory>> = {
    labBus: (id) => createLabBusController(id, bus),
    ignition: (id, controllerParams) => createIgnition(id, controllerParams, { bus, variant }),
  };
  const actions: ModelActions = {};
  const circuit = compileCircuit<IgnitionState>({
    def: ignitionDef(variant),
    types: ELEMENT_TYPES,
    controllerTypes,
    state,
    params,
    faults,
    actions,
    seed: overrides.seed ?? 12345,
  });
  return { circuit, params, faults, state, bus };
}

export function compileIgnitionCircuit(
  variant: IgnitionVariant,
  overrides: IgnitionOverrides = {},
): CompiledCircuit<IgnitionState> {
  return buildIgnition(variant, overrides).circuit;
}

export function createIgnitionModel(
  variant: IgnitionVariant,
  overrides: IgnitionOverrides = {},
): IgnitionModel {
  return createIgnitionHarness(variant, overrides).model;
}

/** Modelo + bus (el bus lo usan los tests de señales, §28). */
export function createIgnitionHarness(
  variant: IgnitionVariant,
  overrides: IgnitionOverrides = {},
): { model: IgnitionModel; bus: LabBus } {
  const { circuit, params, faults, state, bus } = buildIgnition(variant, overrides);
  const model: IgnitionModel = {
    params,
    faults,
    state,
    actions: circuit.model.actions,
    get time(): number {
      return circuit.model.time;
    },
    step: (dt: number): void => {
      circuit.model.step(dt);
    },
    reset: (): void => {
      circuit.model.reset();
    },
  };
  return { model, bus };
}
