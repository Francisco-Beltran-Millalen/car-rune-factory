// Lista de módulos disponibles, en orden. Agregar un módulo = importarlo aquí.
import fuel from './fuel/index.js';

export const modules = [fuel].sort((a, b) => a.order - b.order);
