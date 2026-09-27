// Catálogo §26 del carburador (spec carburetor §4). Un solo descriptor.

import type { FaultCatalogEntry } from '../../core/types.ts';

export const CARBURETOR_FAULTS: readonly FaultCatalogEntry[] = [
  { id: 'idleJet.clog', modelKey: 'idleJetClog', part: 'idleJet', kind: 'severity', healthy: 0, visibility: 'never', label: 'Surtidor de ralentí tapado' },
  { id: 'mainJet.clog', modelKey: 'mainJetClog', part: 'mainJet', kind: 'severity', healthy: 0, visibility: 'never', label: 'Surtidor principal tapado' },
  { id: 'float.punctured', modelKey: 'floatPunctured', part: 'float', kind: 'toggle', healthy: false, visibility: 'inspect', label: 'Flotador pinchado' },
  { id: 'needleValve.stuck', modelKey: 'needleStuck', part: 'needleValve', kind: 'toggle', healthy: false, visibility: 'inspect', label: 'Aguja pegada' },
  {
    id: 'choke.stuck',
    modelKey: 'chokeStuck',
    part: 'choke',
    kind: 'enum',
    healthy: 'ok',
    visibility: 'inspect',
    label: 'Choke trabado',
  },
  { id: 'accelPump.failed', modelKey: 'accelPumpFailed', part: 'accelPump', kind: 'toggle', healthy: false, visibility: 'inspect', label: 'Bomba de aceleración rota' },
  { id: 'mechPump.wear', modelKey: 'pumpWear', part: 'mechPump', kind: 'severity', healthy: 0, visibility: 'never', label: 'Bomba mecánica gastada' },
  { id: 'mechPump.diaphragm', modelKey: 'pumpDiaphragm', part: 'mechPump', kind: 'toggle', healthy: false, visibility: 'always', label: 'Diafragma de la bomba roto' },
  { id: 'fuelFilter.clog', modelKey: 'filterClog', part: 'fuelFilter', kind: 'severity', healthy: 0, visibility: 'never', label: 'Filtro de bencina tapado' },
];
