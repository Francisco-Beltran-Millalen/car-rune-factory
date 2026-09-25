// Etapa 1 del quiz de combustible (E1): sólo "haz clic en", 8 piezas principales.

import type { Stage } from '../types.ts';

const stage: Stage = {
  id: 'fuel-quiz-1',
  mode: 'quiz',
  module: 'fuel',
  title: 'Nombrar piezas I',
  brief: 'Te pedimos una pieza y la tocás en el diagrama. Sin etiquetas ni ayudas.',
  seed: 101,
  unlockAfter: [],
  config: {
    questions: 8,
    types: ['find'],
    parts: ['tank', 'strainer', 'pump', 'filter', 'rail', 'injector1', 'regulator', 'manifold'],
    sameConcept: [['injector1', 'injector2', 'injector3', 'injector4']],
  },
};

export default stage;
