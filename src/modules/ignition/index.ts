// Descriptores del encendido (CONTRATOS 4.1): platinos y COP del mismo código.

import './ignition.css';
import { defineModule, type ModuleDescriptor } from '../../core/types.ts';
import { createIgnitionModel, ignitionDef, type IgnitionModel } from './circuit.ts';
import { VARIANTS, type IgnitionVariant } from './constants.ts';
import { createParts } from './content.ts';
import { DEFAULT_FAULTS, DEFAULT_PARAMS } from './core.ts';
import { ignitionFaults } from './faults.ts';
import { createNarrator } from './narrate.ts';
import { IGNITION_PRESENT } from './present.ts';
import { controls, faults, presets, readouts } from './specs.ts';

function createModule(variant: IgnitionVariant): ModuleDescriptor {
  const info = VARIANTS[variant];
  return defineModule<IgnitionModel>({
    id: info.id,
    title: info.title,
    summary: info.summary,
    order: info.order,
    viewBox: [0, 0, 1300, 720],
    createModel: () => createIgnitionModel(variant),
    circuit: ignitionDef(variant),
    present: IGNITION_PRESENT,
    defaultParams: DEFAULT_PARAMS,
    defaultFaults: DEFAULT_FAULTS,
    controls: controls(variant),
    faults: faults(variant),
    faultCatalog: ignitionFaults(variant),
    readouts: readouts(variant),
    parts: createParts(variant),
    narrate: createNarrator(variant),
    presets: presets(variant),
  });
}

export const ignitionPoints = createModule('points');
export const ignitionCop = createModule('cop');
