// Circuito del carburador (A16): la red de bencina (estanque → bomba →
// filtro → aguja → cuba → surtidores) más el controlador `carbCore`. Puro
// (§1). El aire y la mezcla no pasan por el solver (spec §1): sólo la
// bencina. Plan V1: las puntas de los enlaces visibles salen de la
// geometría de los drawers; acá sólo los codos (`via`).

import type { Model, ModelActions } from '../../core/types.ts';
import { compileCircuit } from '../../sim/circuit/compile.ts';
import type { CircuitDef, CircuitLinkDef, CompiledCircuit } from '../../sim/circuit/types.ts';
import type { ControllerFactory } from '../../sim/controllers/index.ts';
import { ELEMENT_TYPES } from '../../sim/elements/index.ts';
import { createLabBus, createLabBusController, type LabBus } from '../../sim/signals/bus.ts';
import { createSignalStubs } from '../../sim/signals/stubs.ts';
import {
  createCarburetor,
  DEFAULT_FAULTS,
  DEFAULT_PARAMS,
  createInitialCarburetorState,
  type CarburetorController,
  type CarburetorFaults,
  type CarburetorParams,
  type CarburetorState,
} from './controllers.ts';
import { K } from './constants.ts';

export type CarburetorModel = Model<CarburetorParams, CarburetorFaults, CarburetorState>;

export interface CarburetorOverrides {
  seed?: number;
  tankLevel?: number;
  bowlLevel?: number;
  params?: Partial<CarburetorParams>;
  faults?: Partial<CarburetorFaults>;
}

const OWNER = 'carburetor';
const PUBLISHES = ['fuel.mixture'] as const;

const FUEL = { pipeClass: 'fluid-fuel', flowClass: 'p-fuel', width: 8, radius: 3 } as const;

function links(): CircuitLinkDef[] {
  return [
    { id: 'h-tank-line', from: 'tank.out', to: 'fuelLine.a', visual: { ...FUEL, owner: 'tank' } },
    { id: 'h-line-pump', from: 'fuelLine.b', to: 'mechPump.in', via: [[510, 465]], visual: { ...FUEL, owner: 'fuelLine' } },
    { id: 'h-pump-node', from: 'mechPump.out', to: 'pumpOutNode.a', visual: { ...FUEL, owner: 'mechPump' } },
    { id: 'h-node-filter', from: 'pumpOutNode.b', to: 'fuelFilter.a', via: [[720, 600]], visual: { ...FUEL, owner: 'fuelFilter' } },
    { id: 'h-node-leak', from: 'pumpOutNode.c', to: 'pumpLeak.a' },
    { id: 'h-filter-needle', from: 'fuelFilter.b', to: 'needleValve.a', visual: { ...FUEL, owner: 'fuelFilter' } },
    { id: 'h-needle-bowl', from: 'needleValve.b', to: 'floatBowl.ret' },
    { id: 'h-bowl-jets', from: 'floatBowl.out', to: 'jets.a' },
    { id: 'h-jets-manifold', from: 'jets.b', to: 'manifold.a' },
  ];
}

export const CARB_DEF: CircuitDef = {
  id: 'carburetor',
  title: 'Carburador años 70',
  fluid: 'fuel',
  parts: [
    { id: 'tank', type: 'tank', visual: 'tank', x: 40, y: 480, params: { capacity: K.tankCapacity, pickupLow: 1 } },
    { id: 'fuelLine', type: 'restrictor', visual: 'hosePoint', label: 'Línea de alimentación', x: 200, y: 465, params: { k: 1e-6, clogFactor: 0 } },
    { id: 'mechPump', type: 'displacementPump', visual: 'mechPump', x: 420, y: 540, params: { disp: K.disp, slip: K.pumpSlip, pMax: K.pumpMax, wearQ: K.pumpWearQ } },
    { id: 'pumpOutNode', type: 'tee', x: 600, y: 600 },
    { id: 'pumpLeak', type: 'leak', x: 600, y: 650, params: { k: K.pumpLeakK } },
    { id: 'fuelFilter', type: 'restrictor', visual: 'filter', x: 720, y: 560, params: { k: K.filterK, clogFactor: K.filterClogFactor } },
    { id: 'needleValve', type: 'variableOrifice', x: 800, y: 165, joinedBy: 'floatBowl', params: { gOpen: K.needleGOpen, gLeak: K.needleGLeak } },
    { id: 'floatBowl', type: 'tank', visual: 'floatBowl', x: 820, y: 120, params: { capacity: K.bowlCapacity, pickupLow: 1 } },
    { id: 'jets', type: 'flowSource', x: 900, y: 200 },
    { id: 'manifold', type: 'pressureSource', x: 950, y: 200 },
    { id: 'carbBody', type: 'visual', visual: 'carbBody', x: 380, y: 70 },
    { id: 'choke', type: 'visual', visual: 'choke', x: 560, y: 20 },
  ],
  links: links(),
  controllers: [
    { id: 'labBus', type: 'labBus' },
    { id: 'carburetor', type: 'carburetor' },
  ],
  probes: {
    qPump: { element: 'mechPump', probe: 'q' },
    pPump: { node: 'mechPump.out' },
    qFilter: { element: 'fuelFilter', probe: 'q' },
    bowlLevel: { element: 'floatBowl', probe: 'level' },
    tankLevel: { element: 'tank', probe: 'level' },
  },
  params: DEFAULT_PARAMS,
  faults: DEFAULT_FAULTS,
};

interface CarburetorBuild {
  circuit: CompiledCircuit<CarburetorState>;
  params: CarburetorParams;
  faults: CarburetorFaults;
  state: CarburetorState;
  bus: LabBus;
}

function applyLevels(circuit: CompiledCircuit<CarburetorState>, overrides: CarburetorOverrides): void {
  const tank = circuit.elements['tank'];
  if (tank) tank.state['level'] = overrides.tankLevel ?? K.tankDefault;
  const bowl = circuit.elements['floatBowl'];
  if (bowl) bowl.state['level'] = overrides.bowlLevel ?? K.bowlNominal;
}

function buildCarburetor(overrides: CarburetorOverrides = {}): CarburetorBuild {
  const state = createInitialCarburetorState();
  const params: CarburetorParams = { ...DEFAULT_PARAMS, ...overrides.params };
  const faults: CarburetorFaults = { ...DEFAULT_FAULTS, ...overrides.faults };
  const bus = createLabBus({
    owner: OWNER,
    publishes: PUBLISHES,
    // `engine.rpm`/`intake.map`/`air.massFlow` ya coinciden con `rpm`/
    // `throttle` (SIGNAL_STUBS, spec §5.1); sólo hace falta la temperatura.
    stubs: createSignalStubs({
      'engine.coolantTemp': (p) => (typeof p['engineTempC'] === 'number' ? p['engineTempC'] : 90),
    }),
  });
  let controller: CarburetorController | null = null;
  const controllerTypes: Readonly<Record<string, ControllerFactory>> = {
    labBus: (id) => createLabBusController(id, bus),
    carburetor: (id, controllerParams) => {
      controller = createCarburetor(id, controllerParams, { bus });
      return controller;
    },
  };
  let circuitRef: CompiledCircuit<CarburetorState> | null = null;
  const actions: ModelActions = {
    refill: (): void => {
      const tank = circuitRef?.elements['tank'];
      if (tank) tank.state['level'] = K.tankDefault;
    },
    primeBowl: (): void => {
      const bowl = circuitRef?.elements['floatBowl'];
      if (bowl) bowl.state['level'] = K.bowlNominal;
    },
  };
  const circuit = compileCircuit<CarburetorState>({
    def: CARB_DEF,
    types: ELEMENT_TYPES,
    controllerTypes,
    state,
    params,
    faults,
    actions,
    seed: overrides.seed ?? 12345,
  });
  circuitRef = circuit;
  applyLevels(circuit, overrides);
  return { circuit, params, faults, state, bus };
}

export function compileCarburetorCircuit(overrides: CarburetorOverrides = {}): CompiledCircuit<CarburetorState> {
  return buildCarburetor(overrides).circuit;
}

export function createCarburetorModel(overrides: CarburetorOverrides = {}): CarburetorModel {
  return createCarburetorHarness(overrides).model;
}

/** Modelo + bus (tests y señales §28). */
export function createCarburetorHarness(
  overrides: CarburetorOverrides = {},
): { model: CarburetorModel; bus: LabBus } {
  const built = buildCarburetor(overrides);
  const model: CarburetorModel = {
    params: built.params,
    faults: built.faults,
    state: built.state,
    actions: built.circuit.model.actions,
    get time(): number {
      return built.circuit.model.time;
    },
    step: (dt: number): void => {
      built.circuit.model.step(dt);
    },
    reset: (): void => {
      built.circuit.model.reset();
      applyLevels(built.circuit, overrides);
    },
  };
  return { model, bus: built.bus };
}
