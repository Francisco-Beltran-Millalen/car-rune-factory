// Descriptores del ciclo de 4 tiempos (CONTRATOS 4.1): dos variantes generadas
// por el mismo código (spec §1). `#/lab/four-stroke` redirige a la DOHC.

import './four-stroke.css';
import { defineModule, type ModuleDescriptor } from '../../core/types.ts';
import { fourStrokeDef, createFourStrokeModel, type FourStrokeModel } from './circuit.ts';
import { createParts } from './content.ts';
import { VARIANTS, type FourStrokeVariant } from './constants.ts';
import { fourStrokeFaults } from './faults.ts';
import { createNarrator } from './narrate.ts';
import { FOUR_STROKE_PRESENT } from './present.ts';
import { DEFAULT_FAULTS, DEFAULT_PARAMS } from './mechanism.ts';
import { controls, faults, presets, readouts } from './specs.ts';

function createModule(variant: FourStrokeVariant): ModuleDescriptor {
  const info = VARIANTS[variant];
  return defineModule<FourStrokeModel>({
    id: info.id,
    title: info.title,
    summary: info.summary,
    order: info.order,
    viewBox: [0, 0, 1400, 760],
    createModel: () => createFourStrokeModel(variant),
    circuit: fourStrokeDef(variant),
    present: FOUR_STROKE_PRESENT,
    defaultParams: DEFAULT_PARAMS,
    defaultFaults: DEFAULT_FAULTS,
    controls: controls(variant),
    faults: faults(variant),
    faultCatalog: fourStrokeFaults(variant),
    readouts,
    parts: createParts(variant),
    narrate: createNarrator(),
    presets: presets(variant),
  });
}

export const fourStrokeOhv = createModule('ohv');
export const fourStrokeDohc = createModule('dohc');
