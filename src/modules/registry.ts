// Lista de módulos disponibles, en orden. Agregar un módulo = importarlo aquí.
import type { ModuleDescriptor } from '../core/types.ts';
import fuel from './fuel/index.ts';
import { fourStrokeDohc, fourStrokeOhv } from './four-stroke/index.ts';
import { ignitionCop, ignitionPoints } from './ignition/index.ts';

export const modules: readonly ModuleDescriptor[] = [
  fuel,
  fourStrokeOhv,
  fourStrokeDohc,
  ignitionPoints,
  ignitionCop,
].sort((a, b) => a.order - b.order);
