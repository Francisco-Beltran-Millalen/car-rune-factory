// Lista de módulos disponibles, en orden. Agregar un módulo = importarlo aquí.
import demo from './_demo/index.js';

export const modules = [demo].sort((a, b) => a.order - b.order);
