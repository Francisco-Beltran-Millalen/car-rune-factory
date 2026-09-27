// Circuito de la lubricación (A14): red de aceite + eléctrica del testigo.
// Puro (§1). Dos descriptores del mismo código (spec lubrication §1).

import type { Model, ModelActions, ParamValue } from '../../core/types.ts';
import { compileCircuit } from '../../sim/circuit/compile.ts';
import type { CircuitDef, CircuitLinkDef, CompiledCircuit } from '../../sim/circuit/types.ts';
import type { ControllerFactory } from '../../sim/controllers/index.ts';
import { ELEMENT_TYPES } from '../../sim/elements/index.ts';
import { createLabBus, createLabBusController, type LabBus } from '../../sim/signals/bus.ts';
import { createSignalStubs } from '../../sim/signals/stubs.ts';
import { K, VARIANTS, type LubricationVariant } from './constants.ts';
import {
  DEFAULT_FAULTS,
  DEFAULT_PARAMS,
  createInitialLubricationState,
  createLubrication,
  type LubricationController,
  type LubricationFaults,
  type LubricationParams,
  type LubricationState,
} from './controllers.ts';

export type LubricationModel = Model<LubricationParams, LubricationFaults, LubricationState>;

export interface LubricationOverrides {
  seed?: number;
  level?: number;
  params?: Partial<LubricationParams>;
  faults?: Partial<LubricationFaults>;
}

const OWNER = 'lubrication';
const PUBLISHES = ['lubrication.pressure', 'lubrication.seized', 'lubrication.viscosity'] as const;

const OIL = {
  pipeClass: 'fluid-oil',
  flowClass: 'p-oil',
  width: 8,
  radius: 3,
  // El caudal real (cientos de L/h) es mucho mayor que el de referencia de
  // `PX_PER_LH` (100 L/h → 250 px/s, calibrado para combustible): sin este
  // `scale` las partículas viajan a miles de px/s y no se ven fluir.
  scale: 0.3,
} as const;

function num(value: ParamValue | undefined, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

const WIRE = { pipeClass: 'fluid-electric', flowClass: 'p-electric', scale: 60, spacing: 10, radius: 2, width: 3 } as const;

// Plan V1: las puntas salen de la geometría de los drawers; aquí sólo los
// codos (`via`). Los enlaces sin `visual` son sólo del modelo.
function links(): CircuitLinkDef[] {
  return [
    { id: 'h-sump-pickup', from: 'sump.out', to: 'pickup.a' },
    { id: 'h-pickup-pump', from: 'pickup.b', to: 'oilPump.in', visual: { ...OIL, owner: 'pickup' } },
    { id: 'h-pump-node', from: 'oilPump.out', to: 'nPressure.a', visual: { ...OIL, owner: 'oilPump' } },
    { id: 'h-node-relief', from: 'nPressure.b', to: 'reliefValve.in', visual: { ...OIL, owner: 'reliefValve' } },
    { id: 'h-node-filter', from: 'nPressure.c', to: 'oilFilter.a', visual: { ...OIL, owner: 'oilFilter' } },
    { id: 'h-node-bypass', from: 'nPressure.d', to: 'filterBypass.in', via: [[250, 350], [175, 350]], visual: { ...OIL, owner: 'filterBypass' } },
    { id: 'h-filter-gallery', from: 'oilFilter.b', to: 'nGallery1.a', visual: { ...OIL, owner: 'oilFilter' } },
    { id: 'h-bypass-ret', from: 'filterBypass.ret', to: 'nGallery1.b', via: [[175, 160]], visual: { ...OIL, owner: 'filterBypass' } },
    { id: 'h-bypass-ref', from: 'filterBypass.ref', to: 'nGallery1.c' },
    { id: 'h-gallery-volume', from: 'mainGallery.a', to: 'nGallery1.d', visual: { ...OIL, owner: 'mainGallery' } },
    { id: 'h-gallery-main', from: 'mainBearings.a', to: 'nGallery1.e', via: [[480, 160]], visual: { ...OIL, owner: 'mainBearings' } },
    { id: 'h-gallery-rod', from: 'rodBearings.a', to: 'nGallery1.f', via: [[580, 160]], visual: { ...OIL, owner: 'rodBearings' } },
    { id: 'h-gallery-cam', from: 'camBearings.a', to: 'nGallery2.a', via: [[680, 160]], visual: { ...OIL, owner: 'camBearings' } },
    { id: 'h-gallery-leak', from: 'filterLeak.a', to: 'nGallery2.b' },
    { id: 'h-gallery-join', from: 'nGallery2.c', to: 'nGallery1.a' },
    { id: 'h-return-relief', from: 'reliefValve.ret', to: 'nReturn.a', via: [[335, 520]], visual: { ...OIL, owner: 'reliefValve' } },
    { id: 'h-return-ref', from: 'reliefValve.ref', to: 'nReturn.b' },
    { id: 'h-return-main', from: 'mainBearings.b', to: 'nReturn.c', via: [[480, 520]], visual: { ...OIL, owner: 'mainBearings' } },
    { id: 'h-return-rod', from: 'rodBearings.b', to: 'nReturn.d', via: [[580, 520]], visual: { ...OIL, owner: 'rodBearings' } },
    { id: 'h-return-cam', from: 'camBearings.b', to: 'nReturn.e', via: [[680, 520]], visual: { ...OIL, owner: 'camBearings' } },
    { id: 'h-return-sump', from: 'nReturn.f', to: 'sump.ret', visual: { ...OIL, owner: 'sump' } },
    { id: 'e-bat-key', from: 'battery.+', to: 'key.a', via: [[859, 20], [900, 20], [900, 70]], visual: { ...WIRE, owner: 'battery' } },
    { id: 'e-key-lamp', from: 'key.b', to: 'warningLamp.a', visual: WIRE },
    { id: 'e-lamp-switch', from: 'warningLamp.b', to: 'pressureSwitch.a', via: [[1080, 120], [696, 120]], visual: { ...WIRE, owner: 'pressureSwitch' } },
    // El interruptor va a masa por el bloque (lo dibuja su drawer).
    { id: 'e-switch-gnd', from: 'pressureSwitch.b', to: 'battery.-' },
  ];
}

export function lubricationDef(variant: LubricationVariant): CircuitDef {
  const hasGauge = VARIANTS[variant].hasGauge;
  return {
    id: VARIANTS[variant].id,
    title: VARIANTS[variant].title,
    fluid: 'oil',
    parts: [
      { id: 'sump', type: 'tank', visual: 'sump', x: 60, y: 540, params: { capacity: K.sumpCapacity, pickupLow: 1 } },
      // La rejilla la dibuja el cárter; el bypass y el antirretorno, el filtro (plan V1).
      { id: 'pickup', type: 'restrictor', x: 140, y: 600, params: { k: K.kPickup, clogFactor: K.pickupClogFactor } },
      { id: 'oilPump', type: 'displacementPump', visual: 'gearPump', x: 80, y: 380, params: { disp: K.disp, slip: K.slip, pMax: 0, wearQ: 0.5 } },
      { id: 'reliefValve', type: 'reliefRegulator', visual: 'reliefValve', x: 290, y: 380, params: { k: K.kRelief, set: K.reliefSet, smooth: K.reliefSmooth } },
      { id: 'oilFilter', type: 'restrictor', visual: 'oilFilter', x: 205, y: 190, params: { k: K.kFilter, clogFactor: K.filterClogFactor } },
      { id: 'filterBypass', type: 'reliefRegulator', x: 175, y: 255, params: { k: K.kRelief, set: K.bypassSet, smooth: K.reliefSmooth } },
      { id: 'mainGallery', type: 'volume', visual: 'gallery', x: 420, y: 143, params: { c: K.cGallery } },
      { id: 'mainBearings', type: 'linearRestrictor', visual: 'bearing', label: 'Bancada', x: 450, y: 230 },
      { id: 'rodBearings', type: 'linearRestrictor', visual: 'bearing', label: 'Bielas', x: 550, y: 230 },
      { id: 'camBearings', type: 'linearRestrictor', visual: 'bearing', label: 'Árbol de levas', x: 650, y: 230 },
      { id: 'filterLeak', type: 'leak', x: 670, y: 160, params: { k: K.kGasketLeak } },
      { id: 'nPressure', type: 'hydroNode', x: 250, y: 430 },
      { id: 'nGallery1', type: 'hydroNode', x: 250, y: 160 },
      { id: 'nGallery2', type: 'hydroNode', x: 670, y: 160, joinedBy: 'mainGallery' },
      { id: 'nReturn', type: 'hydroNode', x: 460, y: 520 },
      { id: 'pressureSwitch', type: 'switch', visual: 'oilPressureSwitch', x: 682, y: 146, joinedBy: 'mainGallery', params: { rOn: 0.001, rOff: 1e7 } },
      { id: 'battery', type: 'battery', visual: 'battery', x: 800, y: 40, params: { r: 0.01 } },
      { id: 'key', type: 'switch', visual: 'key', x: 920, y: 40, params: { rOn: 0.001, rOff: 1e7 } },
      { id: 'warningLamp', type: 'resistor', visual: 'warningLamp', x: 1060, y: 50, params: { r: K.lampR } },
      ...(hasGauge ? ([{ id: 'oilGauge', type: 'visual', visual: 'oilGauge', x: 960, y: 150 }] as const) : []),
    ],
    links: links(),
    controllers: [
      { id: 'labBus', type: 'labBus' },
      { id: 'lubrication', type: 'lubrication' },
    ],
    probes: {
      pGallery: { node: 'nGallery1.a' },
      pPumpOut: { node: 'nPressure.a' },
      pSuction: { node: 'oilPump.in' },
      pFilterIn: { node: 'nPressure.a' },
      pFilterOut: { node: 'nGallery1.a' },
      qPump: { element: 'oilPump', probe: 'q' },
      qRelief: { element: 'reliefValve', probe: 'q' },
      qBypass: { element: 'filterBypass', probe: 'q' },
      qMain: { element: 'mainBearings', probe: 'q' },
      qRod: { element: 'rodBearings', probe: 'q' },
      qCam: { element: 'camBearings', probe: 'q' },
      qFilter: { element: 'oilFilter', probe: 'q' },
      level: { element: 'sump', probe: 'level' },
      lampI: { element: 'warningLamp', probe: 'q' },
    },
    params: DEFAULT_PARAMS,
    faults: DEFAULT_FAULTS,
    fixed: { 'battery.-': 0 },
  };
}

interface LubricationBuild {
  circuit: CompiledCircuit<LubricationState>;
  params: LubricationParams;
  faults: LubricationFaults;
  state: LubricationState;
  bus: LabBus;
}

function buildLubrication(
  variant: LubricationVariant,
  overrides: LubricationOverrides = {},
): LubricationBuild {
  const state = createInitialLubricationState();
  const params: LubricationParams = { ...DEFAULT_PARAMS, ...overrides.params };
  const faults: LubricationFaults = { ...DEFAULT_FAULTS, ...overrides.faults };
  state.level = overrides.level ?? K.levelFull;
  const bus = createLabBus({
    owner: OWNER,
    publishes: PUBLISHES,
    // Stub del motor (§29): gira sólo con la llave en marcha; la carga del
    // laboratorio sigue a las rpm (no hay acelerador), para el golpeteo §5.5.
    stubs: createSignalStubs({
      'engine.rpm': (p) => (p['ignitionKey'] === 'run' ? Math.max(0, num(p['rpm'])) : 0),
      'engine.load': (p) => Math.min(1, Math.max(0, num(p['rpm']) / K.maxRpm)),
    }),
  });
  let controller: LubricationController | null = null;
  const controllerTypes: Readonly<Record<string, ControllerFactory>> = {
    labBus: (id) => createLabBusController(id, bus),
    lubrication: (id, controllerParams) => {
      controller = createLubrication(id, controllerParams, { bus, variant });
      return controller;
    },
  };
  const actions: ModelActions = {
    setOilLevel: (liters: unknown): void => {
      controller?.setOilLevel(typeof liters === 'number' ? liters : Number(liters) || 0);
    },
    changeOil: (): void => {
      controller?.changeOil();
    },
  };
  const circuit = compileCircuit<LubricationState>({
    def: lubricationDef(variant),
    types: ELEMENT_TYPES,
    controllerTypes,
    state,
    params,
    faults,
    actions,
    init: { tankLevel: state.level },
    seed: overrides.seed ?? 12345,
  });
  return { circuit, params, faults, state, bus };
}

export function compileLubricationCircuit(
  variant: LubricationVariant,
  overrides: LubricationOverrides = {},
): CompiledCircuit<LubricationState> {
  return buildLubrication(variant, overrides).circuit;
}

export function createLubricationModel(
  variant: LubricationVariant,
  overrides: LubricationOverrides = {},
): LubricationModel {
  return createLubricationHarness(variant, overrides).model;
}

/** Modelo + bus (tests y señales §28). */
export function createLubricationHarness(
  variant: LubricationVariant,
  overrides: LubricationOverrides = {},
): { model: LubricationModel; bus: LabBus } {
  const built = buildLubrication(variant, overrides);
  const model: LubricationModel = {
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
  return { model, bus: built.bus };
}
