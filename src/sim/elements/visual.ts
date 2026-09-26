// Pieza sólo visual (A7): no tiene elemento ni puertos, no va al solver.
// Nació en `fuel/circuit.ts`; vive acá desde A11 para que la usen todos.

import type { ElementTypeInfo } from './index.ts';
import { noCommit, noEval } from './common.ts';

export const VISUAL_TYPE: ElementTypeInfo = {
  create: () => ({ ports: [], params: {}, control: {}, state: {}, eval: noEval, commit: noCommit }),
};
