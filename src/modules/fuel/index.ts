// Descriptor del módulo de combustible (CONTRATOS.md 4.1).
import { defineModule } from '../../core/types.ts';
import { parts } from './content.ts';
import { createNarrator } from './narrate.ts';
import { DEFAULT_FAULTS, DEFAULT_PARAMS, createFuelModel, type FuelModel } from './model.ts';
import { controls, faults, presets, readouts } from './specs.ts';
import { createFuelView } from './view.ts';

export default defineModule<FuelModel>({
  id: 'fuel',
  title: 'Sistema de combustible',
  summary: 'Cómo llega la bencina desde el estanque a los inyectores: bomba, filtro, riel, regulador y retorno.',
  order: 1,
  viewBox: [0, 0, 1240, 680],
  createModel: () => createFuelModel(),
  createView: createFuelView,
  defaultParams: DEFAULT_PARAMS,
  defaultFaults: DEFAULT_FAULTS,
  controls,
  faults,
  readouts,
  parts,
  narrate: createNarrator(),
  presets,
});
