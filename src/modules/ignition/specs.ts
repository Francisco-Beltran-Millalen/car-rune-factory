// Controles, fallas, lecturas y presets del encendido (A12; spec §3, §7, §10).

import type { ControlSpec, FaultSpec, Preset, ReadoutSpec } from '../../core/types.ts';
import type { IgnitionModel } from './circuit.ts';
import type { IgnitionVariant } from './constants.ts';
import type { IgnitionState } from './core.ts';

export function controls(variant: IgnitionVariant): readonly ControlSpec<IgnitionModel>[] {
  const list: ControlSpec<IgnitionModel>[] = [
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
    { type: 'slider', key: 'rpm', label: 'RPM', min: 0, max: 6500, step: 50, unit: 'rpm', group: 'Motor (stub)' },
    { type: 'slider', key: 'throttle', label: 'Acelerador', min: 0, max: 1, step: 0.05, group: 'Motor (stub)' },
    { type: 'slider', key: 'compression', label: 'Compresión', min: 0, max: 1, step: 0.05, group: 'Motor (stub)' },
    { type: 'slider', key: 'batteryV', label: 'Batería', min: 9, max: 14.5, step: 0.1, unit: 'V', group: 'Eléctrico' },
    {
      type: 'slider',
      key: 'camOffset',
      label: 'Desfase de la leva (prueba)',
      min: -20,
      max: 20,
      step: 1,
      unit: '°',
      group: 'Prueba',
    },
  ];
  if (variant === 'points') {
    list.push({ type: 'slider', key: 'humidity', label: 'Humedad ambiente', min: 0, max: 1, step: 0.05, group: 'Prueba' });
  } else {
    list.push({ type: 'slider', key: 'dwellMs', label: 'Tiempo de carga (dwell)', min: 1, max: 6, step: 0.1, unit: 'ms', group: 'ECU' });
  }
  return list;
}

export function faults(variant: IgnitionVariant): readonly FaultSpec[] {
  const list: FaultSpec[] = [
    { key: 'plugGapWear', label: 'Bujías gastadas (separación)', kind: 'severity' },
    { key: 'plugFouled2', label: 'Bujía 2 engrasada', kind: 'severity' },
    { key: 'coilWeak', label: 'Bobina débil', kind: 'severity' },
  ];
  if (variant === 'points') {
    list.push(
      { key: 'pointsGap', label: 'Platinos muy abiertos', kind: 'severity' },
      { key: 'pointsPitted', label: 'Contactos picados', kind: 'severity' },
      { key: 'condenserOpen', label: 'Condensador abierto', kind: 'toggle' },
      { key: 'condenserShorted', label: 'Condensador en corto', kind: 'toggle' },
      { key: 'ballastOpen', label: 'Balasto cortado', kind: 'toggle' },
      { key: 'capCracked', label: 'Tapa fisurada', kind: 'severity' },
      { key: 'rotorWorn', label: 'Rotor gastado', kind: 'severity' },
      { key: 'htLead3Open', label: 'Cable del cilindro 3 cortado', kind: 'toggle' },
      { key: 'centrifugalStuck', label: 'Avance centrífugo trabado', kind: 'toggle' },
      { key: 'vacuumDiaphragm', label: 'Diafragma del avance roto', kind: 'toggle' },
    );
  } else {
    list.push(
      { key: 'crankSensorDead', label: 'Sensor de cigüeñal muerto', kind: 'toggle' },
      { key: 'crankSensorGap', label: 'Sensor de cigüeñal con separación', kind: 'severity' },
      { key: 'camSensorDead', label: 'Sensor de leva muerto', kind: 'toggle' },
      { key: 'coil2Dead', label: 'Bobina 2 muerta', kind: 'toggle' },
      { key: 'igniterDead', label: 'Igniter muerto', kind: 'toggle' },
    );
  }
  return list;
}

export function readouts(variant: IgnitionVariant): readonly ReadoutSpec<IgnitionState>[] {
  const list: ReadoutSpec<IgnitionState>[] = [
    { id: 'advance', label: 'Avance (en el cigüeñal)', unit: '° APMS', decimals: 1, get: (s) => s.advance, history: true },
    { id: 'coilV', label: 'Tensión de la bobina', unit: 'V', decimals: 2, get: (s) => s.coilV, history: true, gauge: { min: 0, max: 15, green: [11.5, 14.5] } },
    { id: 'iBreak', label: 'Corriente al corte', unit: 'A', decimals: 2, get: (s) => s.iBreak },
    { id: 'energy', label: 'Energía de la chispa', unit: 'mJ', decimals: 1, get: (s) => s.energy },
    { id: 'vAvail', label: 'Voltaje disponible', unit: 'kV', decimals: 1, get: (s) => s.vAvail, history: true },
    { id: 'vReq', label: 'Voltaje pedido', unit: 'kV', decimals: 1, get: (s) => s.vReq, history: true },
    { id: 'spark', label: 'Chispas buenas', unit: '%', decimals: 0, get: (s) => s.sparkRate * 100, history: true, gauge: { min: 0, max: 100, green: [98, 100] } },
    { id: 'busCurrent', label: 'Corriente del bus', unit: 'A', decimals: 2, get: (s) => s.busCurrent, history: true },
    { id: 'arc', label: 'Duración del arco', unit: 'ms', decimals: 2, get: (s) => s.arcMs },
  ];
  if (variant === 'cop') {
    list.push(
      { id: 'syncRpm', label: 'RPM de sincronía', unit: 'rpm', decimals: 0, get: (s) => s.syncRpm },
      { id: 'p0016', label: 'Código P0016', unit: '', decimals: 0, get: (s) => (s.codes.includes('P0016') ? 1 : 0) },
      { id: 'p0340', label: 'Código P0340', unit: '', decimals: 0, get: (s) => (s.codes.includes('P0340') ? 1 : 0) },
    );
  } else {
    list.push({ id: 'pitting', label: 'Picado de los platinos', unit: '%', decimals: 0, get: (s) => s.pitting * 100 });
  }
  return list;
}

export function presets(variant: IgnitionVariant): readonly Preset<IgnitionModel>[] {
  if (variant === 'points') {
    return [
      {
        id: 'idle',
        label: 'Sano en ralentí',
        params: { ignitionKey: 'run', rpm: 800, throttle: 0 },
        note: 'Mirá la leva abrir y cerrar los platinos y cada bujía destellar en su turno (1-3-4-2).',
      },
      {
        id: 'cruise',
        label: 'Crucero (se ve el avance por vacío)',
        params: { ignitionKey: 'run', rpm: 3000, throttle: 0.3, compression: 1 },
        note: 'Con la mariposa entreabierta la cápsula de vacío adelanta la chispa: el avance pasa de 8° a ~44°.',
      },
      {
        id: 'ballast',
        label: 'Arranca y se apaga al soltar la llave',
        params: { ignitionKey: 'start', rpm: 800, throttle: 0 },
        faults: { ballastOpen: true },
        note: 'En arranque el balasto se puentea y hay chispa; al pasar a Marcha, no llega corriente a la bobina.',
      },
      {
        id: 'high',
        label: 'Falla en alta: bujías gastadas',
        params: { ignitionKey: 'run', rpm: 6000, throttle: 1 },
        faults: { plugGapWear: 1 },
        note: 'A fondo la bobina no alcanza el voltaje que pide la bujía; en ralentí sí enciende.',
      },
      {
        id: 'condenser',
        label: 'Condensador malo',
        params: { ignitionKey: 'run', rpm: 3000, throttle: 0.3 },
        faults: { condenserOpen: true },
        note: 'Sin condensador los platinos hacen arco: la chispa es débil y los contactos se van picando.',
      },
      {
        id: 'late',
        label: 'Leva atrasada 10°: la chispa también',
        params: { ignitionKey: 'run', rpm: 1500, throttle: 0.2, camOffset: 10 },
        note: 'El distribuidor gira con la leva: si la leva va atrasada, la chispa también (el avance baja 10°).',
      },
    ];
  }
  return [
    {
      id: 'healthy',
      label: 'Sano',
      params: { ignitionKey: 'run', rpm: 800, throttle: 0 },
      note: 'La rueda 60-2 gira, la ECU sincroniza y cada bobina enciende su cilindro.',
    },
    {
      id: 'crank-dead',
      label: 'Sensor de cigüeñal muerto',
      params: { ignitionKey: 'run', rpm: 800, throttle: 0 },
      faults: { crankSensorDead: true },
      note: 'Sin señal de cigüeñal la ECU no sabe cuándo encender: no hay chispa ni inyección.',
    },
    {
      id: 'coil2',
      label: 'Bobina 2 muerta',
      params: { ignitionKey: 'run', rpm: 1500, throttle: 0.3 },
      faults: { coil2Dead: true },
      note: 'El cilindro 2 no enciende: mirá su bujía, que se queda gris.',
    },
    {
      id: 'late',
      label: 'Leva atrasada 10°: chispa bien, código P0016',
      params: { ignitionKey: 'run', rpm: 1500, throttle: 0.2, camOffset: 10 },
      note: 'El sensor de cigüeñal manda la chispa; la ECU compara con la leva y deja P0016.',
    },
    {
      id: 'gap',
      label: 'Cuesta partir: sensor con mucha separación',
      params: { ignitionKey: 'run', rpm: 250, throttle: 0 },
      faults: { crankSensorGap: 1 },
      note: 'Con la separación máxima no sincroniza hasta ~500 rpm: gira y no parte.',
    },
  ];
}
