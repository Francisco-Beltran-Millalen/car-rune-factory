// Controles, fallas, lecturas y presets del ciclo de 4 tiempos (§8; spec §3,
// §7 y §10). Por variante (OHV/DOHC).

import type { ControlSpec, FaultSpec, Preset, ReadoutSpec } from '../../core/types.ts';
import { VARIANTS, type FourStrokeVariant } from './constants.ts';
import type { FourStrokeModel } from './circuit.ts';
import type { FourStrokeState } from './mechanism.ts';

export function controls(variant: FourStrokeVariant): readonly ControlSpec<FourStrokeModel>[] {
  const list: ControlSpec<FourStrokeModel>[] = [
    {
      type: 'select',
      key: 'mode',
      label: 'Modo',
      group: 'Régimen',
      options: [
        { value: 'auto', label: 'Automático (gira)' },
        { value: 'manual', label: 'Manual (ángulo fijo)' },
      ],
    },
    { type: 'slider', key: 'rpm', label: 'RPM', min: 60, max: 6500, step: 10, unit: 'rpm', group: 'Régimen' },
    {
      type: 'slider',
      key: 'crankDeg',
      label: 'Ángulo del cigüeñal',
      min: 0,
      max: 720,
      step: 5,
      unit: '°',
      group: 'Régimen',
      disabledWhen: (m) => m.params.mode !== 'manual',
    },
    { type: 'slider', key: 'throttle', label: 'Acelerador', min: 0, max: 1, step: 0.05, group: 'Mezcla y chispa' },
    { type: 'toggle', key: 'spark', label: 'Chispa', group: 'Mezcla y chispa' },
    { type: 'slider', key: 'sparkAdvance', label: 'Avance de chispa', min: 0, max: 40, step: 1, unit: '° APMS', group: 'Mezcla y chispa' },
    { type: 'slider', key: 'oilPressure', label: 'Presión de aceite', min: 0, max: 6, step: 0.1, unit: 'bar', group: 'Lubricación' },
    {
      type: 'select',
      key: 'viewCylinder',
      label: 'Cilindro en vista',
      group: 'Vista',
      options: [
        { value: 1, label: 'Cilindro 1' },
        { value: 2, label: 'Cilindro 2' },
        { value: 3, label: 'Cilindro 3' },
        { value: 4, label: 'Cilindro 4' },
      ],
    },
    { type: 'toggle', key: 'showOverlap', label: 'Resaltar cruce de válvulas', group: 'Vista' },
  ];
  if (VARIANTS[variant].hasBelt) {
    list.push({
      type: 'select',
      key: 'drive',
      label: 'Accionamiento',
      group: 'Vista',
      options: [
        { value: 'chain', label: 'Cadena' },
        { value: 'belt', label: 'Correa dentada' },
      ],
    });
  }
  list.push({ type: 'button', action: 'compressionTest', label: 'Prueba de compresión', group: 'Pruebas' });
  return list;
}

export function faults(variant: FourStrokeVariant): readonly FaultSpec[] {
  const list: FaultSpec[] = [];
  for (let i = 1; i <= 4; i++) {
    list.push({ key: `ringWear${i}`, label: `Anillos gastados (cil. ${i})`, kind: 'severity' });
    list.push({ key: `burntValve${i}`, label: `Válvula quemada (cil. ${i})`, kind: 'severity' });
  }
  list.push(
    { key: 'crankBoltLoose', label: 'Perno del cigüeñal flojo', kind: 'toggle' },
    { key: 'keywayWorn', label: 'Chavetero ovalado', kind: 'severity' },
    { key: 'keySheared', label: 'Chaveta cortada', kind: 'toggle' },
    { key: 'tensionerWeak', label: 'Tensor flojo', kind: 'severity' },
    { key: 'chainStretch', label: 'Cadena estirada', kind: 'severity' },
    {
      key: 'skippedTeeth',
      label: 'Dientes saltados',
      kind: 'enum',
      options: [-2, -1, 0, 1, 2].map((n) => ({
        value: n,
        label: n === 0 ? 'En punto' : n > 0 ? `${n} atrás` : `${-n} adelantada`,
      })),
    },
  );
  list.push({ key: 'guideBroken', label: 'Guía de la cadena rota', kind: 'toggle' });
  if (VARIANTS[variant].hasRocker) {
    list.push({ key: 'valveLash', label: 'Juego de taqués (tic-tic)', kind: 'severity' });
  }
  if (VARIANTS[variant].hasBelt) {
    list.push({ key: 'beltWear', label: 'Correa gastada', kind: 'severity' });
  }
  return list;
}

export const readouts: readonly ReadoutSpec<FourStrokeState>[] = [
  { id: 'crankAngle', label: 'Ángulo del cigüeñal', unit: '°', decimals: 0, get: (s) => s.crankAngle },
  { id: 'pressure', label: 'Presión del cilindro', unit: 'bar abs', decimals: 1, get: (s) => s.pressure, history: true, gauge: { min: 0, max: 80, green: [1, 70] } },
  { id: 'volume', label: 'Volumen del cilindro', unit: 'cm³', decimals: 0, get: (s) => s.volume },
  { id: 'torque', label: 'Torque del motor', unit: 'N·m', decimals: 0, get: (s) => s.torque, history: true },
  { id: 'viewWork', label: 'Trabajo por ciclo (cil. visto)', unit: 'J', decimals: 0, get: (s) => s.viewWork },
  { id: 'camOffset', label: 'Desfase de la leva', unit: '°', decimals: 1, get: (s) => s.camOffset, history: true, gauge: { min: -20, max: 20, green: [-3, 3] } },
  { id: 'slack', label: 'Holgura de la cadena', unit: '%', decimals: 0, get: (s) => s.slack * 100 },
  { id: 'balance', label: 'Equilibrio entre cilindros', unit: '%', decimals: 0, get: (s) => s.cylinderBalance * 100, gauge: { min: 0, max: 100, green: [97, 100] } },
  { id: 'comp1', label: 'Compresión cil. 1', unit: 'bar', decimals: 1, get: (s) => s.compression[0] ?? 0, gauge: { min: 0, max: 16, green: [11, 15] } },
  { id: 'comp2', label: 'Compresión cil. 2', unit: 'bar', decimals: 1, get: (s) => s.compression[1] ?? 0, gauge: { min: 0, max: 16, green: [11, 15] } },
  { id: 'comp3', label: 'Compresión cil. 3', unit: 'bar', decimals: 1, get: (s) => s.compression[2] ?? 0, gauge: { min: 0, max: 16, green: [11, 15] } },
  { id: 'comp4', label: 'Compresión cil. 4', unit: 'bar', decimals: 1, get: (s) => s.compression[3] ?? 0, gauge: { min: 0, max: 16, green: [11, 15] } },
];

export function presets(variant: FourStrokeVariant): readonly Preset<FourStrokeModel>[] {
  const list: Preset<FourStrokeModel>[] = [
    {
      id: 'healthy',
      label: 'Motor sano a 3000 rpm',
      params: { mode: 'auto', rpm: 3000, throttle: 1, spark: true, sparkAdvance: 25 },
      note: 'A fondo y a régimen: mira el lazo del P-V, las válvulas y el orden 1-3-4-2 en la fase.',
    },
    {
      id: 'slow',
      label: 'Cámara lenta del ciclo',
      params: { mode: 'auto', rpm: 120, throttle: 0, spark: true, sparkAdvance: 10 },
      note: 'A 120 rpm el ciclo se ve tiempo por tiempo: admisión, compresión, expansión y escape.',
    },
    {
      id: 'ring3',
      label: 'Prueba de compresión: anillos gastados en el 3',
      params: { mode: 'auto', rpm: 800, throttle: 0 },
      faults: { ringWear3: 1 },
      setup: { compressionTest: [] },
      note: 'La barra del cilindro 3 queda por debajo de la franja verde: la fuga se mide, no se adivina.',
    },
    {
      id: 'burnt2',
      label: 'Válvula quemada en el 2',
      params: { mode: 'auto', rpm: 800, throttle: 0 },
      faults: { burntValve2: 1 },
      setup: { compressionTest: [] },
      note: 'Compresión baja y trabajo desparejo: el cilindro 2 pierde gases al escape.',
    },
    {
      id: 'keyway',
      label: 'Chavetero ovalado',
      params: { mode: 'auto', rpm: 2500, throttle: 0.8 },
      faults: { keywayWorn: 0.8 },
      note: 'Sube la carga: el piñón baila sobre el cigüeñal, la marca de la leva se separa y se escucha el golpeteo.',
    },
    {
      id: 'bolt',
      label: 'Perno flojo → chaveta cortada',
      params: { mode: 'auto', rpm: 3000, throttle: 1 },
      faults: { crankBoltLoose: true },
      note: 'El chavetero se abre solo (acelerado ×1000) hasta que la chaveta se corta: la leva se queda atrás.',
    },
    {
      id: 'stretch',
      label: 'Cadena estirada',
      params: { mode: 'auto', rpm: 1500, throttle: 0.3 },
      faults: { chainStretch: 1 },
      note: 'La leva va 6° atrasada: el motor pierde fuerza y la marca de sincronización ya no coincide.',
    },
    {
      id: 'tooth',
      label: 'Saltó un diente',
      params: { mode: 'auto', rpm: 1500, throttle: 0.3 },
      faults: { skippedTeeth: 1 },
      note: '17° de atraso: la leva queda fuera de punto pero las válvulas todavía no chocan.',
    },
    {
      id: 'teeth2',
      label: 'Saltaron dos dientes: choque',
      params: { mode: 'auto', rpm: 800, throttle: 0 },
      faults: { skippedTeeth: 2 },
      note: '34° de atraso: las válvulas chocan con el pistón. El cilindro se queda sin compresión.',
    },
  ];
  if (VARIANTS[variant].hasBelt) {
    list.push({
      id: 'belt',
      label: 'Correa gastada',
      params: { mode: 'auto', rpm: 2000, throttle: 0.5, drive: 'belt' },
      faults: { beltWear: 0.85 },
      note: 'La correa atrasa la leva 2,5°; si llega a 0,9 y hay carga, se corta.',
    });
  }
  if (VARIANTS[variant].hydraulicTensioner) {
    list.push({
      id: 'cold',
      label: 'Tensor hidráulico sin presión al partir',
      params: { mode: 'auto', rpm: 800, throttle: 0, oilPressure: 0.2 },
      note: 'En frío la bomba tarda en dar presión: la cadena se comba y golpetea los primeros segundos.',
    });
  }
  return list;
}
