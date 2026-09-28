// Registro de sistemas del vehículo (A15, plan del vehículo §4): mapea el
// id de un circuito/variante a los datos crudos (sin traducir) del módulo y
// a la fábrica de sus controladores contra el bus compartido. Única
// excepción a §11 (ningún módulo importa a otro): el vehículo es el
// orquestador que el propio plan describe.

import type { ModuleDescriptor } from '../../core/types.ts';
import type { CircuitDef } from '../../sim/circuit/types.ts';
import type { ControllerDef, ControllerFactory } from '../../sim/controllers/index.ts';
import type { LabBus } from '../../sim/signals/bus.ts';
import type { ElementDef } from '../../sim/solver/types.ts';
import { CARB_DEF } from '../carburetor/circuit.ts';
import carburetorModule from '../carburetor/index.ts';
import { createCarburetor } from '../carburetor/controllers.ts';
import { coolingDef } from '../cooling/circuit.ts';
import { coolingElectric, coolingViscous } from '../cooling/index.ts';
import { createCooling } from '../cooling/controllers.ts';
import { createFourStroke } from '../four-stroke/mechanism.ts';
import { fourStrokeDohc, fourStrokeOhv } from '../four-stroke/index.ts';
import { IGNITION_COP_DEF, IGNITION_POINTS_DEF } from '../ignition/circuit.ts';
import { ignitionCop, ignitionPoints } from '../ignition/index.ts';
import { createIgnition } from '../ignition/core.ts';
import { lubricationDef } from '../lubrication/circuit.ts';
import { lubricationGauge, lubricationLamp } from '../lubrication/index.ts';
import { createLubrication } from '../lubrication/controllers.ts';
import { K as LUBRICATION_K } from '../lubrication/constants.ts';
import { K as CARBURETOR_K } from '../carburetor/constants.ts';
import fuelModule from '../fuel/index.ts';
import { createEcuFuel, type FuelSignals } from '../fuel/controllers.ts';
import {
  createFuelBridgeIn,
  createFuelSupplyWithBridgeOut,
  createVehicleAlternatorBridge,
  FUEL_DEF,
} from './fuelBridge.ts';

export interface SystemWiringContext {
  bus: LabBus;
  // Propiedad con tipo función (no forma de método): así se puede pasar
  // como valor sin que el lint la trate como un "unbound method".
  setPotential: (part: string, port: string, value: number) => void;
}

export interface CircuitSystemWiring {
  kind: 'circuit';
  moduleDescriptor: ModuleDescriptor;
  rawDef: CircuitDef;
  buildControllerTypes(ctx: SystemWiringContext): Readonly<Record<string, ControllerFactory>>;
  /**
   * Nivel inicial de un `tank` que no sea el genérico de `createTank`
   * (40 L): el laboratorio de `lubrication` y `carburetor` lo fija después
   * de compilar (`state.level = ...`), no vía `init()`. Sin esto, la cuba
   * del carburador (~ml) arrancaría con 40 L. `elements` ya viene con el
   * prefijo de este sistema.
   */
  initState?(elements: Readonly<Record<string, ElementDef>>, prefix: string): void;
}

export interface MechanismSystemWiring {
  kind: 'mechanism';
  moduleDescriptor: ModuleDescriptor;
  createController(id: string, bus: LabBus): ControllerDef;
}

export type SystemWiring = CircuitSystemWiring | MechanismSystemWiring;

export const SYSTEM_REGISTRY: Readonly<Record<string, SystemWiring>> = {
  'fuel-return': {
    kind: 'circuit',
    moduleDescriptor: fuelModule,
    rawDef: FUEL_DEF,
    buildControllerTypes: ({ bus }) => {
      const signals: FuelSignals = {
        engineState: 'off',
        rpmEff: 0,
        crankAngle: 0,
        pMan: 0,
        pRef: 0,
        mixture: 0,
        relayOn: false,
      };
      return {
        // Repone el lugar de `engineCore` en la lista de controladores de
        // `fuel` (A15: el motor de verdad va hoisted, aparte): puente
        // bus → `FuelSignals`, en el mismo orden (antes de `ecuFuel`).
        engineCore: (id) => createFuelBridgeIn(id, bus, signals),
        ecuFuel: (id, params) => createEcuFuel(id, params, signals),
        alternator: (id, params) => createVehicleAlternatorBridge(id, params, signals),
        fuelSupply: (id, params) => createFuelSupplyWithBridgeOut(id, params, bus, signals),
      };
    },
  },
  'ignition-points': {
    kind: 'circuit',
    moduleDescriptor: ignitionPoints,
    rawDef: IGNITION_POINTS_DEF,
    buildControllerTypes: ({ bus }) => ({
      ignition: (id, params) => createIgnition(id, params, { bus, variant: 'points' }),
    }),
  },
  'ignition-cop': {
    kind: 'circuit',
    moduleDescriptor: ignitionCop,
    rawDef: IGNITION_COP_DEF,
    buildControllerTypes: ({ bus }) => ({
      ignition: (id, params) => createIgnition(id, params, { bus, variant: 'cop' }),
    }),
  },
  'cooling-viscous': {
    kind: 'circuit',
    moduleDescriptor: coolingViscous,
    rawDef: coolingDef('viscous'),
    buildControllerTypes: ({ bus, setPotential }) => ({
      cooling: (id, params) => createCooling(id, params, { bus, variant: 'viscous', setPotential }),
    }),
  },
  'cooling-electric': {
    kind: 'circuit',
    moduleDescriptor: coolingElectric,
    rawDef: coolingDef('electric'),
    buildControllerTypes: ({ bus, setPotential }) => ({
      cooling: (id, params) => createCooling(id, params, { bus, variant: 'electric', setPotential }),
    }),
  },
  'lubrication-gauge': {
    kind: 'circuit',
    moduleDescriptor: lubricationGauge,
    rawDef: lubricationDef('gauge'),
    buildControllerTypes: ({ bus }) => ({
      lubrication: (id, params) => createLubrication(id, params, { bus, variant: 'gauge' }),
    }),
    initState: (elements, prefix) => {
      const sump = elements[`${prefix}:sump`];
      if (sump) sump.state['level'] = LUBRICATION_K.levelFull;
    },
  },
  'lubrication-lamp': {
    kind: 'circuit',
    moduleDescriptor: lubricationLamp,
    rawDef: lubricationDef('lamp'),
    buildControllerTypes: ({ bus }) => ({
      lubrication: (id, params) => createLubrication(id, params, { bus, variant: 'lamp' }),
    }),
    initState: (elements, prefix) => {
      const sump = elements[`${prefix}:sump`];
      if (sump) sump.state['level'] = LUBRICATION_K.levelFull;
    },
  },
  carburetor: {
    kind: 'circuit',
    moduleDescriptor: carburetorModule,
    rawDef: CARB_DEF,
    buildControllerTypes: ({ bus }) => ({
      carburetor: (id, params) => createCarburetor(id, params, { bus }),
    }),
    initState: (elements, prefix) => {
      const tank = elements[`${prefix}:tank`];
      if (tank) tank.state['level'] = CARBURETOR_K.tankDefault;
      const bowl = elements[`${prefix}:floatBowl`];
      if (bowl) bowl.state['level'] = CARBURETOR_K.bowlNominal;
    },
  },
  'four-stroke-ohv': {
    kind: 'mechanism',
    moduleDescriptor: fourStrokeOhv,
    createController: (id, bus) => createFourStroke(id, {}, { bus, variant: 'ohv' }),
  },
  'four-stroke-dohc': {
    kind: 'mechanism',
    moduleDescriptor: fourStrokeDohc,
    createController: (id, bus) => createFourStroke(id, {}, { bus, variant: 'dohc' }),
  },
};
