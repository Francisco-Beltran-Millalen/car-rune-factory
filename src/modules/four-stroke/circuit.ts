// Circuito del mecanismo de 4 tiempos (A11): `CircuitDef` sin elementos de red
// (sólo piezas `visual`) compilado con los controladores `labBus` + `fourStroke`.
// Puro (§1). Los dos descriptores salen de acá (spec §1).

import type { Model, ModelActions, ParamValue } from '../../core/types.ts';
import { compileCircuit } from '../../sim/circuit/compile.ts';
import type { CircuitDef, CompiledCircuit } from '../../sim/circuit/types.ts';
import type { ControllerFactory } from '../../sim/controllers/index.ts';
import { ELEMENT_TYPES } from '../../sim/elements/index.ts';
import { createLabBus, createLabBusController, type LabBus } from '../../sim/signals/bus.ts';
import { createSignalStubs } from '../../sim/signals/stubs.ts';
import { VARIANTS, type FourStrokeVariant } from './constants.ts';
import {
  DEFAULT_FAULTS,
  DEFAULT_PARAMS,
  createFourStroke,
  createInitialFourStrokeState,
  type FourStrokeController,
  type FourStrokeFaults,
  type FourStrokeParams,
  type FourStrokeState,
} from './mechanism.ts';

export type FourStrokeModel = Model<FourStrokeParams, FourStrokeFaults, FourStrokeState>;

export interface FourStrokeOverrides {
  seed?: number;
  params?: Partial<FourStrokeParams>;
  faults?: Partial<FourStrokeFaults>;
}

const OWNER = 'fourStroke';
const PHASE_SIGNALS = ['engine.crankAngle', 'engine.camAngle'] as const;
const PUBLISHES = [
  'engine.crankAngle',
  'engine.camAngle',
  'engine.compression',
  'engine.cylinderBalance',
] as const;

function num(value: ParamValue | undefined, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** `CircuitDef` del mecanismo: sólo piezas visuales, sin puertos ni enlaces. */
export function fourStrokeDef(variant: FourStrokeVariant): CircuitDef {
  const info = VARIANTS[variant];
  return {
    id: info.id,
    title: info.title,
    parts: [
      {
        id: 'cylinder',
        type: 'visual',
        visual: 'cylinderSection',
        x: 60,
        y: 40,
        params: { ohv: variant === 'ohv' ? 1 : 0 },
      },
      { id: 'timing', type: 'visual', visual: 'timingDrive', x: 600, y: 40 },
      { id: 'pv', type: 'visual', visual: 'pvDiagram', x: 1000, y: 60 },
      { id: 'compression', type: 'visual', visual: 'compressionBars', x: 1000, y: 460 },
    ],
    links: [],
    controllers: [
      { id: 'labBus', type: 'labBus' },
      { id: 'fourStroke', type: 'fourStroke' },
    ],
    params: DEFAULT_PARAMS,
    faults: DEFAULT_FAULTS,
  };
}

interface FourStrokeBuild {
  circuit: CompiledCircuit<FourStrokeState>;
  params: FourStrokeParams;
  faults: FourStrokeFaults;
  state: FourStrokeState;
  bus: LabBus;
}

function buildFourStroke(variant: FourStrokeVariant, overrides: FourStrokeOverrides = {}): FourStrokeBuild {
  const state = createInitialFourStrokeState();
  const params: FourStrokeParams = { ...DEFAULT_PARAMS, ...overrides.params };
  const faults: FourStrokeFaults = { ...DEFAULT_FAULTS, ...overrides.faults };
  const bus = createLabBus({
    owner: OWNER,
    publishes: PUBLISHES,
    sameStep: PHASE_SIGNALS,
    stubs: createSignalStubs({
      'engine.rpm': (p) => num(p['rpm']),
      'engine.load': (p) => num(p['throttle']),
      'intake.map': (p) => -0.65 + 0.65 * num(p['throttle']),
      'ignition.advance': (p) => num(p['sparkAdvance']),
      'ignition.spark': (p) => (p['spark'] === true ? 1 : 0),
      'lubrication.pressure': (p) => num(p['oilPressure']),
    }),
  });
  let mechanism: FourStrokeController | null = null;
  const controllerTypes: Readonly<Record<string, ControllerFactory>> = {
    labBus: (id) => createLabBusController(id, bus),
    fourStroke: (id, controllerParams) => {
      mechanism = createFourStroke(id, controllerParams, { bus, variant });
      return mechanism;
    },
  };
  const actions: ModelActions = {
    compressionTest: (): void => {
      mechanism?.compressionTest();
    },
  };
  const circuit = compileCircuit<FourStrokeState>({
    def: fourStrokeDef(variant),
    types: ELEMENT_TYPES,
    controllerTypes,
    state,
    params,
    faults,
    actions,
    seed: overrides.seed ?? 12345,
    onReset: () => {
      bus.reset();
    },
  });
  return { circuit, params, faults, state, bus };
}

/** El `CircuitDef` compilado, para los tests del mecanismo. */
export function compileFourStrokeCircuit(
  variant: FourStrokeVariant,
  overrides: FourStrokeOverrides = {},
): CompiledCircuit<FourStrokeState> {
  return buildFourStroke(variant, overrides).circuit;
}

/** Fábrica del modelo (misma forma que `createFuelModel`). */
export function createFourStrokeModel(
  variant: FourStrokeVariant,
  overrides: FourStrokeOverrides = {},
): FourStrokeModel {
  return createFourStrokeHarness(variant, overrides).model;
}

/** Modelo + bus del laboratorio (el bus lo usan los tests de señales §28). */
export function createFourStrokeHarness(
  variant: FourStrokeVariant,
  overrides: FourStrokeOverrides = {},
): { model: FourStrokeModel; bus: LabBus } {
  const { circuit, params, faults, state, bus } = buildFourStroke(variant, overrides);
  const model: FourStrokeModel = {
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
