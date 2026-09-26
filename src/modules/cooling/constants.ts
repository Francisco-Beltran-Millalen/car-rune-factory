// Constantes y variantes de la refrigeración (A13, spec cooling §5). Puro (§1).

export type CoolingVariant = 'viscous' | 'electric';

export interface CoolingVariantInfo {
  id: string;
  title: string;
  summary: string;
  order: number;
  electricFan: boolean;
}

export const VARIANTS: Readonly<Record<CoolingVariant, CoolingVariantInfo>> = {
  viscous: {
    id: 'cooling-viscous',
    title: 'Refrigeración años 70 (viscoso)',
    summary:
      'Bomba centrífuga, termostato, radiador y ventilador mecánico con embrague viscoso: el motor tarda en calentar y el viscoso acopla con el radiador caliente.',
    order: 6,
    electricFan: false,
  },
  electric: {
    id: 'cooling-electric',
    title: 'Refrigeración años 2000 (electroventilador)',
    summary:
      'Bomba centrífuga, termostato, radiador y electroventilador con termocontacto: la temperatura se mantiene sola salvo que algo falle.',
    order: 7,
    electricFan: true,
  },
};

export const K = {
  // ─── Hidráulica ────────────────────────────────────────────────────────
  qPumpMax: 9000,
  pPumpMax: 1.5,
  pumpNRef: 6000,
  /** Camisa: 0,5 bar a 9000 L/h. */
  kJacket: 6e-9,
  /** Termostato abierto: 9000 L/h a 0,4 bar. */
  gThermostatOpen: 9000 / Math.sqrt(0.4),
  thermostatLeak: 0.01,
  /** Radiador: 0,2 bar a 9000 L/h. */
  kRadiator: 2.5e-9,
  tubeClogK: 30,
  kBypass: 4e-8,
  gHeaterOpen: 900 / Math.sqrt(0.5),
  kHeaterCore: 8e-7,
  kPumpLeak: 3,
  kHoseLeak: 40,
  // ─── Térmico ───────────────────────────────────────────────────────────
  cEngine: 50000,
  cRadiator: 8000,
  cHeater: 1000,
  heatBase: 3000,
  heatSpan: 45000,
  /** mc = 1,05·q[L/h] (W/K): 1,05 kg/L y 4180 J/(kg·K) redondeados a 1,05. */
  mcPerLh: 1.05,
  gEngineAmbient: 8,
  uaBase: 30,
  uaSpan: 770,
  airTau: 12,
  finsUa: 0.8,
  tubesUa: 0.4,
  gCabin: 100,
  fastThermal: 20,
  // ─── Ventilador ────────────────────────────────────────────────────────
  fanOnC: 100,
  fanOffC: 95,
  fanAirMax: 7,
  fanAirMaxViscous: 9,
  fanMotorR: 1.3,
  fanCurrentRef: 10,
  fanOnRpmRef: 3000,
  clutchMin: 0.3,
  clutchSpan: 0.6,
  clutchTRef: 60,
  clutchTSpan: 25,
  clutchMax: 0.9,
  clutchWorn: 0.6,
  // ─── Sistema ───────────────────────────────────────────────────────────
  levelFull: 7,
  levelAir: 5.5,
  levelAirSpan: 1.5,
  boilBase: 107,
  boilPerBar: 20,
  boilAirSpan: 5,
  pressureK: 0.016,
  pressureMax: 1.1,
  pressureT0: 20,
  sensorColdC: 30,
  /** Si no llega señal del sensor, el reloj cae al mínimo. */
  sensorOpenC: -40,
  thermostatTau: 5,
  maxRpm: 6500,
} as const;
