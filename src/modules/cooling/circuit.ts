// Circuito de la refrigeración (A13): red hidráulica de refrigerante, red
// térmica y (variante eléctrica) la del electroventilador. Puro (§1).

import type { Model, ModelActions, ParamValue } from '../../core/types.ts';
import { compileCircuit } from '../../sim/circuit/compile.ts';
import type { CircuitDef, CircuitLinkDef, CompiledCircuit } from '../../sim/circuit/types.ts';
import type { ControllerFactory } from '../../sim/controllers/index.ts';
import { ELEMENT_TYPES } from '../../sim/elements/index.ts';
import { createLabBus, createLabBusController, type LabBus } from '../../sim/signals/bus.ts';
import { createSignalStubs } from '../../sim/signals/stubs.ts';
import { K, VARIANTS, type CoolingVariant } from './constants.ts';
import {
  DEFAULT_FAULTS,
  DEFAULT_PARAMS,
  createCooling,
  createInitialCoolingState,
  type CoolingController,
  type CoolingFaults,
  type CoolingParams,
  type CoolingState,
} from './controllers.ts';

export type CoolingModel = Model<CoolingParams, CoolingFaults, CoolingState>;

export interface CoolingOverrides {
  seed?: number;
  params?: Partial<CoolingParams>;
  faults?: Partial<CoolingFaults>;
}

const OWNER = 'cooling';
const PUBLISHES = ['engine.coolantTemp', 'cooling.boiling'] as const;

const COOLANT = {
  pipeClass: 'fluid-coolant',
  flowClass: 'p-coolant',
  potentialRange: [40, 110] as const,
  width: 9,
  radius: 3,
  // El caudal real (miles de L/h) es mucho mayor que el de referencia de
  // `PX_PER_LH` (100 L/h → 250 px/s, calibrado para combustible): sin este
  // `scale` las partículas viajan a miles de px/s y no se ven fluir.
  scale: 0.15,
} as const;

function num(value: ParamValue | undefined, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function links(): CircuitLinkDef[] {
  return [
    // ─── Hidráulica (plan V1: puntas desde la geometría, codos en `via`) ───
    { id: 'h-pump-node1', from: 'waterPump.out', to: 'hN1.a', visual: { ...COOLANT, owner: 'waterPump' } },
    { id: 'h-node1-jacket', from: 'hN1.b', to: 'engineBlock.a', visual: { ...COOLANT, owner: 'engineBlock' } },
    { id: 'h-leak-pump', from: 'pumpLeak.a', to: 'hN1.c' },
    { id: 'h-jacket-node2', from: 'engineBlock.b', to: 'hN2.a', via: [[380, 195]], visual: { ...COOLANT, owner: 'engineBlock' } },
    { id: 'h-node2-thermostat', from: 'hN2.b', to: 'thermostat.a', visual: { ...COOLANT, owner: 'thermostat' } },
    { id: 'h-node2-bypass', from: 'bypass.a', to: 'hN2.c', visual: { ...COOLANT, owner: 'bypass' } },
    { id: 'h-node2-heater', from: 'hN2.d', to: 'heaterValve.a', via: [[700, 195], [700, 500]], visual: { ...COOLANT, owner: 'heaterValve' } },
    { id: 'h-thermostat-node3', from: 'thermostat.b', to: 'hN3.a', visual: { ...COOLANT, owner: 'upperHose' } },
    { id: 'h-node3-radiator', from: 'hN3.b', to: 'radiator.a', visual: { ...COOLANT, owner: 'upperHose' } },
    { id: 'h-radiator-node4', from: 'radiator.b', to: 'hN4.a', via: [[1105, 620]], visual: { ...COOLANT, owner: 'lowerHose' } },
    { id: 'h-node4-pump', from: 'hN4.b', to: 'waterPump.in', via: [[60, 620], [60, 390]], visual: { ...COOLANT, owner: 'lowerHose' } },
    { id: 'h-bypass-node4', from: 'bypass.b', to: 'hN4.c', visual: { ...COOLANT, owner: 'bypass' } },
    { id: 'h-core-node4', from: 'heaterCore.b', to: 'hN4.d', via: [[600, 620]], visual: { ...COOLANT, owner: 'heaterCore' } },
    { id: 'h-leak-hose', from: 'hoseLeak.a', to: 'hN4.e' },
    { id: 'h-tank-node4', from: 'expansionTank.a', to: 'hN4.f', via: [[330, 620]], visual: { ...COOLANT, owner: 'expansionTank' } },
    { id: 'h-heater-core', from: 'heaterValve.b', to: 'heaterCore.a', visual: { ...COOLANT, owner: 'heaterCore' } },
    // ─── Térmica (topología sin dibujo) ───────────────────────────────────
    { id: 't-engine-cap', from: 'tEngine.a', to: 'engineThermal.a' },
    { id: 't-engine2', from: 'tEngine2.a', to: 'tEngine.a' },
    { id: 't-engine-heat', from: 'tEngine.b', to: 'heat.a' },
    { id: 't-engine-loss', from: 'tEngine.c', to: 'engineLoss.a' },
    { id: 't-engine-adv-er', from: 'tEngine.d', to: 'advEngineRadiator.a' },
    { id: 't-engine-adv-eh', from: 'tEngine.e', to: 'advEngineHeater.a' },
    { id: 't-engine-adv-re', from: 'tEngine.f', to: 'advRadiatorEngine.b' },
    { id: 't-engine-adv-he', from: 'tEngine2.b', to: 'advHeaterEngine.b' },
    { id: 't-rad-cap', from: 'tRadiator.a', to: 'radiatorMass.a' },
    { id: 't-rad-loss', from: 'tRadiator.b', to: 'radiatorLoss.a' },
    { id: 't-rad-adv-er', from: 'tRadiator.c', to: 'advEngineRadiator.b' },
    { id: 't-rad-adv-re', from: 'tRadiator.d', to: 'advRadiatorEngine.a' },
    { id: 't-hea-cap', from: 'tHeater.a', to: 'heaterMass.a' },
    { id: 't-hea-cabin', from: 'tHeater.b', to: 'cabinHeater.a' },
    { id: 't-hea-adv-eh', from: 'tHeater.c', to: 'advEngineHeater.b' },
    { id: 't-hea-adv-he', from: 'tHeater.d', to: 'advHeaterEngine.a' },
    { id: 't-amb-src', from: 'tAmbient.a', to: 'ambient.a' },
    { id: 't-amb-loss', from: 'tAmbient.b', to: 'engineLoss.b' },
    { id: 't-amb-rad', from: 'tAmbient.c', to: 'radiatorLoss.b' },
    { id: 't-amb-cabin', from: 'tAmbient.d', to: 'cabinHeater.b' },
  ];
}

const THERMAL_PARTS = [
  { id: 'tEngine', type: 'thermalNode', x: 0, y: 0 },
  { id: 'tEngine2', type: 'thermalNode', x: 0, y: 0 },
  { id: 'tRadiator', type: 'thermalNode', x: 0, y: 0 },
  { id: 'tHeater', type: 'thermalNode', x: 0, y: 0 },
  { id: 'tAmbient', type: 'thermalNode', x: 0, y: 0 },
  { id: 'engineThermal', type: 'heatCapacity', x: 0, y: 0, params: { c: K.cEngine } },
  { id: 'radiatorMass', type: 'heatCapacity', x: 0, y: 0, params: { c: K.cRadiator } },
  { id: 'heaterMass', type: 'heatCapacity', x: 0, y: 0, params: { c: K.cHeater } },
  { id: 'heat', type: 'heatSource', x: 0, y: 0 },
  { id: 'ambient', type: 'temperatureSource', x: 0, y: 0 },
  { id: 'engineLoss', type: 'thermalConductance', x: 0, y: 0 },
  { id: 'radiatorLoss', type: 'thermalConductance', x: 0, y: 0 },
  { id: 'cabinHeater', type: 'thermalConductance', x: 0, y: 0 },
  { id: 'advEngineRadiator', type: 'advection', x: 0, y: 0 },
  { id: 'advRadiatorEngine', type: 'advection', x: 0, y: 0 },
  { id: 'advEngineHeater', type: 'advection', x: 0, y: 0 },
  { id: 'advHeaterEngine', type: 'advection', x: 0, y: 0 },
] as const;

const HYDRAULIC_PARTS = [
  { id: 'hN1', type: 'hydroNode', x: 168, y: 390 },
  { id: 'hN2', type: 'hydroNode', x: 440, y: 195 },
  { id: 'hN3', type: 'hydroNode', x: 520, y: 135 },
  { id: 'hN4', type: 'hydroNode', x: 440, y: 620 },
  { id: 'waterPump', type: 'centrifugalPump', visual: 'waterPump', x: 60, y: 350, params: { qMax: K.qPumpMax, pMax: K.pPumpMax, nRef: K.pumpNRef } },
  { id: 'engineBlock', type: 'restrictor', visual: 'engineJacket', x: 180, y: 220, params: { k: K.kJacket, clogFactor: 0 } },
  { id: 'thermostat', type: 'variableOrifice', visual: 'thermostat', x: 400, y: 100, params: { gOpen: K.gThermostatOpen, gLeak: K.gThermostatOpen * K.thermostatLeak } },
  { id: 'radiator', type: 'restrictor', visual: 'radiator', x: 1060, y: 120, params: { k: K.kRadiator, clogFactor: K.tubeClogK } },
  { id: 'bypass', type: 'restrictor', visual: 'hosePoint', label: 'Bypass', x: 440, y: 300, params: { k: K.kBypass, clogFactor: 0 } },
  { id: 'heaterValve', type: 'variableOrifice', x: 670, y: 500, params: { gOpen: K.gHeaterOpen, gLeak: 0 } },
  { id: 'heaterCore', type: 'restrictor', visual: 'heaterCore', x: 560, y: 460, params: { k: K.kHeaterCore, clogFactor: 0 } },
  { id: 'expansionTank', type: 'pressureSource', visual: 'expansionTank', x: 270, y: 470 },
  { id: 'pumpLeak', type: 'leak', x: 168, y: 390, params: { k: K.kPumpLeak } },
  { id: 'hoseLeak', type: 'leak', x: 440, y: 620, params: { k: K.kHoseLeak } },
  { id: 'tempGauge', type: 'visual', visual: 'tempGauge', x: 1120, y: 470 },
  { id: 'fan', type: 'visual', visual: 'fan', x: 780, y: 140 },
] as const;

/** `CircuitDef` de la refrigeración; la variante eléctrica suma el ventilador. */
export function coolingDef(variant: CoolingVariant): CircuitDef {
  const electric = VARIANTS[variant].electricFan;
  const parts = [
    ...HYDRAULIC_PARTS,
    ...THERMAL_PARTS,
    ...(electric
      ? ([
          { id: 'battery', type: 'battery', visual: 'battery', x: 40, y: 60, params: { r: 0.01 } },
          // Fusible, relé y motor los dibuja el ventilador (sub-piezas, plan V1).
          { id: 'fuse', type: 'resistor', x: 767, y: 346, params: { r: 0.02 } },
          { id: 'fanRelay', type: 'switch', x: 832, y: 346, params: { rOn: 0.001, rOff: 1e7 } },
          { id: 'fanMotor', type: 'resistor', x: 913, y: 346, params: { r: K.fanMotorR } },
        ] as const)
      : []),
  ];
  const electricLinks: CircuitLinkDef[] = electric
    ? [
        { id: 'e-bat-fuse', from: 'battery.+', to: 'fuse.a', via: [[99, 30], [730, 30], [730, 346]], visual: { pipeClass: 'fluid-electric', flowClass: 'p-electric', scale: 60, spacing: 10, radius: 2, width: 3, owner: 'battery' } },
        { id: 'e-fuse-relay', from: 'fuse.b', to: 'fanRelay.a', visual: { pipeClass: 'fluid-electric', flowClass: 'p-electric', scale: 60, spacing: 10, radius: 2, width: 3 } },
        { id: 'e-relay-motor', from: 'fanRelay.b', to: 'fanMotor.a', visual: { pipeClass: 'fluid-electric', flowClass: 'p-electric', scale: 60, spacing: 10, radius: 2, width: 3 } },
        // Masa por la carrocería: el drawer del ventilador la dibuja junto al motor.
        { id: 'e-motor-gnd', from: 'fanMotor.b', to: 'battery.-' },
      ]
    : [];
  return {
    id: VARIANTS[variant].id,
    title: VARIANTS[variant].title,
    fluid: 'coolant',
    parts,
    links: [...links(), ...electricLinks],
    controllers: [
      { id: 'labBus', type: 'labBus' },
      { id: 'cooling', type: 'cooling' },
    ],
    probes: {
      qPump: { element: 'waterPump', probe: 'q' },
      qRadiator: { element: 'radiator', probe: 'q' },
      qBypass: { element: 'bypass', probe: 'q' },
      qHeater: { element: 'heaterCore', probe: 'q' },
      qPumpLeak: { element: 'pumpLeak', probe: 'q' },
      qHoseLeak: { element: 'hoseLeak', probe: 'q' },
      tEngine: { node: 'tEngine.a' },
      tRadiator: { node: 'tRadiator.a' },
      tHeater: { node: 'tHeater.a' },
      ...(electric ? { fanI: { element: 'fanMotor', probe: 'q' } } : {}),
    },
    params: DEFAULT_PARAMS,
    faults: DEFAULT_FAULTS,
    fixed: electric ? { 'battery.-': 0 } : {},
    initial: { 'tEngine.a': 25, 'tRadiator.a': 25, 'tHeater.a': 25 },
    // A15, plan del vehículo §8: este sistema nunca provee el bus `12v`, pero
    // declara `source` igual (por si algún día lo hiciera); `compileVehicle`
    // excluye `battery` (§3.1, §4 paso 3) y sus puertos quedan fundidos al
    // riel compartido. La variante viscosa no tiene batería: sin bus.
    ...(electric
      ? { buses: { '12v': { ports: ['battery.+'], source: 'battery' }, chassis: { ports: ['battery.-'] } } }
      : {}),
  };
}

interface CoolingBuild {
  circuit: CompiledCircuit<CoolingState>;
  params: CoolingParams;
  faults: CoolingFaults;
  state: CoolingState;
  bus: LabBus;
  controller: CoolingController | null;
}

function buildCooling(variant: CoolingVariant, overrides: CoolingOverrides = {}): CoolingBuild {
  const state = createInitialCoolingState();
  const params: CoolingParams = { ...DEFAULT_PARAMS, ...overrides.params };
  const faults: CoolingFaults = { ...DEFAULT_FAULTS, ...overrides.faults };
  const bus = createLabBus({
    owner: OWNER,
    publishes: PUBLISHES,
    stubs: createSignalStubs({
      'engine.rpm': (p) => num(p['rpm']),
      'engine.load': (p) => num(p['load']),
      'vehicle.speed': (p) => num(p['vehicleSpeedKmh']),
    }),
  });
  let circuit: CompiledCircuit<CoolingState> | null = null;
  let controller: CoolingController | null = null;
  const controllerTypes: Readonly<Record<string, ControllerFactory>> = {
    labBus: (id) => createLabBusController(id, bus),
    cooling: (id, controllerParams) => {
      controller = createCooling(id, controllerParams, {
        bus,
        variant,
        setPotential: (part, port, value): void => {
          const node = circuit?.portToNode[`${part}.${port}`];
          if (node !== undefined) circuit?.solver.setPotential(node, value);
        },
      });
      return controller;
    },
  };
  const actions: ModelActions = {
    topUp: (): void => {
      controller?.topUp();
    },
    setEngineTemp: (value: unknown): void => {
      const t = value === undefined ? 90 : Number(value) || 0;
      controller?.setEngineTemp(t);
    },
  };
  circuit = compileCircuit<CoolingState>({
    def: coolingDef(variant),
    types: ELEMENT_TYPES,
    controllerTypes,
    state,
    params,
    faults,
    actions,
    seed: overrides.seed ?? 12345,
  });
  return { circuit, params, faults, state, bus, controller };
}

export function compileCoolingCircuit(
  variant: CoolingVariant,
  overrides: CoolingOverrides = {},
): CompiledCircuit<CoolingState> {
  return buildCooling(variant, overrides).circuit;
}

export function createCoolingModel(
  variant: CoolingVariant,
  overrides: CoolingOverrides = {},
): CoolingModel {
  return createCoolingHarness(variant, overrides).model;
}

/** Modelo + controlador + bus (los tests usan las acciones y las señales). */
export function createCoolingHarness(
  variant: CoolingVariant,
  overrides: CoolingOverrides = {},
): { model: CoolingModel; bus: LabBus; controller: CoolingController } {
  const built = buildCooling(variant, overrides);
  if (!built.controller) throw new Error('invariante: falta el controlador cooling');
  const controller = built.controller;
  const model: CoolingModel = {
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
    },
  };
  return { model, bus: built.bus, controller };
}
