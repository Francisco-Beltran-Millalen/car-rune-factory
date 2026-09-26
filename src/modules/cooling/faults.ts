// Catálogo §26 de la refrigeración (A13, spec cooling §4), por variante.

import type { FaultCatalogEntry } from '../../core/types.ts';
import type { CoolingVariant } from './constants.ts';

const COMMON: readonly FaultCatalogEntry[] = [
  { id: 'thermostat.state', modelKey: 'thermostat', part: 'thermostat', kind: 'enum', healthy: 'ok', visibility: 'inspect', label: 'Termostato' },
  { id: 'waterPump.wear', modelKey: 'pumpWear', part: 'waterPump', kind: 'severity', healthy: 0, visibility: 'never', label: 'Bomba gastada' },
  { id: 'waterPump.leak', modelKey: 'pumpLeak', part: 'waterPump', kind: 'severity', healthy: 0, visibility: 'always', label: 'Bomba pierde por el testigo' },
  { id: 'lowerHose.leak', modelKey: 'hoseLeak', part: 'lowerHose', kind: 'severity', healthy: 0, visibility: 'always', label: 'Manguera inferior rota' },
  { id: 'pumpBelt.slipping', modelKey: 'beltSlip', part: 'pumpBelt', kind: 'severity', healthy: 0, visibility: 'inspect', label: 'Correa patina' },
  { id: 'radiator.finsClogged', modelKey: 'finsClog', part: 'radiator', kind: 'severity', healthy: 0, visibility: 'inspect', label: 'Panal tapado' },
  { id: 'radiator.tubesClogged', modelKey: 'tubesClog', part: 'radiator', kind: 'severity', healthy: 0, visibility: 'inspect', label: 'Tubos con sarro' },
  { id: 'radiatorCap.failed', modelKey: 'capFailed', part: 'radiatorCap', kind: 'toggle', healthy: false, visibility: 'inspect', label: 'Tapa que no sostiene presión' },
  { id: 'heaterCore.clogged', modelKey: 'heaterClog', part: 'heaterCore', kind: 'severity', healthy: 0, visibility: 'inspect', label: 'Calefactor tapado' },
  { id: 'fan.dead', modelKey: 'fanDead', part: 'fan', kind: 'toggle', healthy: false, visibility: 'always', label: 'Ventilador muerto' },
  { id: 'tempSensor.fault', modelKey: 'sensorFault', part: 'tempSensor', kind: 'enum', healthy: 'ok', visibility: 'inspect', label: 'Sensor de temperatura' },
];

const VISCOUS: readonly FaultCatalogEntry[] = [
  { id: 'fanClutch.worn', modelKey: 'fanClutchWorn', part: 'fanClutch', kind: 'severity', healthy: 0, visibility: 'inspect', label: 'Embrague viscoso gastado' },
];

const ELECTRIC: readonly FaultCatalogEntry[] = [
  { id: 'fanSwitch.dead', modelKey: 'fanSwitchDead', part: 'fanSwitch', kind: 'toggle', healthy: false, visibility: 'always', label: 'Termocontacto muerto' },
];

export function coolingFaults(variant: CoolingVariant): readonly FaultCatalogEntry[] {
  return variant === 'viscous' ? [...COMMON, ...VISCOUS] : [...COMMON, ...ELECTRIC];
}
