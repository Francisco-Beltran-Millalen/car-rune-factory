// Descriptor del módulo de combustible (CONTRATOS.md 4.1).
import './fuel.css';
import { defineModule } from '../../core/types.ts';
import { FUEL_DEF, createCompiledFuelModel } from './circuit.ts';
import { parts } from './content.ts';
import { FUEL_FAULTS } from './faults.ts';
import { createNarrator } from './narrate.ts';
import { FUEL_PRESENT } from './present.ts';
import { DEFAULT_FAULTS, DEFAULT_PARAMS, type FuelModel } from './reference-model.ts';
import { controls, faults, presets, readouts } from './specs.ts';

export default defineModule<FuelModel>({
  id: 'fuel',
  title: 'Sistema de combustible',
  summary: 'Cómo llega la bencina desde el estanque a los inyectores: bomba, filtro, riel, regulador y retorno.',
  order: 1,
  viewBox: [0, 0, 1240, 680],
  createModel: () => createCompiledFuelModel(),
  circuit: FUEL_DEF,
  present: FUEL_PRESENT,
  defaultParams: DEFAULT_PARAMS,
  defaultFaults: DEFAULT_FAULTS,
  controls,
  faults,
  faultCatalog: FUEL_FAULTS,
  readouts,
  parts,
  narrate: createNarrator(),
  presets,
});
