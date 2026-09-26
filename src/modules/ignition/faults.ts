// Catálogo §26 del encendido (spec ignition §4), por variante.

import type { FaultCatalogEntry } from '../../core/types.ts';
import type { IgnitionVariant } from './constants.ts';

function coilWeak(part: string): FaultCatalogEntry {
  return {
    id: 'coil.weak',
    modelKey: 'coilWeak',
    part,
    kind: 'severity',
    healthy: 0,
    visibility: 'inspect',
    label: 'Bobina débil',
  };
}

const COMMON: readonly FaultCatalogEntry[] = [
  {
    id: 'sparkPlugs.gapWear',
    modelKey: 'plugGapWear',
    part: 'sparkPlug1',
    kind: 'severity',
    healthy: 0,
    visibility: 'never',
    label: 'Bujías gastadas (separación)',
  },
  {
    id: 'sparkPlug2.fouled',
    modelKey: 'plugFouled2',
    part: 'sparkPlug2',
    kind: 'severity',
    healthy: 0,
    visibility: 'inspect',
    label: 'Bujía 2 engrasada',
  },
];

const POINTS: readonly FaultCatalogEntry[] = [
  { id: 'points.gap', modelKey: 'pointsGap', part: 'points', kind: 'severity', healthy: 0, visibility: 'inspect', label: 'Platinos muy abiertos' },
  { id: 'points.pitted', modelKey: 'pointsPitted', part: 'points', kind: 'severity', healthy: 0, visibility: 'inspect', label: 'Contactos picados' },
  { id: 'condenser.open', modelKey: 'condenserOpen', part: 'condenser', kind: 'toggle', healthy: false, visibility: 'always', label: 'Condensador abierto' },
  { id: 'condenser.shorted', modelKey: 'condenserShorted', part: 'condenser', kind: 'toggle', healthy: false, visibility: 'always', label: 'Condensador en corto' },
  { id: 'ballast.open', modelKey: 'ballastOpen', part: 'ballast', kind: 'toggle', healthy: false, visibility: 'always', label: 'Balasto cortado' },
  { id: 'distributorCap.cracked', modelKey: 'capCracked', part: 'distributorCap', kind: 'severity', healthy: 0, visibility: 'inspect', label: 'Tapa fisurada' },
  { id: 'rotor.worn', modelKey: 'rotorWorn', part: 'rotor', kind: 'severity', healthy: 0, visibility: 'inspect', label: 'Rotor gastado' },
  { id: 'htLead3.open', modelKey: 'htLead3Open', part: 'htLead3', kind: 'toggle', healthy: false, visibility: 'always', label: 'Cable del cilindro 3 cortado' },
  { id: 'centrifugalAdvance.stuck', modelKey: 'centrifugalStuck', part: 'centrifugalAdvance', kind: 'toggle', healthy: false, visibility: 'inspect', label: 'Avance centrífugo trabado' },
  { id: 'vacuumAdvance.diaphragm', modelKey: 'vacuumDiaphragm', part: 'vacuumAdvance', kind: 'toggle', healthy: false, visibility: 'inspect', label: 'Diafragma del avance roto' },
];

const COP: readonly FaultCatalogEntry[] = [
  { id: 'crankSensor.dead', modelKey: 'crankSensorDead', part: 'crankSensor', kind: 'toggle', healthy: false, visibility: 'always', label: 'Sensor de cigüeñal muerto' },
  { id: 'crankSensor.gap', modelKey: 'crankSensorGap', part: 'crankSensor', kind: 'severity', healthy: 0, visibility: 'inspect', label: 'Sensor de cigüeñal con separación' },
  { id: 'camSensor.dead', modelKey: 'camSensorDead', part: 'camSensor', kind: 'toggle', healthy: false, visibility: 'always', label: 'Sensor de leva muerto' },
  { id: 'coil2.dead', modelKey: 'coil2Dead', part: 'coil2', kind: 'toggle', healthy: false, visibility: 'always', label: 'Bobina 2 muerta' },
  { id: 'igniter.dead', modelKey: 'igniterDead', part: 'igniter', kind: 'toggle', healthy: false, visibility: 'always', label: 'Igniter muerto' },
];

export function ignitionFaults(variant: IgnitionVariant): readonly FaultCatalogEntry[] {
  return variant === 'points'
    ? [...COMMON, coilWeak('coil'), ...POINTS]
    : [...COMMON, coilWeak('coil3'), ...COP];
}
