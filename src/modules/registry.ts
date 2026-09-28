// Lista de módulos disponibles, en orden. Agregar un módulo = importarlo aquí.
import type { ModuleDescriptor } from '../core/types.ts';
import carburetor from './carburetor/index.ts';
import fuel from './fuel/index.ts';
import { fourStrokeDohc, fourStrokeOhv } from './four-stroke/index.ts';
import { ignitionCop, ignitionPoints } from './ignition/index.ts';
import { coolingElectric, coolingViscous } from './cooling/index.ts';
import { lubricationGauge, lubricationLamp } from './lubrication/index.ts';
import { vehicle2000, vehicle70 } from './vehicle/index.ts';

export const modules: readonly ModuleDescriptor[] = [
  fuel,
  fourStrokeOhv,
  fourStrokeDohc,
  ignitionPoints,
  ignitionCop,
  coolingViscous,
  coolingElectric,
  lubricationGauge,
  lubricationLamp,
  carburetor,
  vehicle70,
  vehicle2000,
].sort((a, b) => a.order - b.order);
