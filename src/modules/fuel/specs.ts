// Controles, fallas, lecturas y presets declarativos (§8).

import type { ControlSpec, FaultSpec, Preset, ReadoutSpec } from '../../core/types.ts';
import type { FuelModel, FuelState } from './reference-model.ts';

export const controls: readonly ControlSpec<FuelModel>[] = [
  {
    type: 'select',
    key: 'ignitionKey',
    label: 'Llave',
    group: 'Llave de contacto',
    options: [
      { value: 'off', label: 'Apagado' },
      { value: 'on', label: 'Contacto' },
      { value: 'start', label: 'Arranque' },
      { value: 'run', label: 'Marcha' },
    ],
  },
  { type: 'slider', key: 'throttle', label: 'Acelerador', min: 0, max: 1, step: 0.05, group: 'Motor' },
  { type: 'slider', key: 'rpm', label: 'RPM', min: 600, max: 6500, step: 50, unit: 'rpm', group: 'Motor' },
  { type: 'slider', key: 'batteryV', label: 'Batería', min: 10, max: 14.5, step: 0.1, unit: 'V', group: 'Eléctrico' },
  { type: 'toggle', key: 'fastConsumption', label: 'Consumo acelerado ×100', group: 'Estanque' },
  { type: 'button', action: 'refill', label: 'Rellenar estanque', group: 'Estanque' },
];

export const faults: readonly FaultSpec[] = [
  { key: 'filterClog', label: 'Filtro tapado', kind: 'severity', description: 'Más caída de presión en el filtro, crece con el caudal.' },
  { key: 'strainerClog', label: 'Colador tapado', kind: 'severity', description: 'La bomba se ahoga en la aspiración.' },
  { key: 'pumpWear', label: 'Bomba gastada', kind: 'severity', description: 'Menos caudal y menos presión máxima.' },
  {
    key: 'relay',
    label: 'Relé de bomba',
    kind: 'enum',
    options: [
      { value: 'ok', label: 'Bien' },
      { value: 'intermittent', label: 'Intermitente' },
      { value: 'dead', label: 'Muerto' },
    ],
  },
  {
    key: 'regulator',
    label: 'Regulador',
    kind: 'enum',
    options: [
      { value: 'ok', label: 'Bien' },
      { value: 'stuckOpen', label: 'Pegado abierto' },
      { value: 'stuckClosed', label: 'Pegado cerrado' },
    ],
  },
  { key: 'vacuumHoseOff', label: 'Manguera de vacío suelta', kind: 'toggle' },
  { key: 'injectorLeak', label: 'Inyector 2 gotea', kind: 'severity' },
  { key: 'lineLeak', label: 'Fuga en la línea', kind: 'severity' },
];

export const readouts: readonly ReadoutSpec<FuelState>[] = [
  { id: 'pRail', label: 'Presión de riel', unit: 'bar', decimals: 2, get: (s) => s.pRail, history: true, gauge: { min: 0, max: 8, green: [2.2, 3.8] } },
  { id: 'dpRail', label: 'Riel − múltiple', unit: 'bar', decimals: 2, get: (s) => s.pRail - s.pMan, history: true },
  { id: 'qPump', label: 'Caudal de la bomba', unit: 'L/h', decimals: 0, get: (s) => s.qPump, history: true },
  { id: 'qInj', label: 'Caudal inyectado', unit: 'L/h', decimals: 1, get: (s) => s.qInjAvg, history: true },
  { id: 'qReturn', label: 'Caudal de retorno', unit: 'L/h', decimals: 0, get: (s) => s.qReturn, history: true },
  { id: 'dpFilter', label: 'Caída en el filtro', unit: 'bar', decimals: 2, get: (s) => s.dpFilter, history: true },
  { id: 'pumpCurrent', label: 'Corriente de la bomba', unit: 'A', decimals: 1, get: (s) => s.pumpCurrent, history: true },
  { id: 'pMan', label: 'Presión del múltiple', unit: 'bar', decimals: 2, get: (s) => s.pMan, history: true },
  { id: 'mixture', label: 'Mezcla (vs. calculada)', unit: '%', decimals: 0, get: (s) => s.mixtureRatio * 100, history: true },
  { id: 'tank', label: 'Nivel del estanque', unit: 'L', decimals: 1, get: (s) => s.tankLevel },
];

export const presets: readonly Preset<FuelModel>[] = [
  {
    id: 'normal',
    label: 'Arranque normal',
    params: { ignitionKey: 'on' },
    note: 'Mira el cebado de 2 s y después pasa a "Arranque". Observa la aguja del manómetro.',
  },
  {
    id: 'clogged',
    label: 'Tironea al acelerar en subida',
    params: { ignitionKey: 'run', throttle: 0 },
    faults: { filterClog: 0.9 },
    note: 'En ralentí anda bien. Sube el acelerador y las RPM: la presión cae y la mezcla se empobrece.',
  },
  {
    id: 'rich-idle',
    label: 'Ralentí rico',
    params: { ignitionKey: 'run' },
    faults: { vacuumHoseOff: true },
    note: 'Compara "Riel − múltiple" con los 3 bar normales. Reconecta la manguera en Fallas.',
  },
  {
    id: 'hard-start',
    label: 'Cuesta partir en la mañana',
    params: { ignitionKey: 'on' },
    faults: { injectorLeak: 1 },
    note: 'Después del cebado, deja la llave en Contacto y mira cómo cae la presión residual. Usa 4× para acelerar la espera.',
  },
  {
    id: 'empty',
    label: 'Me quedé sin bencina',
    params: { ignitionKey: 'run', throttle: 0.6, rpm: 3500, fastConsumption: true },
    setup: { setTank: [1.5] },
    note: 'Con consumo acelerado el estanque se vacía en segundos: aparecen burbujas de aire y el motor se detiene.',
  },
];
