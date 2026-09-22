// Descriptor del módulo de combustible (CONTRATOS.md 4.1).
import { createFuelModel } from './model.js';
import { createFuelView } from './view.js';
import { parts } from './content.js';
import { createNarrator } from './narrate.js';
import { controls, faults, readouts, presets } from './specs.js';

export default {
  id: 'fuel',
  title: 'Sistema de combustible',
  summary: 'Cómo llega la bencina desde el estanque a los inyectores: bomba, filtro, riel, regulador y retorno.',
  order: 1,
  viewBox: [0, 0, 1240, 680],
  createModel: () => createFuelModel(),
  createView: createFuelView,
  controls,
  faults,
  readouts,
  parts,
  narrate: createNarrator(),
  presets,
};
