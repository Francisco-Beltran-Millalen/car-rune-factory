// Física del venturi y los circuitos (A16, spec carburetor §5.2). Puro (§1).

import { clamp } from '../../core/math.ts';
import { K } from './constants.ts';

/** Depresión del venturi (bar): `Δpv = kv·ṁa²`. */
export function venturiDp(airMassFlow: number): number {
  const a = Math.max(0, airMassFlow);
  return K.kv * a * a;
}

/** Altura de la bencina bajo el surtidor (bar): una cuba más llena "acerca"
 *  la bencina a la boca. */
export function bowlHeight(bowlLevel: number): number {
  return K.hBase * (1 - (bowlLevel - K.hLevelRef) / K.hLevelSpan);
}

/** Fracción del circuito principal: `φ = √⁺(1 − h/Δpv)`. */
export function mainFraction(dpv: number, h: number): number {
  if (dpv <= h) return 0;
  return Math.sqrt(1 - h / dpv);
}

/** Vaporización (0..1) según la temperatura del motor. */
export function vaporization(tempC: number): number {
  return K.vapFloor + K.vapSpan * clamp((tempC - K.vapMinTempC) / K.vapSpanTempC, 0, 1);
}

export interface MixtureInputs {
  /** Fracción del principal (§5.2). */
  phi: number;
  mainJetClog: number;
  idleJetClog: number;
  idleScrew: number;
  /** Nivel de la cuba (L). */
  bowlLevel: number;
  /** `choke` del param, o lo que fije la falla `choke.stuck`. */
  chokeEf: number;
  tempC: number;
}

/**
 * Proporción de régimen `r` (1 = la mezcla calibrada): por construcción vale
 * 1 en cualquier rpm/mariposa cuando el carburador está sano (spec §1, §4 del
 * plan); las fallas y el tornillo la sacan de 1 sólo en su zona.
 */
export function mixtureRatio(inputs: MixtureInputs): number {
  const { phi, mainJetClog, idleJetClog, idleScrew, bowlLevel, chokeEf, tempC } = inputs;
  let r = phi * (1 - 0.9 * mainJetClog) + (1 - phi) * idleScrew * (1 - idleJetClog);
  r *= 1 + 25 * Math.max(0, bowlLevel - K.bowlHighRef);
  if (bowlLevel >= K.bowlFloodLevel) r += 1;
  r *= 1 + chokeEf;
  r *= vaporization(tempC);
  return r;
}
