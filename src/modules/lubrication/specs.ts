// Controles, fallas, lecturas y presets de la lubricación (A14; spec §3, §7, §10).

import type { ControlSpec, FaultSpec, Preset, ReadoutSpec } from '../../core/types.ts';
import type { LubricationModel } from './circuit.ts';
import type { LubricationVariant } from './constants.ts';
import type { LubricationState } from './controllers.ts';

export function controls(_variant: LubricationVariant): readonly ControlSpec<LubricationModel>[] {
  return [
    {
      type: 'select',
      key: 'ignitionKey',
      label: 'Llave',
      group: 'Llave de contacto',
      options: [
        { value: 'off', label: 'Apagado' },
        { value: 'on', label: 'Contacto' },
        { value: 'run', label: 'Marcha' },
      ],
    },
    { type: 'slider', key: 'rpm', label: 'RPM', min: 0, max: 6500, step: 50, unit: 'rpm', group: 'Motor (stub)' },
    { type: 'slider', key: 'oilTempC', label: 'Temperatura del aceite', min: -10, max: 150, step: 5, unit: '°C', group: 'Aceite' },
    {
      type: 'select',
      key: 'oilGrade',
      label: 'Grado',
      group: 'Aceite',
      options: [
        { value: '5W-30', label: '5W-30 (fino)' },
        { value: '10W-40', label: '10W-40' },
        { value: '20W-50', label: '20W-50 (grueso)' },
      ],
    },
    { type: 'slider', key: 'lateralG', label: 'Fuerza lateral', min: 0, max: 1, step: 0.05, unit: 'g', group: 'Aceite' },
    { type: 'button', action: 'changeOil', label: 'Cambiar aceite (4 L)', group: 'Aceite' },
  ];
}

export function faults(_variant: LubricationVariant): readonly FaultSpec[] {
  const list: FaultSpec[] = [
    { key: 'bearingWear', label: 'Cojinetes gastados', kind: 'severity' },
    { key: 'pumpWear', label: 'Bomba gastada', kind: 'severity' },
    { key: 'reliefStuckOpen', label: 'Válvula de alivio trabada abierta', kind: 'toggle' },
    { key: 'filterClog', label: 'Filtro tapado', kind: 'severity' },
    { key: 'pickupClog', label: 'Rejilla tapada', kind: 'severity' },
    { key: 'filterGasketLeak', label: 'Junta del filtro pierde', kind: 'severity' },
    { key: 'panDrip', label: 'Tapón del cárter gotea', kind: 'severity' },
    {
      key: 'switchStuck',
      label: 'Interruptor de presión',
      kind: 'enum',
      options: [
        { value: 'ok', label: 'Bien' },
        { value: 'alwaysOn', label: 'Siempre cerrado' },
        { value: 'neverOn', label: 'Nunca cierra' },
      ],
    },
  ];
  if (_variant === 'lamp') {
    list.push({ key: 'antiDrainbackFailed', label: 'Antirretorno vencido', kind: 'toggle' });
  }
  return list;
}

export const readouts: readonly ReadoutSpec<LubricationState>[] = [
  { id: 'pGallery', label: 'Presión en la galería', unit: 'bar', decimals: 2, get: (s) => s.pGallery, history: true, gauge: { min: 0, max: 6, green: [1, 4.5] } },
  { id: 'qPump', label: 'Caudal de la bomba', unit: 'L/min', decimals: 1, get: (s) => s.qPump / 60, history: true },
  { id: 'qRelief', label: 'Caudal por el alivio', unit: 'L/min', decimals: 1, get: (s) => s.qRelief / 60, history: true },
  { id: 'qBearings', label: 'Caudal por los cojinetes', unit: 'L/min', decimals: 1, get: (s) => s.qBearings / 60, history: true },
  { id: 'dpFilter', label: 'Caída en el filtro', unit: 'bar', decimals: 2, get: (s) => s.dpFilter, history: true },
  { id: 'viscosity', label: 'Viscosidad', unit: 'cSt', decimals: 0, get: (s) => s.viscosity, history: true },
  { id: 'oilTemp', label: 'Temperatura del aceite', unit: '°C', decimals: 0, get: (s) => s.oilTemp },
  { id: 'level', label: 'Nivel', unit: 'L', decimals: 2, get: (s) => s.level, gauge: { min: 0, max: 5, green: [3.5, 4.5] } },
  { id: 'gauge', label: 'Manómetro', unit: 'bar', decimals: 2, get: (s) => s.gauge },
  { id: 'damage', label: 'Daño de cojinetes', unit: '%', decimals: 0, get: (s) => s.bearingDamage * 100 },
  { id: 'lamp', label: 'Testigo (0/1)', unit: '', decimals: 0, get: (s) => (s.lampOn ? 1 : 0) },
];

export function presets(variant: LubricationVariant): readonly Preset<LubricationModel>[] {
  const list: Preset<LubricationModel>[] = [
    {
      id: 'cold',
      label: 'Arranque en frío',
      params: { ignitionKey: 'run', rpm: 800, oilTempC: 20, oilGrade: '10W-40' },
      note: 'El aceite frío es espeso: la presión se va al tope y la válvula de alivio devuelve el sobrante.',
    },
    {
      id: 'hot-idle',
      label: 'Caliente en ralentí',
      params: { ignitionKey: 'run', rpm: 800, oilTempC: 100, oilGrade: '10W-40' },
      note: 'A 100 °C la presión de ralentí es la mínima del día: el testigo sigue apagado por poco.',
    },
    {
      id: 'wrong-oil',
      label: 'Aceite equivocado (5W-30 a 120 °C)',
      params: { ignitionKey: 'run', rpm: 800, oilTempC: 120, oilGrade: '5W-30' },
      note: 'Un aceite fino y caliente baja la presión: mira el manómetro.',
    },
    {
      id: 'worn',
      label: 'Cojinetes gastados',
      params: { ignitionKey: 'run', rpm: 800, oilTempC: 100 },
      faults: { bearingWear: 0.5 },
      note: 'En ralentí caliente se prende el testigo; al acelerar se apaga.',
    },
    {
      id: 'curves',
      label: 'Poco aceite en las curvas',
      params: { ignitionKey: 'run', rpm: 2000, oilTempC: 100, lateralG: 0.6 },
      setup: { setOilLevel: [2.3] },
      note: 'El aceite se corre: la bomba aspira aire y la presión cae. Baja la fuerza lateral y se recupera.',
    },
    {
      id: 'clogged',
      label: 'Filtro tapado',
      params: { ignitionKey: 'run', rpm: 3000, oilTempC: 100 },
      faults: { filterClog: 1 },
      note: 'La válvula de bypass del filtro se abre: el aceite pasa sin filtrar.',
    },
    {
      id: 'dry',
      label: 'Motor sin aceite',
      params: { ignitionKey: 'run', rpm: 3000, oilTempC: 100 },
      setup: { setOilLevel: [1] },
      note: 'La bomba aspira aire, no hay presión y los cojinetes se dañan (acelerado ×1000).',
    },
    {
      id: 'liar',
      label: 'Testigo que miente',
      params: { ignitionKey: 'run', rpm: 800, oilTempC: 100 },
      faults: { switchStuck: 'neverOn' },
      note: 'La presión cae y el testigo nunca se prende: el interruptor está trabado.',
    },
  ];
  if (variant === 'lamp') {
    list.push({
      id: 'drainback',
      label: 'Antirretorno vencido',
      params: { ignitionKey: 'on', rpm: 800, oilTempC: 100 },
      faults: { antiDrainbackFailed: true },
      note: 'Deja el motor detenido un minuto y arranca: los primeros segundos no hay presión.',
    });
  }
  return list;
}
