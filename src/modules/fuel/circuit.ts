// El sistema de combustible sobre el solver (A6): `CircuitDef` + compilado con
// paridad con el modelo de referencia. Puro (§1). Los ids de las piezas son los
// del contenido (`content.ts`) para que el laboratorio y el quiz sigan igual.

import { clamp } from '../../core/math.ts';
import type { ModelActions } from '../../core/types.ts';
import { compileCircuit } from '../../sim/circuit/compile.ts';
import type { CircuitBinding, CircuitDef, CompiledCircuit } from '../../sim/circuit/types.ts';
import type { ControllerFactory } from '../../sim/controllers/index.ts';
import { createEngineCore } from '../../sim/controllers/engineCore.ts';
import { ELEMENT_TYPES } from '../../sim/elements/index.ts';
import { createAlternator, createEcuFuel, createFuelSupply, type FuelSignals } from './controllers.ts';
import {
  DEFAULT_FAULTS,
  DEFAULT_PARAMS,
  K,
  createInitialFuelState,
  type FuelFaults,
  type FuelModel,
  type FuelOverrides,
  type FuelParams,
  type FuelState,
} from './reference-model.ts';

const KINJ = K.injFlow3bar / Math.sqrt(3);

/**
 * Circuito del combustible. El colador va en la aspiración (entre el tanque y
 * la bomba), como pide P25 §3.3. No lleva `checkValve`: la guarda V < 0,5 V
 * de la bomba ya impide el retroceso y una válvula en serie rompería la
 * paridad por su transición de 0,02 bar (se anota en el CERRADO).
 * Las resistencias parásitas (batería, llave, relé) son chicas para que la
 * tensión de la bomba quede a menos de 0,05 V de la referencia (P23 §8.2).
 */
const FUEL_DEF: CircuitDef = {
  id: 'fuel-return',
  title: 'Sistema de combustible',
  fluid: 'fuel',
  parts: [
    { id: 'battery', type: 'battery', x: 90, y: 90, params: { r: 0.001 } },
    { id: 'key', type: 'switch', x: 190, y: 70, params: { rOn: 0.001, rOff: 1e7 } },
    { id: 'relay', type: 'switch', x: 280, y: 80, params: { rOn: 0.001, rOff: 1e7 } },
    { id: 'tank', type: 'tank', x: 220, y: 600, params: { capacity: 50, pickupLow: 1 } },
    { id: 'strainer', type: 'restrictor', x: 180, y: 620, params: { k: K.kStrainer0, clogFactor: 150 } },
    {
      id: 'pump',
      type: 'electricPump',
      x: 220, y: 540,
      params: {
        qMax: K.Qmax0,
        pMax: K.Pmax0,
        vNominal: K.vNominal,
        wearQ: 0.7,
        wearP: 0.5,
        epsP: 0.01,
        windingR: 1,
      },
    },
    { id: 'feedLine', type: 'restrictor', x: 390, y: 330, params: { k: K.kLine0, clogFactor: 0 } },
    { id: 'lineLeak', type: 'leak', x: 390, y: 380, params: { k: 2 } },
    { id: 'filter', type: 'restrictor', x: 560, y: 200, params: { k: K.kFilter0, clogFactor: 1000 } },
    { id: 'rail', type: 'volume', x: 860, y: 110, params: { c: K.C } },
    { id: 'railNode', type: 'tee', x: 900, y: 140 },
    { id: 'injector1', type: 'orifice', x: 760, y: 170, params: { k: KINJ, leakCoeff: 0.6 } },
    { id: 'injector2', type: 'orifice', x: 860, y: 170, params: { k: KINJ, leakCoeff: 0.6 } },
    { id: 'injector3', type: 'orifice', x: 960, y: 170, params: { k: KINJ, leakCoeff: 0.6 } },
    { id: 'injector4', type: 'orifice', x: 1060, y: 170, params: { k: KINJ, leakCoeff: 0.6 } },
    { id: 'manifold', type: 'pressureSource', x: 900, y: 300 },
    { id: 'manifoldNode', type: 'tee', x: 900, y: 320 },
    { id: 'regulator', type: 'reliefRegulator', x: 1140, y: 130, params: { k: K.kReg, set: K.regSet, smooth: 0.01 } },
    { id: 'vacuumHose', type: 'pressureSource', x: 1050, y: 240 },
  ],
  links: [
    { id: 'e-bat-key', from: 'battery.+', to: 'key.a' },
    { id: 'e-key-relay', from: 'key.b', to: 'relay.a' },
    { id: 'e-relay-pump', from: 'relay.b', to: 'pump.e+' },
    { id: 'e-pump-gnd', from: 'pump.e-', to: 'battery.-' },
    { id: 'h-tank-strainer', from: 'tank.out', to: 'strainer.a' },
    { id: 'h-strainer-pump', from: 'strainer.b', to: 'pump.in' },
    { id: 'h-pump-line', from: 'pump.out', to: 'feedLine.a' },
    { id: 'h-line-filter', from: 'feedLine.b', to: 'filter.a' },
    { id: 'h-filter-rail', from: 'filter.b', to: 'railNode.a' },
    { id: 'h-rail-volume', from: 'rail.a', to: 'railNode.b' },
    { id: 'h-rail-i1', from: 'railNode.a', to: 'injector1.in' },
    { id: 'h-rail-i2', from: 'railNode.b', to: 'injector2.in' },
    { id: 'h-rail-i3', from: 'railNode.c', to: 'injector3.in' },
    { id: 'h-rail-i4', from: 'railNode.a', to: 'injector4.in' },
    { id: 'h-rail-leak', from: 'railNode.c', to: 'lineLeak.a' },
    { id: 'h-rail-reg', from: 'railNode.b', to: 'regulator.in' },
    { id: 'h-reg-ret', from: 'regulator.ret', to: 'tank.ret' },
    { id: 'h-reg-ref', from: 'regulator.ref', to: 'vacuumHose.a' },
    { id: 'h-inj1-man', from: 'injector1.out', to: 'manifoldNode.a' },
    { id: 'h-inj2-man', from: 'injector2.out', to: 'manifoldNode.b' },
    { id: 'h-inj3-man', from: 'injector3.out', to: 'manifoldNode.a' },
    { id: 'h-inj4-man', from: 'injector4.out', to: 'manifoldNode.b' },
    { id: 'h-man-src', from: 'manifold.a', to: 'manifoldNode.c' },
  ],
  controllers: [
    { id: 'engineCore', type: 'engineCore' },
    { id: 'ecuFuel', type: 'ecuFuel' },
    { id: 'alternator', type: 'alternator' },
    { id: 'fuelSupply', type: 'fuelSupply' },
  ],
  probes: {
    pRail: { node: 'railNode.a' },
    pPumpOut: { node: 'pump.out' },
    pumpV: { node: 'pump.e+' },
    qPump: { element: 'pump', probe: 'q' },
    pumpCurrent: { element: 'pump', probe: 'i' },
    tankLevel: { element: 'tank', probe: 'level' },
    pickupAir: { element: 'tank', probe: 'pickupAir' },
    pFilterIn: { node: 'filter.a' },
    pFilterOut: { node: 'filter.b' },
  },
  params: DEFAULT_PARAMS,
  faults: DEFAULT_FAULTS,
  fixed: { 'battery.-': 0 },
};

/** Fallas planas → `control` del elemento (P25 §3.1). Los enums van por ECU. */
const FUEL_BINDINGS: readonly CircuitBinding[] = [
  { source: 'faults', key: 'filterClog', part: 'filter', input: 'clog' },
  { source: 'faults', key: 'strainerClog', part: 'strainer', input: 'clog' },
  { source: 'faults', key: 'pumpWear', part: 'pump', input: 'wear' },
  { source: 'faults', key: 'injectorLeak', part: 'injector2', input: 'leak' },
  { source: 'faults', key: 'lineLeak', part: 'lineLeak', input: 'severity' },
  { source: 'params', key: 'fastConsumption', part: 'tank', input: 'fast' },
];

interface FuelBuild {
  circuit: CompiledCircuit<FuelState>;
  params: FuelParams;
  faults: FuelFaults;
  state: FuelState;
}

/** Compila el circuito del combustible con los mismos overrides de la fábrica. */
function buildFuelCircuit(overrides: FuelOverrides = {}): FuelBuild {
  const state: FuelState = createInitialFuelState(overrides);
  const params: FuelParams = { ...DEFAULT_PARAMS, ...overrides.params };
  const faults: FuelFaults = { ...DEFAULT_FAULTS, ...overrides.faults };
  const signals: FuelSignals = {
    engineState: 'off',
    rpmEff: 0,
    crankAngle: 0,
    pMan: 0,
    pRef: 0,
    mixture: 0,
    relayOn: false,
  };
  const controllerTypes: Readonly<Record<string, ControllerFactory>> = {
    engineCore: (id, controllerParams) => createEngineCore(id, controllerParams, { signals }),
    ecuFuel: (id, controllerParams) => createEcuFuel(id, controllerParams, signals),
    alternator: (id, controllerParams) => createAlternator(id, controllerParams, signals),
    fuelSupply: (id, controllerParams) => createFuelSupply(id, controllerParams),
  };
  const circuit = compileCircuit<FuelState>({
    def: FUEL_DEF,
    types: ELEMENT_TYPES,
    controllerTypes,
    bindings: FUEL_BINDINGS,
    init: { tankLevel: overrides.tankLevel },
    state,
    params,
    faults,
    seed: overrides.seed ?? 12345,
  });
  return { circuit, params, faults, state };
}

/** El `CircuitDef` compilado, para tests de paridad y de fallas del solver. */
export function compileFuelCircuit(overrides: FuelOverrides = {}): CompiledCircuit<FuelState> {
  return buildFuelCircuit(overrides).circuit;
}

/** Fábrica del modelo compilado: misma forma que `createFuelModel` (§8.4). */
export function createCompiledFuelModel(overrides: FuelOverrides = {}): FuelModel {
  const { circuit, params, faults, state } = buildFuelCircuit(overrides);
  const tank = circuit.elements['tank'];
  const actions: ModelActions = {
    refill: (): void => {
      if (tank) tank.state['level'] = 45;
    },
    setTank: (liters: unknown): void => {
      if (tank) tank.state['level'] = clamp(Number(liters) || 0, 0, K.tankCapacity);
    },
  };
  return {
    params,
    faults,
    state,
    actions,
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
}
