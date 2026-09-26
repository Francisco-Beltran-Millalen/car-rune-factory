// Distribución (A11, spec four-stroke §5.2/§5.6/§5.7): fase de la leva,
// chavetero, holgura de la cadena y salto de dientes. Puro (§1).

import { clamp } from '../../core/math.ts';
import type { Rng } from '../../core/rng.ts';
import { K } from './constants.ts';
import type { DriveType } from './constants.ts';

export interface TimingFaults {
  crankBoltLoose: boolean;
  keywayWorn: number;
  keySheared: boolean;
  tensionerWeak: number;
  guideBroken: boolean;
  chainStretch: number;
  skippedTeeth: number;
  beltWear: number;
}

export interface TimingState {
  /** Desfase de la leva en ° de cigüeñal (+ = atraso). */
  camOffset: number;
  slack: number;
  /** Juego del piñón por el chavetero (°). */
  keywayPlay: number;
  keywayDamage: number;
  keyShearedState: boolean;
  /** Dientes que saltaron por la holgura (suma a `skippedTeeth`). */
  teethJumped: number;
  beltSnapped: boolean;
  slip: number;
  knock: number;
  rattle: number;
  beltLoadTime: number;
  lastRev: number;
}

export interface TimingInputs {
  dt: number;
  /** Ángulo del cigüeñal envuelto a 0..720. */
  crankDeg: number;
  rpm: number;
  load: number;
  oilPressure: number;
  /** Tensor hidráulico (DOHC) o de resorte (OHV). */
  hydraulic: boolean;
  drive: DriveType;
  faults: TimingFaults;
  rng: Rng;
  prevRpm: number;
}

export function createTimingState(): TimingState {
  return {
    camOffset: 0,
    slack: 0,
    keywayPlay: 0,
    keywayDamage: 0,
    keyShearedState: false,
    teethJumped: 0,
    beltSnapped: false,
    slip: 0,
    knock: 0,
    rattle: 0,
    beltLoadTime: 0,
    lastRev: 0,
  };
}

/**
 * Un paso de la distribución. `load` es `engine.load` (0..1); el daño del
 * perno flojo va acelerado ×1000 (spec §5.6) y se dice en la narración.
 */
export function stepTiming(state: TimingState, inputs: TimingInputs): TimingState {
  const { dt, rpm, load, faults, rng } = inputs;
  const next: TimingState = { ...state };
  const turning = rpm > 0;

  if (faults.crankBoltLoose && turning) {
    next.keywayDamage = clamp(
      state.keywayDamage + K.boltDamageRate * (rpm / 3000) * (0.5 + load) * dt,
      0,
      1,
    );
  }
  if (next.keywayDamage >= 1) next.keyShearedState = true;

  const sheared = faults.keySheared || next.keyShearedState;
  if (sheared && turning) {
    next.slip = state.slip + K.shearSlipRate * (0.2 + load) * dt;
  }

  if (inputs.drive === 'belt') {
    if (faults.beltWear >= K.beltBreakWear && load > K.beltBreakLoad) {
      next.beltLoadTime = state.beltLoadTime + dt;
    } else {
      next.beltLoadTime = 0;
    }
    if (next.beltLoadTime >= K.beltBreakTime) next.beltSnapped = true;
  }

  next.keywayPlay = K.keywayDeg * Math.max(clamp(faults.keywayWorn, 0, 1), next.keywayDamage);
  next.slack = clamp(
    clamp(faults.tensionerWeak, 0, 1) +
      (faults.guideBroken ? 0.5 : 0) +
      (inputs.hydraulic
        ? K.hydraulicSlack * (1 - clamp(inputs.oilPressure / K.oilFull, 0, 1))
        : 0),
    0,
    1,
  );

  if (next.slack > K.jumpSlack && dt > 0 && turning) {
    const accel = (rpm - inputs.prevRpm) / dt;
    if (Math.abs(accel) > K.jumpAccel && rng.chance(K.jumpChance)) {
      next.teethJumped = state.teethJumped + Math.sign(accel);
    }
  }

  const crankRad = (inputs.crankDeg * Math.PI) / 180;
  const jitter = K.jitterDeg * next.slack * Math.sin(2 * crankRad);
  const wobble = K.keywayWobble * next.keywayPlay * Math.sin(2 * crankRad);
  const keywayOffset = next.keywayPlay * (K.keywayBase + K.keywayLoad * load) + wobble;
  let camOffset =
    K.toothDeg * (faults.skippedTeeth + next.teethJumped) +
    K.chainStretchDeg * clamp(faults.chainStretch, 0, 1) +
    K.beltWearDeg * clamp(faults.beltWear, 0, 1) +
    keywayOffset +
    next.slip +
    jitter;
  if (next.beltSnapped && turning) camOffset += (rpm / 60) * 360 * dt;
  next.camOffset = camOffset;

  const rev = Math.floor(inputs.crankDeg / 360);
  next.knock =
    next.keywayPlay > K.knockPlay
      ? rev !== state.lastRev
        ? 1
        : Math.max(0, state.knock - dt * 3)
      : 0;
  next.lastRev = rev;
  next.rattle = next.slack > K.rattleSlack ? next.slack : 0;
  return next;
}
