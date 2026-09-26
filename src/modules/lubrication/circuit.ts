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
} as const;

function num(value: ParamValue | undefined, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function links(): CircuitLinkDef[] {
  return [
    { id: 'h-sump-pickup', from: 'sump.out', to: 'pickup.a', route: [[140, 520], [140, 500]] },
    { id: 'h-pickup-pump', from: 'pickup.b', to: 'oilPump.in', route: [[200, 500], [300, 500], [300, 470]], visual: { ...OIL, owner: 'pickup' } },
    { id: 'h-pump-node', from: 'oilPump.out', to: 'nPressure.a', route: [[360, 420], [470, 420]], visual: { ...OIL, owner: 'oilPump' } },
    { id: 'h-node-relief', from: 'nPressure.b', to: 'reliefValve.in', route: [[470, 420], [520, 420]], visual: { ...OIL } },
    { id: 'h-node-filter', from: 'nPressure.c', to: 'oilFilter.a', route: [[470, 420], [620, 420], [620, 380]], visual: { ...OIL, owner: 'oilFilter' } },
    { id: 'h-node-bypass', from: 'nPressure.d', to: 'filterBypass.in', route: [[470, 420], [660, 420], [660, 330]] },
    { id: 'h-filter-gallery', from: 'oilFilter.b', to: 'nGallery1.a', route: [[620, 300], [620, 200]], visual: { ...OIL, owner: 'oilFilter' } },
    { id: 'h-bypass-ret', from: 'filterBypass.ret', to: 'nGallery1.b', route: [[680, 300], [680, 240], [620, 240], [620, 200]] },
    { id: 'h-bypass-ref', from: 'filterBypass.ref', to: 'nGallery1.c', route: [[700, 330], [700, 220], [640, 220], [640, 200]] },
    { id: 'h-gallery-volume', from: 'mainGallery.a', to: 'nGallery1.d', route: [[560, 180], [560, 200], [620, 200]], visual: { ...OIL, owner: 'mainGallery' } },
    { id: 'h-gallery-main', from: 'mainBearings.a', to: 'nGallery1.e', route: [[460, 140], [460, 200], [620, 200]], visual: { ...OIL, owner: 'mainBearings' } },
    { id: 'h-gallery-rod', from: 'rodBearings.a', to: 'nGallery1.f', route: [[560, 140], [560, 200], [620, 200]], visual: { ...OIL, owner: 'rodBearings' } },
    { id: 'h-gallery-cam', from: 'camBearings.a', to: 'nGallery2.a', route: [[660, 140], [660, 180], [700, 180], [700, 200]], visual: { ...OIL, owner: 'camBearings' } },
    { id: 'h-gallery-leak', from: 'filterLeak.a', to: 'nGallery2.b', route: [[760, 200], [700, 200]] },
    { id: 'h-gallery-join', from: 'nGallery2.c', to: 'nGallery1.a' },
    { id: 'h-return-relief', from: 'reliefValve.ret', to: 'nReturn.a', route: [[560, 470], [560, 640], [300, 640]], visual: { ...OIL, owner: 'reliefValve' } },
    { id: 'h-return-ref', from: 'reliefValve.ref', to: 'nReturn.b', route: [[600, 470], [600, 660], [300, 660]] },
    { id: 'h-return-main', from: 'mainBearings.b', to: 'nReturn.c', route: [[400, 160], [400, 640], [300, 640]], visual: { ...OIL, owner: 'mainBearings' } },
    { id: 'h-return-rod', from: 'rodBearings.b', to: 'nReturn.d', route: [[500, 160], [500, 620], [300, 620]] },
    { id: 'h-return-cam', from: 'camBearings.b', to: 'nReturn.e', route: [[660, 220], [660, 600], [300, 600]] },
    { id: 'h-return-sump', from: 'nReturn.f', to: 'sump.ret', route: [[300, 640], [300, 560], [380, 560]] },
    { id: 'e-bat-key', from: 'battery.+', to: 'key.a', route: [[980, 70], [1060, 70]], visual: { pipeClass: 'fluid-electric', flowClass: 'p-electric', scale: 60, spacing: 10, radius: 2, width: 3, owner: 'battery' } },
    { id: 'e-key-lamp', from: 'key.b', to: 'warningLamp.a', route: [[1140, 70], [1140, 100], [920, 100]], visual: { pipeClass: 'fluid-electric', flowClass: 'p-electric', scale: 60, spacing: 10, radius: 2, width: 3 } },
    { id: 'e-lamp-switch', from: 'warningLamp.b', to: 'pressureSwitch.a', route: [[920, 140], [920, 180], [880, 180]] },
    { id: 'e-switch-gnd', from: 'pressureSwitch.b', to: 'battery.-', route: [[860, 180], [860, 220], [940, 220], [940, 100]] },
  ];
}

export function lubricationDef(variant: LubricationVariant): CircuitDef {
  const hasGauge = VARIANTS[variant].hasGauge;
  return {
    id: VARIANTS[variant].id,
    title: VARIANTS[variant].title,
    fluid: 'oil',
    parts: [
      { id: 'sump', type: 'tank', visual: 'sump', x: 60, y: 480, params: { capacity: K.sumpCapacity, pickupLow: 1 } },
      { id: 'pickup', type: 'restrictor', x: 140, y: 500, params: { k: K.kPickup, clogFactor: K.pickupClogFactor } },
      {
        id: 'oilPump',
        type: 'displacementPump',
        visual: 'gearPump',
        x: 300,
        y: 400,
        params: { disp: K.disp, slip: K.slip, pMax: 0, wearQ: 0.5 },
      },
      {
        id: 'reliefValve',
        type: 'reliefRegulator',
        visual: 'reliefValve',
        x: 520,
        y: 400,
        params: { k: K.kRelief, set: K.reliefSet, smooth: K.reliefSmooth },
      },
      { id: 'oilFilter', type: 'restrictor', visual: 'oilFilter', x: 620, y: 300, params: { k: K.kFilter, clogFactor: K.filterClogFactor } },
      {
        id: 'filterBypass',
        type: 'reliefRegulator',
        x: 660,
        y: 300,
        params: { k: K.kRelief, set: K.bypassSet, smooth: K.reliefSmooth },
      },
      { id: 'mainGallery', type: 'volume', visual: 'gallery', x: 500, y: 140, params: { c: K.cGallery } },
      { id: 'mainBearings', type: 'linearRestrictor', visual: 'bearing', x: 420, y: 120 },
      { id: 'rodBearings', type: 'linearRestrictor', visual: 'bearing', x: 520, y: 120 },
      { id: 'camBearings', type: 'linearRestrictor', visual: 'bearing', x: 620, y: 120 },
      { id: 'filterLeak', type: 'leak', x: 760, y: 200, params: { k: K.kGasketLeak } },
      { id: 'nPressure', type: 'hydroNode', x: 470, y: 420 },
      { id: 'nGallery1', type: 'hydroNode', x: 620, y: 200 },
      { id: 'nGallery2', type: 'hydroNode', x: 700, y: 200 },
      { id: 'nReturn', type: 'hydroNode', x: 300, y: 640 },
      { id: 'warningLamp', type: 'resistor', visual: 'warningLamp', x: 880, y: 100, params: { r: K.lampR } },
      { id: 'pressureSwitch', type: 'switch', x: 880, y: 180, params: { rOn: 0.001, rOff: 1e7 } },
      { id: 'battery', type: 'battery', visual: 'battery', x: 900, y: 40, params: { r: 0.01 } },
      { id: 'key', type: 'switch', visual: 'key', x: 1060, y: 40, params: { rOn: 0.001, rOff: 1e7 } },
      ...(hasGauge ? ([{ id: 'oilGauge', type: 'visual', visual: 'oilGauge', x: 960, y: 300 }] as const) : []),
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
