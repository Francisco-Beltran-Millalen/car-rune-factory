// Entradas ideales de los sistemas que el laboratorio del combustible todavía
// no simula (§29). En el vehículo (A10) se reemplazan por las señales reales.

export interface EngineInputs {
  /** 0..1, calidad de la chispa (encendido). */
  spark: number;
  /** 0..1, aire de admisión disponible (admisión). */
  airOk: number;
  /** 0..1, compresión del cilindro (4 tiempos). */
  compression: number;
  /** bar, presión de aceite (lubricación). */
  oilPressure: number;
  /** °C, temperatura del refrigerante (refrigeración). */
  coolantTemp: number;
  /** V, tensión de la batería durante el arranque (eléctrico). */
  crankVoltage: number;
}

/** Stubs ideales del laboratorio: el motor parte si la mezcla es buena. */
export const IDEAL_INPUTS: EngineInputs = {
  spark: 1,
  airOk: 1,
  compression: 1,
  oilPressure: 3,
  coolantTemp: 90,
  crankVoltage: 12.6,
};

export function createIdealInputs(): EngineInputs {
  return { ...IDEAL_INPUTS };
}
