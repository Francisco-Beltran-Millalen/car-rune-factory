// Modelo analítico por eventos del encendido (A12, spec ignition §5.1–§5.4).
// Puro (§1): sin solver ni estado; el controlador lo llama por paso.

import { clamp, wrap } from '../../core/math.ts';
import { cylinderVolume, INTAKE_CLOSE_DEG } from '../../sim/engine/geometry.ts';
import { FIRING_OFFSETS, IG } from './constants.ts';

export interface SparkEvent {
  /** 1..4. */
  cylinder: number;
  /** Corrimiento dentro del paso (° de referencia). */
  offset: number;
}

/** Cortes de chispa en `[refDeg, refDeg + dDeg)` (spec §5.1). */
export function sparkEvents(
  refDeg: number,
  dDeg: number,
  advance: number,
  wasted = false,
): SparkEvent[] {
  if (!(dDeg > 0)) return [];
  const out: SparkEvent[] = [];
  for (let i = 0; i < 4; i++) {
    const base = wrap(360 - advance + (FIRING_OFFSETS[i] ?? 0), 720);
    const rel = wrap(base - refDeg, 720);
    if (rel < dDeg) out.push({ cylinder: i + 1, offset: rel });
    if (wasted) {
      const rel2 = wrap(base + 360 - refDeg, 720);
      if (rel2 < dDeg) out.push({ cylinder: i + 1, offset: rel2 });
    }
  }
  return out.sort((a, b) => a.offset - b.offset);
}

/** Avance de platinos (° APMS medido en la leva; spec §5.2). */
export function pointsAdvance(rpm: number, map: number, throttle: number, pointsGap: number): number {
  const cent = IG.centrifugalMax * clamp((rpm - 1000) / 2000, 0, 1);
  const vac = throttle > 0.02 ? IG.vacuumMax * clamp((-map - 0.2) / 0.35, 0, 1) : 0;
  return IG.pointsBase + cent + vac + IG.pointsGapAdvance * clamp(pointsGap, 0, 1);
}

/** Avance del mapa de la ECU (spec §5.2). */
export function copAdvance(rpm: number, map: number): number {
  return (
    IG.copBase +
    IG.copRpmAdvance * clamp((rpm - 800) / 2800, 0, 1) +
    IG.copVacAdvance * clamp(-map / 0.65, 0, 1)
  );
}

/** Duración del dwell (s). */
export function dwellSeconds(dwellMs: number, rpm: number, points: boolean): number {
  const period = 30 / Math.max(rpm, 1); // 180° de cigüeñal
  return points ? IG.pointsDwellFactor * period : Math.min(dwellMs / 1000, 0.8 * period);
}

/** Corriente al corte (A): RL con tope del igniter (spec §5.3). */
export function breakCurrent(
  v: number,
  rTotal: number,
  l: number,
  dwellSec: number,
  limit = 0,
): number {
  const a = v / Math.max(rTotal, 1e-3);
  if (a <= 0 || dwellSec <= 0) return 0;
  const i = a * (1 - Math.exp(-(dwellSec * rTotal) / l));
  return limit > 0 ? Math.min(i, limit) : i;
}

/** ∫ i dt desde el inicio del dwell hasta `seconds` (A·s). */
export function chargeIntegral(
  seconds: number,
  v: number,
  rTotal: number,
  l: number,
  limit = 0,
): number {
  if (seconds <= 0) return 0;
  const r = Math.max(rTotal, 1e-3);
  const a = v / r;
  if (a <= 0) return 0;
  const tau = l / r;
  const integral = (s: number): number => a * (s + tau * (Math.exp(-s / tau) - 1));
  if (limit > 0 && limit < a) {
    const tCap = -tau * Math.log(1 - limit / a);
    if (seconds <= tCap) return integral(seconds);
    return integral(tCap) + limit * (seconds - tCap);
  }
  return integral(seconds);
}

/** Energía de la chispa a partir de la corriente (J). */
export function sparkEnergy(i: number, l: number): number {
  return 0.5 * l * i * i;
}

/** Voltaje disponible del secundario (kV; spec §5.4). */
export function availableVoltageKv(energy: number, eta: number, cs = IG.cs): number {
  const v = Math.sqrt((2 * eta * energy) / cs) / 1000;
  return Math.min(IG.vMaxKv, Number.isFinite(v) ? v : 0);
}

/** Voltaje pedido para romper el arco (kV). */
export function requiredVoltageKv(gapMm: number, pBar: number, rotorWornKv = 0): number {
  return 2 + 2 * gapMm * Math.max(0, pBar) + rotorWornKv;
}

/** Presión del cilindro en la chispa (bar abs; spec §5.4). */
export function sparkPressure(
  map: number,
  advance: number,
  compression: number,
  n = IG.nCompression,
): number {
  const vCa = cylinderVolume(INTAKE_CLOSE_DEG);
  const vSpark = cylinderVolume(360 - clamp(advance, 0, 90));
  const ratio = vCa / Math.max(vSpark, 1);
  return (1.013 + map) * Math.pow(ratio, n) * clamp(compression, 0, 1.5);
}

/** Duración del arco (ms) con la energía restante (spec §5.4). */
export function arcMs(energy: number, eta: number, vReqKv: number, cs = IG.cs): number {
  const used = 0.5 * cs * Math.pow(vReqKv * 1000, 2);
  return (Math.max(0, eta * energy - used) / IG.arcPowerW) * 1000;
}
