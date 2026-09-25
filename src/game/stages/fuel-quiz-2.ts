// Etapa 2 del quiz de combustible (E1): los 3 tipos (find/name/purpose) y todas las piezas.

import type { Stage } from '../types.ts';

const stage: Stage = {
  id: 'fuel-quiz-2',
  mode: 'quiz',
  module: 'fuel',
  title: 'Nombrar piezas II',
  brief: 'Ahora también te mostramos una pieza o su función y elegís el nombre.',
  seed: 202,
  unlockAfter: ['fuel-quiz-1'],
  config: {
    questions: 10,
    types: ['find', 'name', 'purpose'],
    parts: 'all',
    sameConcept: [['injector1', 'injector2', 'injector3', 'injector4']],
  },
};

export default stage;
