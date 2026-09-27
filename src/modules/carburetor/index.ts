// Descriptor del carburador (CONTRATOS.md 4.1, spec carburetor).

import './carburetor.css';
import { defineModule } from '../../core/types.ts';
import { CARB_DEF, createCarburetorModel, type CarburetorModel } from './circuit.ts';
import { parts } from './content.ts';
import { DEFAULT_FAULTS, DEFAULT_PARAMS } from './controllers.ts';
import { CARBURETOR_FAULTS } from './faults.ts';
import { createNarrator } from './narrate.ts';
import { CARBURETOR_PRESENT } from './present.ts';
import { controls, faults, presets, readouts } from './specs.ts';

export default defineModule<CarburetorModel>({
  id: 'carburetor',
  title: 'Carburador años 70',
  summary: 'Cómo la depresión del venturi aspira la bencina de la cuba: circuitos de ralentí y principal, choke y bomba de aceleración.',
  order: 10,
  viewBox: [0, 0, 1200, 720],
  createModel: () => createCarburetorModel(),
  circuit: CARB_DEF,
  present: CARBURETOR_PRESENT,
  defaultParams: DEFAULT_PARAMS,
  defaultFaults: DEFAULT_FAULTS,
  controls,
  faults,
  faultCatalog: CARBURETOR_FAULTS,
  readouts,
  parts,
  narrate: createNarrator(),
  presets,
});
