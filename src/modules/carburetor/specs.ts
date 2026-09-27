// Controles, fallas, lecturas y presets del carburador (spec §3, §4, §7, §10).

import type { ControlSpec, FaultSpec, Preset, ReadoutSpec } from '../../core/types.ts';
import type { CarburetorModel } from './circuit.ts';
import type { CarburetorState } from './controllers.ts';

export const controls: readonly ControlSpec<CarburetorModel>[] = [
  { type: 'slider', key: 'rpm', label: 'RPM', min: 0, max: 6500, step: 50, unit: 'rpm', group: 'Motor (stub)' },
  { type: 'slider', key: 'throttle', label: 'Mariposa', min: 0, max: 1, step: 0.01, unit: '', group: 'Motor (stub)' },
  { type: 'slider', key: 'engineTempC', label: 'Temperatura del motor', min: -10, max: 110, step: 5, unit: '°C', group: 'Motor (stub)' },
  { type: 'slider', key: 'choke', label: 'Choke', min: 0, max: 1, step: 0.05, unit: '', group: 'Arranque' },
  { type: 'slider', key: 'idleScrew', label: 'Tornillo de mezcla', min: 0.5, max: 1.5, step: 0.05, unit: '', group: 'Ralentí' },
  { type: 'button', action: 'refill', label: 'Llenar estanque (40 L)', group: 'Bencina' },
  { type: 'button', action: 'primeBowl', label: 'Cebar la cuba a mano', group: 'Bencina' },
];

export const faults: readonly FaultSpec[] = [
  { key: 'idleJetClog', label: 'Surtidor de ralentí tapado', kind: 'severity' },
  { key: 'mainJetClog', label: 'Surtidor principal tapado', kind: 'severity' },
  { key: 'floatPunctured', label: 'Flotador pinchado', kind: 'toggle' },
  { key: 'needleStuck', label: 'Aguja pegada', kind: 'toggle' },
  {
    key: 'chokeStuck',
    label: 'Choke trabado',
    kind: 'enum',
    options: [
      { value: 'ok', label: 'Bien' },
      { value: 'closed', label: 'Trabado cerrado' },
      { value: 'open', label: 'Trabado abierto' },
    ],
  },
  { key: 'accelPumpFailed', label: 'Bomba de aceleración rota', kind: 'toggle' },
  { key: 'pumpWear', label: 'Bomba mecánica gastada', kind: 'severity' },
  { key: 'pumpDiaphragm', label: 'Diafragma de la bomba roto', kind: 'toggle' },
  { key: 'filterClog', label: 'Filtro de bencina tapado', kind: 'severity' },
];

export const readouts: readonly ReadoutSpec<CarburetorState>[] = [
  { id: 'mixture', label: 'Mezcla (% de la calibrada)', unit: '%', decimals: 0, get: (s) => s.mixture * 100, history: true, gauge: { min: 0, max: 250, green: [85, 125] } },
  { id: 'airMass', label: 'Aire', unit: 'kg/h', decimals: 1, get: (s) => s.airMass, history: true },
  { id: 'venturiDp', label: 'Depresión del venturi', unit: 'mbar', decimals: 2, get: (s) => s.venturiDp * 1000, history: true },
  { id: 'mainFraction', label: 'Fracción del principal', unit: '%', decimals: 0, get: (s) => s.mainFraction * 100 },
  { id: 'fuelDelivered', label: 'Bencina entregada', unit: 'L/h', decimals: 1, get: (s) => s.fuelDelivered, history: true },
  { id: 'bowlLevel', label: 'Nivel de la cuba', unit: 'mL', decimals: 0, get: (s) => s.bowlLevel * 1000, gauge: { min: 0, max: 100, green: [50, 65] } },
  { id: 'needleOpen', label: 'Apertura de la aguja', unit: '%', decimals: 0, get: (s) => s.needleOpen * 100 },
  { id: 'qPump', label: 'Caudal de la bomba', unit: 'L/h', decimals: 1, get: (s) => s.qPump },
  { id: 'pPump', label: 'Presión de la bomba', unit: 'bar', decimals: 2, get: (s) => s.pPump },
  { id: 'tankLevel', label: 'Nivel del estanque', unit: 'L', decimals: 1, get: (s) => s.tankLevel },
];

export const presets: readonly Preset<CarburetorModel>[] = [
  {
    id: 'idle-hot',
    label: 'Ralentí caliente',
    params: { rpm: 800, throttle: 0, engineTempC: 90, choke: 0 },
    note: 'Sano: la mezcla se sostiene en 100 % en todo el rango.',
  },
  {
    id: 'cold-start',
    label: 'Partida en frío con choke',
    params: { rpm: 300, throttle: 0, engineTempC: 20, choke: 1 },
    note: 'El choke enriquece justo lo necesario para que un motor frío parta.',
  },
  {
    id: 'forgot-choke',
    label: 'Se olvidó el choke',
    params: { rpm: 300, throttle: 0, engineTempC: 20, choke: 0 },
    note: 'Frío y sin choke la bencina no se evapora: mezcla muy pobre, no parte.',
  },
  {
    id: 'idle-jet-clogged',
    label: 'Se para en ralentí pero anda en carretera',
    params: { rpm: 800, throttle: 0, engineTempC: 90 },
    faults: { idleJetClog: 1 },
    note: 'Sin ralentí (surtidor tapado) el motor se apaga solo; a régimen alto el principal compensa.',
  },
  {
    id: 'main-jet-clogged',
    label: 'Le falta fuerza a fondo',
    params: { rpm: 6000, throttle: 1, engineTempC: 90 },
    faults: { mainJetClog: 0.6 },
    note: 'El surtidor principal tapado deja pobre la mezcla justo a fondo y alto régimen.',
  },
  {
    id: 'accel-pump-failed',
    label: 'Tironea al pisar',
    params: { rpm: 2500, throttle: 0.1, engineTempC: 90 },
    faults: { accelPumpFailed: true },
    note: 'Sin el chorro de la bomba de aceleración, pisar de golpe empobrece la mezcla un instante.',
  },
  {
    id: 'flooded',
    label: 'Se ahoga',
    params: { rpm: 800, throttle: 0, engineTempC: 90 },
    faults: { floatPunctured: true },
    note: 'El flotador pinchado no cierra la aguja: la cuba rebalsa y la mezcla se dispara.',
  },
  {
    id: 'pump-worn',
    label: 'Se para en la subida',
    params: { rpm: 4000, throttle: 1, engineTempC: 90 },
    faults: { pumpWear: 0.8 },
    note: 'La bomba mecánica gastada no repone lo que se consume a fondo: la cuba se vacía.',
  },
];
