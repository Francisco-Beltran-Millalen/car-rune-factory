// Biblioteca de elementos y registro de tipos (P23 §8.2). Puro (§1).
// La lista de leyes, puertos y fallas está en docs/modules/solver.md §7.

import type { ElementDef, Fluid } from '../solver/types.ts';
import { createBattery, createCurrentLoad, createJunction, createResistor, createSwitch } from './electric.ts';
import {
  createElectricPump,
  createOrifice,
  createPressureSource,
  createReliefRegulator,
  createTank,
} from './hydraulic.ts';
import { createCheckValve, createLeak, createRestrictor, createTee, createVolume } from './passive.ts';
import { VISUAL_TYPE } from './visual.ts';

export type ElementFactory = (
  params: Readonly<Record<string, number>>,
  fluid: Fluid,
) => ElementDef;

export interface ElementTypeInfo {
  create: ElementFactory;
  /** Todos los puertos del elemento son el mismo nodo interno (tank, tee). */
  joint?: boolean;
  /** Un puerto admite más de una conexión (tee). */
  multiple?: boolean;
}

export {
  createBattery,
  createCheckValve,
  createCurrentLoad,
  createElectricPump,
  createJunction,
  createLeak,
  createOrifice,
  createPressureSource,
  createReliefRegulator,
  createResistor,
  createRestrictor,
  createSwitch,
  createTank,
  createTee,
  createVolume,
};

export { VISUAL_TYPE };

/** Registro de tipos por defecto para `compileCircuit`. */
export const ELEMENT_TYPES: Readonly<Record<string, ElementTypeInfo>> = {
  restrictor: { create: createRestrictor },
  checkValve: { create: createCheckValve },
  leak: { create: createLeak },
  volume: { create: createVolume },
  tee: { create: createTee, joint: true, multiple: true },
  electricPump: { create: createElectricPump },
  reliefRegulator: { create: createReliefRegulator },
  orifice: { create: createOrifice },
  tank: { create: createTank, joint: true },
  pressureSource: { create: createPressureSource },
  battery: { create: createBattery },
  resistor: { create: createResistor },
  switch: { create: createSwitch },
  currentLoad: { create: createCurrentLoad },
  junction: { create: createJunction, joint: true, multiple: true, },
  visual: VISUAL_TYPE,
};
