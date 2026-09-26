// Catálogo §26 de fallas del combustible (P25 §3.1): id estable, clave plana
// del modelo y pieza. La tabla es la de P23 §4.6; `visibility`, `repair` y
// `symptoms` son datos de juego y los agrega A3, sin cambiar los ids.

import type { FaultCatalogEntry } from '../../core/types.ts';

export const FUEL_FAULTS: readonly FaultCatalogEntry[] = [
  {
    id: 'filter.clog',
    modelKey: 'filterClog',
    part: 'filter',
    kind: 'severity',
    healthy: 0,
    label: 'Filtro tapado',
  },
  {
    id: 'strainer.clog',
    modelKey: 'strainerClog',
    part: 'strainer',
    kind: 'severity',
    healthy: 0,
    label: 'Colador tapado',
  },
  {
    id: 'pump.wear',
    modelKey: 'pumpWear',
    part: 'pump',
    kind: 'severity',
    healthy: 0,
    label: 'Bomba gastada',
  },
  {
    id: 'relay.state',
    modelKey: 'relay',
    part: 'relay',
    kind: 'enum',
    healthy: 'ok',
    label: 'Relé de bomba',
  },
  {
    id: 'regulator.state',
    modelKey: 'regulator',
    part: 'regulator',
    kind: 'enum',
    healthy: 'ok',
    label: 'Regulador',
  },
  {
    id: 'vacuumHose.off',
    modelKey: 'vacuumHoseOff',
    part: 'vacuumHose',
    kind: 'toggle',
    healthy: false,
    label: 'Manguera de vacío suelta',
  },
  {
    id: 'injector2.leak',
    modelKey: 'injectorLeak',
    part: 'injector2',
    kind: 'severity',
    healthy: 0,
    label: 'Inyector 2 gotea',
  },
  {
    id: 'feedLine.leak',
    modelKey: 'lineLeak',
    part: 'feedLine',
    kind: 'severity',
    healthy: 0,
    label: 'Fuga en la línea',
  },
];
