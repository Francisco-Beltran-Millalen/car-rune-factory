// Transitorio de la bencina y bomba de aceleración (A16, spec carburetor
// §5.3). Puro (§1); el estado lo guarda y avanza quien llama (el controlador
// `carbCore` o un test).

import { expSmooth } from '../../core/math.ts';
import { K } from './constants.ts';

export interface TransientState {
  /** Bencina que realmente llega (kg/h), sigue a la pedida con retraso. */
  qReal: number;
  /** Aporte de la bomba de aceleración (adimensional, se suma a la mezcla). */
  accelBoost: number;
}

export const INITIAL_TRANSIENT: TransientState = { qReal: 0, accelBoost: 0 };

export interface TransientInputs {
  /** Proporción de régimen (§5.2). */
  r: number;
  /** `ṁa` (kg/h). */
  airMassFlow: number;
  /** `dThrottle/dt` (1/s); sólo cuenta cuando la mariposa abre. */
  dThrottle: number;
  accelPumpFailed: boolean;
}

/** Avanza `qReal` y `accelBoost` un paso `dt` (spec §5.3). */
export function stepTransient(
  state: TransientState,
  dt: number,
  inputs: TransientInputs,
): TransientState {
  const qPedida = (inputs.r * inputs.airMassFlow) / 13;
  const qReal = state.qReal + ((qPedida - state.qReal) * dt) / K.transientTau;
  let boost = state.accelBoost;
  if (!inputs.accelPumpFailed) {
    boost += K.accelGain * Math.max(0, inputs.dThrottle) * dt;
  }
  boost = expSmooth(boost, 0, dt, K.accelTau);
  return { qReal, accelBoost: boost };
}

/**
 * Mezcla publicada (§5.3, guarda §6): con `ṁa < 0,5 kg/h` (motor detenido) es
 * 0 y no se divide. `delivered` es la bencina que de verdad sale por los
 * surtidores (kg/h; ya con el límite de la cuba, spec §5.4).
 */
export function mixtureOf(delivered: number, airMassFlow: number, accelBoost: number): number {
  if (airMassFlow < K.airMassMin) return 0;
  return delivered / (airMassFlow / 13) + accelBoost;
}
