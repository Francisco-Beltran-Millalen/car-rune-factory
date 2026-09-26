// Controles, fallas, lecturas y presets de la refrigeración (A13; spec §3, §7, §10).

import type { ControlSpec, FaultSpec, Preset, ReadoutSpec } from '../../core/types.ts';
import type { CoolingModel } from './circuit.ts';
import { VARIANTS, type CoolingVariant } from './constants.ts';
import type { CoolingState } from './controllers.ts';

export function controls(variant: CoolingVariant): readonly ControlSpec<CoolingModel>[] {
  const list: ControlSpec<CoolingModel>[] = [
    { type: 'slider', key: 'rpm', label: 'RPM', min: 0, max: 6500, step: 50, unit: 'rpm', group: 'Motor (stub)' },
    { type: 'slider', key: 'load', label: 'Carga', min: 0, max: 1, step: 0.05, group: 'Motor (stub)' },
    { type: 'slider', key: 'vehicleSpeedKmh', label: 'Velocidad', min: 0, max: 160, step: 5, unit: 'km/h', group: 'Marcha (stub)' },
    { type: 'slider', key: 'ambientC', label: 'Ambiente', min: -10, max: 45, step: 1, unit: '°C', group: 'Ambiente' },
    { type: 'toggle', key: 'heaterOn', label: 'Calefactor', group: 'Ambiente' },
    { type: 'toggle', key: 'fastThermal', label: 'Calentamiento ×20', group: 'Ambiente' },
    { type: 'button', action: 'topUp', label: 'Rellenar refrigerante', group: 'Sistema' },
  ];
  if (VARIANTS[variant].electricFan) {
    list.push({ type: 'slider', key: 'batteryV', label: 'Batería', min: 10, max: 14.5, step: 0.1, unit: 'V', group: 'Ventilador' });
  }
  list.push({ type: 'button', action: 'setEngineTemp', label: 'Poner motor a 90 °C', group: 'Pruebas' });
  return list;
}

export function faults(variant: CoolingVariant): readonly FaultSpec[] {
  const list: FaultSpec[] = [
    {
      key: 'thermostat',
      label: 'Termostato',
      kind: 'enum',
      options: [
        { value: 'ok', label: 'Bien' },
        { value: 'stuckOpen', label: 'Pegado abierto' },
        { value: 'stuckClosed', label: 'Pegado cerrado' },
      ],
    },
    { key: 'pumpWear', label: 'Bomba gastada', kind: 'severity' },
    { key: 'pumpLeak', label: 'Bomba pierde por el testigo', kind: 'severity' },
    { key: 'hoseLeak', label: 'Manguera inferior rota', kind: 'severity' },
    { key: 'beltSlip', label: 'Correa de la bomba patina', kind: 'severity' },
    { key: 'finsClog', label: 'Panal tapado', kind: 'severity' },
    { key: 'tubesClog', label: 'Tubos con sarro', kind: 'severity' },
    { key: 'capFailed', label: 'Tapa que no sostiene presión', kind: 'toggle' },
    { key: 'heaterClog', label: 'Calefactor tapado', kind: 'severity' },
    { key: 'fanDead', label: 'Ventilador muerto', kind: 'toggle' },
    {
      key: 'sensorFault',
      label: 'Sensor de temperatura',
      kind: 'enum',
      options: [
        { value: 'ok', label: 'Bien' },
        { value: 'readsCold', label: 'Marca 30 °C menos' },
        { value: 'open', label: 'Sin señal (mínimo)' },
      ],
    },
  ];
  if (variant === 'viscous') {
    list.push({ key: 'fanClutchWorn', label: 'Embrague viscoso gastado', kind: 'severity' });
  } else {
    list.push({ key: 'fanSwitchDead', label: 'Termocontacto muerto', kind: 'toggle' });
  }
  return list;
}

export function readouts(variant: CoolingVariant): readonly ReadoutSpec<CoolingState>[] {
  const list: ReadoutSpec<CoolingState>[] = [
    { id: 'engineTemp', label: 'Temperatura del motor', unit: '°C', decimals: 1, get: (s) => s.engineTemp, history: true, gauge: { min: 0, max: 130, green: [85, 100] } },
    { id: 'gaugeTemp', label: 'Lo que marca el reloj', unit: '°C', decimals: 1, get: (s) => s.gaugeTemp, history: true },
    { id: 'radiatorTemp', label: 'Temperatura del radiador', unit: '°C', decimals: 1, get: (s) => s.radiatorTemp, history: true },
    { id: 'thermostat', label: 'Apertura del termostato', unit: '%', decimals: 0, get: (s) => s.thermostatOpen * 100 },
    { id: 'qPump', label: 'Caudal de la bomba', unit: 'L/min', decimals: 1, get: (s) => s.qPump / 60, history: true },
    { id: 'qRadiator', label: 'Caudal por el radiador', unit: 'L/min', decimals: 1, get: (s) => s.qRadiator / 60, history: true },
    { id: 'pSystem', label: 'Presión del sistema', unit: 'bar', decimals: 2, get: (s) => s.pSystem, history: true },
    { id: 'boilPoint', label: 'Punto de ebullición', unit: '°C', decimals: 0, get: (s) => s.boilPoint },
    { id: 'level', label: 'Nivel', unit: 'L', decimals: 2, get: (s) => s.level },
    { id: 'heatIn', label: 'Calor que entra', unit: 'kW', decimals: 1, get: (s) => s.heatIn / 1000, history: true },
    { id: 'heatOut', label: 'Calor que sale', unit: 'kW', decimals: 1, get: (s) => s.heatRadiator, history: true },
  ];
  if (variant === 'electric') {
    list.push(
      { id: 'fanCurrent', label: 'Corriente del ventilador', unit: 'A', decimals: 1, get: (s) => s.fanCurrent, history: true },
      { id: 'fanAir', label: 'Aire del ventilador', unit: 'm/s', decimals: 1, get: (s) => s.fanAir },
    );
  } else {
    list.push({ id: 'fanAir', label: 'Aire del ventilador', unit: 'm/s', decimals: 1, get: (s) => s.fanAir, history: true });
  }
  return list;
}

export function presets(_variant: CoolingVariant): readonly Preset<CoolingModel>[] {
  return [
    {
      id: 'warmup',
      label: 'Calentar desde frío',
      params: { rpm: 800, load: 0, ambientC: 25, fastThermal: true },
      note: 'Las partículas van del azul al rojo; primero todo gira por el bypass y a ~88 °C abre el termostato.',
    },
    {
      id: 'summer',
      label: 'Ralentí en verano',
      params: { rpm: 800, load: 0, ambientC: 35 },
      note: 'Con 35 °C de ambiente el motor se estabiliza justo antes de que prenda el ventilador.',
    },
    {
      id: 'traffic',
      label: 'Tráfico con el ventilador muerto',
      params: { rpm: 1200, load: 0.15, vehicleSpeedKmh: 0, ambientC: 30, fastThermal: true },
      faults: { fanDead: true },
      note: 'Sin aire de marcha ni ventilador la temperatura sube y pasa los 105 °C.',
    },
    {
      id: 'winter-open',
      label: 'Termostato pegado abierto en invierno',
      params: { rpm: 2500, load: 0.3, vehicleSpeedKmh: 90, ambientC: 5, fastThermal: true },
      faults: { thermostat: 'stuckOpen' },
      note: 'El radiador enfría todo el tiempo: el motor no llega a temperatura de trabajo.',
    },
    {
      id: 'closed',
      label: 'Termostato pegado cerrado',
      params: { rpm: 3000, load: 0.5, vehicleSpeedKmh: 100, ambientC: 25, fastThermal: true },
      faults: { thermostat: 'stuckClosed' },
      note: 'Sin circulación por el radiador la temperatura se dispara y el refrigerante hierve.',
    },
    {
      id: 'clogged',
      label: 'Panal tapado subiendo una cuesta',
      params: { rpm: 5000, load: 0.9, vehicleSpeedKmh: 60, ambientC: 30, fastThermal: true },
      faults: { finsClog: 0.7 },
      note: 'El panal sucio no entrega calor: a fondo en subida la temperatura se va.',
    },
    {
      id: 'leak',
      label: 'Manguera rota',
      params: { rpm: 1500, load: 0.3, ambientC: 25 },
      faults: { hoseLeak: 1 },
      setup: { setEngineTemp: [90] },
      note: 'Gotea, baja el nivel del depósito y cuando la bomba aspira aire la temperatura sube.',
    },
    {
      id: 'liar',
      label: 'El reloj miente',
      params: { rpm: 1200, load: 0.15, ambientC: 30, fastThermal: true },
      faults: { sensorFault: 'readsCold', fanSwitchDead: true },
      note: 'El motor está recalentando pero el reloj marca 30 °C menos: el termocontacto nunca prende el ventilador.',
    },
  ];
}
