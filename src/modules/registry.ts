// Lista de módulos disponibles, en orden. Agregar un módulo = importarlo aquí.
import type { ModuleDescriptor } from '../core/types.ts';
import fuel from './fuel/index.ts';

export const modules: readonly ModuleDescriptor[] = [fuel].sort((a, b) => a.order - b.order);
