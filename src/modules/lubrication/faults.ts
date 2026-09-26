// Catálogo §26 de la lubricación (A14, spec lubrication §4), por variante.

import type { FaultCatalogEntry } from '../../core/types.ts';
import type { LubricationVariant } from './constants.ts';

const COMMON: readonly FaultCatalogEntry[] = [
  { id: 'mainBearings.wear', modelKey: 'bearingWear', part: 'mainBearings', kind: 'severity', healthy: 0, visibility: 'inspect', label: 'Cojinetes gastados' },
  { id: 'oilPump.wear', modelKey: 'pumpWear', part: 'oilPump', kind: 'severity', healthy: 0, visibility: 'never', label: 'Bomba gastada' },
  { id: 'reliefValve.stuckOpen', modelKey: 'reliefStuckOpen', part: 'reliefValve', kind: 'toggle', healthy: false, visibility: 'inspect', label: 'Válvula de alivio trabada abierta' },
  { id: 'oilFilter.clog', modelKey: 'filterClog', part: 'oilFilter', kind: 'severity', healthy: 0, visibility: 'never', label: 'Filtro tapado' },
  { id: 'pickup.clog', modelKey: 'pickupClog', part: 'pickup', kind: 'severity', healthy: 0, visibility: 'inspect', label: 'Rejilla tapada' },
  { id: 'oilFilter.gasketLeak', modelKey: 'filterGasketLeak', part: 'oilFilter', kind: 'severity', healthy: 0, visibility: 'always', label: 'Junta del filtro pierde' },
  { id: 'oilPan.drip', modelKey: 'panDrip', part: 'drainPlug', kind: 'severity', healthy: 0, visibility: 'always', label: 'Tapón del cárter gotea' },
  { id: 'pressureSwitch.stuck', modelKey: 'switchStuck', part: 'pressureSwitch', kind: 'enum', healthy: 'ok', visibility: 'inspect', label: 'Interruptor de presión' },
];

export function lubricationFaults(variant: LubricationVariant): readonly FaultCatalogEntry[] {
  if (variant === 'lamp') {
    return [
      ...COMMON,
      { id: 'antiDrainback.failed', modelKey: 'antiDrainbackFailed', part: 'antiDrainback', kind: 'toggle', healthy: false, visibility: 'inspect', label: 'Válvula antirretorno vencida' },
    ];
  }
  return COMMON;
}
