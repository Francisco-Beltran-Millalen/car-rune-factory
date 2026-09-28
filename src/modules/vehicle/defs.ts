// Los dos vehículos genéricos (A15, plan del vehículo §8): mismos sistemas
// que el laboratorio, una variante por sistema, con las regiones del
// diagrama, los buses y la tabla de señales (§6) de cada uno.

import type { VehicleBusDef, VehicleDef, VehicleSignalDef } from '../../sim/vehicle/types.ts';

/** Señales reales del vehículo (dueño ≠ null); el resto cae al stub ideal
 *  (§5.3) — no hace falta listarlas para que el bus funcione, pero si se
 *  quiere que el panel (§9) las muestre con etiqueta, se agregan acá con
 *  `owner: null`. */
function coreSignals(fuelOwner: string): readonly VehicleSignalDef[] {
  return [
    { id: 'engine.state', owner: 'engineCore', unit: '—', label: 'Estado del motor' },
    { id: 'engine.rpm', owner: 'engineCore', unit: 'rpm', label: 'Régimen' },
    { id: 'engine.load', owner: 'engineCore', unit: '0..1', label: 'Carga' },
    { id: 'intake.map', owner: 'engineCore', unit: 'bar', label: 'Vacío del múltiple (provisional)' },
    { id: 'air.massFlow', owner: 'engineCore', unit: 'kg/h', label: 'Caudal de aire (provisional)' },
    { id: 'air.ratio', owner: 'engineCore', unit: 'real/medido', label: 'Aire no medido (provisional)' },
    { id: 'engine.compression', owner: 'fourStroke', unit: '0..1', label: 'Compresión' },
    { id: 'engine.cylinderBalance', owner: 'fourStroke', unit: '0..1', label: 'Balance entre cilindros' },
    { id: 'engine.crankAngle', owner: 'fourStroke', unit: '°', label: 'Ángulo de cigüeñal', latency: 'same-step' },
    { id: 'engine.camAngle', owner: 'fourStroke', unit: '°', label: 'Ángulo de leva', latency: 'same-step' },
    { id: 'fuel.mixture', owner: fuelOwner, unit: 'ratio', label: 'Mezcla' },
    { id: 'ignition.spark', owner: 'ignition', unit: '0..1', label: 'Calidad de la chispa' },
    { id: 'ignition.advance', owner: 'ignition', unit: '° APMS', label: 'Avance' },
    { id: 'ignition.vacuumLeak', owner: 'ignition', unit: 'kg/h', label: 'Fuga de vacío del avance' },
    { id: 'ecu.sync', owner: 'ignition', unit: '0/1', label: 'Sincronía de la ECU' },
    { id: 'lubrication.pressure', owner: 'lubrication', unit: 'bar', label: 'Presión de aceite' },
    { id: 'lubrication.seized', owner: 'lubrication', unit: '0/1', label: 'Motor agarrotado' },
    { id: 'lubrication.viscosity', owner: 'lubrication', unit: 'cSt', label: 'Viscosidad del aceite' },
    { id: 'engine.coolantTemp', owner: 'cooling', unit: '°C', label: 'Temperatura del refrigerante' },
    { id: 'cooling.boiling', owner: 'cooling', unit: '0/1', label: 'Ebullición' },
    // Stubs (tareas del bloque S2, §5.3): sin dueño todavía.
    { id: 'exhaust.backpressure', owner: null, unit: 'bar', label: 'Contrapresión de escape (stub)' },
    { id: 'electrical.crankVoltage', owner: null, unit: 'V', label: 'Tensión de arranque (stub)' },
    { id: 'vehicle.speed', owner: null, unit: 'km/h', label: 'Velocidad (stub)' },
  ];
}

const BUSES_12V_IGNITION: readonly VehicleBusDef[] = [
  { id: '12v', domain: 'electric', provider: 'ignition' },
  { id: 'chassis', domain: 'electric', provider: null },
];

const BUSES_12V_FUEL: readonly VehicleBusDef[] = [
  { id: '12v', domain: 'electric', provider: 'fuel' },
  { id: 'chassis', domain: 'electric', provider: null },
];

// Grilla de 2 columnas × 3 filas (cada laboratorio trae su propio viewBox de
// hasta 1300×720; con 1400×800 por celda no se pisan entre sí).
const COL = 1400;
const ROW = 800;
const GRID = {
  fourStroke: [40, 40] as const,
  alimentacion: [40 + COL, 40] as const,
  ignition: [40, 40 + ROW] as const,
  cooling: [40 + COL, 40 + ROW] as const,
  lubrication: [40, 40 + 2 * ROW] as const,
};
const VIEW_BOX = [0, 0, 40 + 2 * COL, 40 + 3 * ROW] as const;

export const VEHICLE_70: VehicleDef = {
  id: 'vehicle-70',
  title: 'Auto años 70 (carburador y platinos)',
  summary: 'Los sistemas de un auto de los 70 compartiendo el mismo motor y la misma batería.',
  viewBox: VIEW_BOX,
  systems: [
    { id: 'four-stroke', kind: 'mechanism', circuit: 'four-stroke-ohv', at: GRID.fourStroke },
    { id: 'carburetor', kind: 'circuit', circuit: 'carburetor', at: GRID.alimentacion },
    { id: 'ignition', kind: 'circuit', circuit: 'ignition-points', at: GRID.ignition },
    { id: 'cooling', kind: 'circuit', circuit: 'cooling-viscous', at: GRID.cooling },
    { id: 'lubrication', kind: 'circuit', circuit: 'lubrication-gauge', at: GRID.lubrication },
  ],
  buses: BUSES_12V_IGNITION,
  signals: coreSignals('carburetor'),
};

export const VEHICLE_2000: VehicleDef = {
  id: 'vehicle-2000',
  title: 'Auto años 2000 (inyección y COP)',
  summary: 'Los sistemas de un auto moderno compartiendo el mismo motor y la misma batería.',
  viewBox: VIEW_BOX,
  systems: [
    { id: 'four-stroke', kind: 'mechanism', circuit: 'four-stroke-dohc', at: GRID.fourStroke },
    { id: 'fuel', kind: 'circuit', circuit: 'fuel-return', at: GRID.alimentacion },
    { id: 'ignition', kind: 'circuit', circuit: 'ignition-cop', at: GRID.ignition },
    { id: 'cooling', kind: 'circuit', circuit: 'cooling-electric', at: GRID.cooling },
    { id: 'lubrication', kind: 'circuit', circuit: 'lubrication-lamp', at: GRID.lubrication },
  ],
  buses: BUSES_12V_FUEL,
  signals: coreSignals('fuel'),
};
