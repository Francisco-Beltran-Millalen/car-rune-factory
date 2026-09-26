// Descriptores de la refrigeración (CONTRATOS 4.1): viscoso y eléctrico.

import './cooling.css';
import { defineModule, type ModuleDescriptor } from '../../core/types.ts';
import { coolingDef, createCoolingModel, type CoolingModel } from './circuit.ts';
import { VARIANTS, type CoolingVariant } from './constants.ts';
import { createParts } from './content.ts';
import { DEFAULT_FAULTS, DEFAULT_PARAMS } from './controllers.ts';
import { coolingFaults } from './faults.ts';
import { createNarrator } from './narrate.ts';
import { COOLING_PRESENT } from './present.ts';
import { controls, faults, presets, readouts } from './specs.ts';

function createModule(variant: CoolingVariant): ModuleDescriptor {
  const info = VARIANTS[variant];
  return defineModule<CoolingModel>({
    id: info.id,
    title: info.title,
    summary: info.summary,
    order: info.order,
    viewBox: [0, 0, 1300, 720],
    createModel: () => createCoolingModel(variant),
    circuit: coolingDef(variant),
    present: COOLING_PRESENT,
    defaultParams: DEFAULT_PARAMS,
    defaultFaults: DEFAULT_FAULTS,
    controls: controls(variant),
    faults: faults(variant),
    faultCatalog: coolingFaults(variant),
    readouts: readouts(variant),
    parts: createParts(variant),
    narrate: createNarrator(),
    presets: presets(variant),
  });
}

export const coolingViscous = createModule('viscous');
export const coolingElectric = createModule('electric');
