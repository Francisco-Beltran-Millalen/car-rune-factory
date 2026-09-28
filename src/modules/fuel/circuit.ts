// El sistema de combustible sobre el solver (A6): `CircuitDef` con topología,
// layout visual (A7) y compilado con paridad con la referencia. Puro (§1).

import { clamp } from '../../core/math.ts';
import type { ModelActions } from '../../core/types.ts';
import { compileCircuit } from '../../sim/circuit/compile.ts';
import type {
  CircuitBinding,
  CircuitDef,
  CircuitLinkDef,
  CompiledCircuit,
} from '../../sim/circuit/types.ts';
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
 * Desde A7 las coordenadas son las del diagrama (`view.ts` de A1–A6) y cada
 * pieza declara su tipo de drawer en `visual`.
 */
export const FUEL_DEF: CircuitDef = {
  id: 'fuel-return',
  title: 'Sistema de combustible',
  fluid: 'fuel',
  parts: [
    { id: 'battery', type: 'battery', visual: 'battery', x: 40, y: 40, params: { r: 0.001 } },
    { id: 'key', type: 'switch', visual: 'key', x: 150, y: 40, params: { rOn: 0.001, rOff: 1e7 } },
    // `rampMs` sólo lo usa el vehículo (A15, plan §8): en el laboratorio el
    // relé queda siempre cerrado (ver `createEcuFuel`) y nunca conmuta.
    { id: 'relay', type: 'switch', visual: 'relay', x: 260, y: 40, params: { rOn: 0.001, rOff: 1e7, rampMs: 20 } },
    { id: 'ecu', type: 'visual', visual: 'ecu', x: 400, y: 40 },
    { id: 'injectorWires', type: 'visual', visual: 'wires', x: 520, y: 70 },
    { id: 'tank', type: 'tank', visual: 'tank', x: 60, y: 430, params: { capacity: 50, pickupLow: 1 } },
    { id: 'strainer', type: 'restrictor', visual: 'strainer', x: 188, y: 616, params: { k: K.kStrainer0, clogFactor: K.strainerClogFactor } },
    {
      id: 'pump',
      type: 'electricPump',
      visual: 'pump',
      x: 196,
      y: 478,
      params: {
        qMax: K.Qmax0,
        pMax: K.Pmax0,
        vNominal: K.vNominal,
        wearQ: K.wearQ,
        wearP: K.wearP,
        epsP: 0.01,
        windingR: 1,
      },
    },
    { id: 'checkValve', type: 'visual', visual: 'checkValve', x: 220, y: 466 },
    // La línea es un punto sobre su tubo; su goteo lo dibuja el drawer `feedLine`.
    { id: 'feedLine', type: 'restrictor', visual: 'feedLine', x: 380, y: 330, params: { k: K.kLine0, clogFactor: 0 } },
    { id: 'lineLeak', type: 'leak', x: 470, y: 330, params: { k: 2 } },
    { id: 'filter', type: 'restrictor', visual: 'filter', x: 520, y: 308, params: { k: K.kFilter0, clogFactor: K.filterClogFactor } },
    { id: 'rail', type: 'volume', visual: 'rail', x: 700, y: 190, params: { c: K.C } },
    // El tubo del riel une el nudo, los inyectores y el regulador (plan V1: joinedBy).
    { id: 'railNode', type: 'tee', x: 700, y: 190, joinedBy: 'rail' },
    { id: 'injector1', type: 'orifice', visual: 'injector', x: 760, y: 190, joinedBy: 'rail', params: { k: KINJ, leakCoeff: 0.6 } },
    { id: 'injector2', type: 'orifice', visual: 'injector', x: 860, y: 190, joinedBy: 'rail', params: { k: KINJ, leakCoeff: 0.6 } },
    { id: 'injector3', type: 'orifice', visual: 'injector', x: 960, y: 190, joinedBy: 'rail', params: { k: KINJ, leakCoeff: 0.6 } },
    { id: 'injector4', type: 'orifice', visual: 'injector', x: 1060, y: 190, joinedBy: 'rail', params: { k: KINJ, leakCoeff: 0.6 } },
    { id: 'manifold', type: 'pressureSource', visual: 'manifold', x: 690, y: 278, joinedBy: 'injector1' },
    { id: 'manifoldNode', type: 'tee', x: 900, y: 320 },
    { id: 'regulator', type: 'reliefRegulator', visual: 'regulator', x: 1130, y: 150, joinedBy: 'rail', params: { k: K.kReg, set: K.regSet, smooth: 0.01 } },
    { id: 'vacuumHose', type: 'pressureSource', visual: 'vacuumHose', x: 1162, y: 300, joinedBy: 'regulator' },
    { id: 'returnLine', type: 'visual', visual: 'returnLine', x: 760, y: 385 },
  ],
  links: [
    { id: 'e-bat-key', from: 'battery.+', to: 'key.a', via: [[99, 20], [135, 20], [135, 70]], visual: { owner: 'battery', pipeClass: 'fluid-electric', flowClass: 'p-electric', scale: 60, spacing: 10, radius: 2, width: 3 } },
    { id: 'e-key-relay', from: 'key.b', to: 'relay.a', visual: { owner: 'key', pipeClass: 'fluid-electric', flowClass: 'p-electric', scale: 60, spacing: 10, radius: 2, width: 3 } },
    { id: 'e-relay-pump', from: 'relay.b', to: 'pump.e+', via: [[360, 70], [360, 150], [140, 150], [140, 500]], visual: { owner: 'relay', pipeClass: 'fluid-electric', flowClass: 'p-electric', scale: 18, spacing: 12, radius: 2, width: 3 } },
    { id: 'e-pump-gnd', from: 'pump.e-', to: 'battery.-' },
    { id: 'h-tank-strainer', from: 'tank.out', to: 'strainer.a' },
    { id: 'h-strainer-pump', from: 'strainer.b', to: 'pump.in', visual: { flowClass: 'p-fuel', opacity: 0.25 } },
    { id: 'h-pump-line', from: 'pump.out', to: 'feedLine.a', via: [[220, 330]], visual: { owner: 'feedLine', flowClass: 'p-fuel' } },
    { id: 'h-line-filter', from: 'feedLine.b', to: 'filter.a', visual: { owner: 'feedLine', flowClass: 'p-fuel' } },
    { id: 'h-filter-rail', from: 'filter.b', to: 'railNode.a', via: [[650, 330], [650, 190]], visual: { owner: 'feedLine', flowClass: 'p-fuel' } },
    { id: 'h-rail-volume', from: 'rail.a', to: 'railNode.b' },
    { id: 'h-rail-i1', from: 'railNode.a', to: 'injector1.in' },
    { id: 'h-rail-i2', from: 'railNode.b', to: 'injector2.in' },
    { id: 'h-rail-i3', from: 'railNode.c', to: 'injector3.in' },
    { id: 'h-rail-i4', from: 'railNode.a', to: 'injector4.in' },
    { id: 'h-rail-leak', from: 'railNode.c', to: 'lineLeak.a' },
    { id: 'h-rail-reg', from: 'railNode.b', to: 'regulator.in' },
    { id: 'h-reg-ret', from: 'regulator.ret', to: 'tank.ret', via: [[1218, 170], [1218, 395], [340, 395]], visual: { owner: 'returnLine', flowClass: 'p-fuel', spacing: 16, radius: 3, width: 8, opacity: 0.25 } },
    { id: 'h-reg-ref', from: 'regulator.ref', to: 'vacuumHose.a' },
    { id: 'h-inj1-man', from: 'injector1.out', to: 'manifoldNode.a' },
    { id: 'h-inj2-man', from: 'injector2.out', to: 'manifoldNode.b' },
    { id: 'h-inj3-man', from: 'injector3.out', to: 'manifoldNode.a' },
    { id: 'h-inj4-man', from: 'injector4.out', to: 'manifoldNode.b' },
    { id: 'h-man-src', from: 'manifold.a', to: 'manifoldNode.c' },
  ] satisfies readonly CircuitLinkDef[],
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
  // A15, plan del vehículo §8: en `vehicle-2000` este sistema provee el bus
  // `12v` (su batería/llave); si no es el proveedor, `compileVehicle` excluye
  // `battery` (§3.1, §4 paso 3) y sus puertos quedan igual fundidos al riel.
  buses: {
    '12v': { ports: ['battery.+'], source: 'battery' },
    chassis: { ports: ['battery.-'] },
  },
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
