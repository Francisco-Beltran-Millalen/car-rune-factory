// Descriptores de la lubricación (CONTRATOS 4.1): manómetro y testigo.

import './lubrication.css';
import { defineModule, type ModuleDescriptor } from '../../core/types.ts';
import { createLubricationModel, lubricationDef, type LubricationModel } from './circuit.ts';
import { VARIANTS, type LubricationVariant } from './constants.ts';
import { createParts } from './content.ts';
import { DEFAULT_FAULTS, DEFAULT_PARAMS } from './controllers.ts';
import { lubricationFaults } from './faults.ts';
import { createNarrator } from './narrate.ts';
import { LUBRICATION_PRESENT } from './present.ts';
import { controls, faults, presets, readouts } from './specs.ts';

function createModule(variant: LubricationVariant): ModuleDescriptor {
  const info = VARIANTS[variant];
  return defineModule<LubricationModel>({
    id: info.id,
    title: info.title,
    summary: info.summary,
    order: info.order,
    viewBox: [0, 0, 1200, 720],
    createModel: () => createLubricationModel(variant),
    circuit: lubricationDef(variant),
    present: LUBRICATION_PRESENT,
    defaultParams: DEFAULT_PARAMS,
    defaultFaults: DEFAULT_FAULTS,
    controls: controls(variant),
    faults: faults(variant),
    faultCatalog: lubricationFaults(variant),
    readouts,
    parts: createParts(variant),
    narrate: createNarrator(),
    presets: presets(variant),
  });
}

export const lubricationGauge = createModule('gauge');
export const lubricationLamp = createModule('lamp');
