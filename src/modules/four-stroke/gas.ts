// Gas de un cilindro (A11, spec four-stroke §5.4): subpasos de ≤ 1° dentro del
// paso de 1 ms, función pura `stepGas(cyl, θ0, θ1, entradas) → cyl'`. Puro (§1).

import { clamp, wrap } from '../../core/math.ts';
import {
  burnFraction,
  cylinderVolume,
  exhaustLift,
  intakeLift,
  PISTON_CLEARANCE_MM,
  pistonDrop,
} from '../../sim/engine/geometry.ts';
import { K } from './constants.ts';

/** Estado del gas de un cilindro; `phase` es el ángulo de cigüeñal sin
 *  envolver (°, 0 = PMS de cruce del cilindro). */
export interface CylinderGas {
  phase: number;
  /** bar abs. */
  pressure: number;
  /** Calor disponible del ciclo (J). */
  heat: number;
  /** Fracción quemada de Wiebe (0..1). */
  burn: number;
  /** Trabajo del ciclo en curso (J). */
  work: number;
  /** Trabajo del último ciclo completo (J). */
  lastWork: number;
  peak: number;
  lastPeak: number;
  cycles: number;
  hit: boolean;
}

export interface GasInputs {
  /** Segundos por grado de cigüeñal. */
  dtPerDeg: number;
  /** bar relativos. */
  pMan: number;
  /** bar sobre 1,10 (escape). */
  backpressure: number;
  /** ° APMS. */
  advance: number;
  /** 0..1 (calidad de chispa). */
  spark: number;
  /** `fuel.mixture` (ratio). */
  mixture: number;
  /** Exponente politrópico (1,3 en marcha; 1,2 al arrastre). */
  n: number;
  kLeak: number;
  kValve: number;
  /** Juego de taqués (0..1). */
  lash: number;
  /** Desfase de la leva (° de cigüeñal): válvulas y combustión lo siguen. */
  camOffset: number;
  /** Subpaso máximo en grados (default 1). */
  subStep?: number;
}

export function createCylinderGas(phase = 0): CylinderGas {
  return {
    phase,
    pressure: 1.013,
    heat: 0,
    burn: 0,
    work: 0,
    lastWork: 0,
    peak: 1.013,
    lastPeak: 1.013,
    cycles: 0,
    hit: false,
  };
}

/** `f_mezcla`: 1 entre 0,9 y 1,2; baja lineal a 0 en 0,5 y 1,8 (spec §5.4). */
export function mixtureFactor(mixture: number): number {
  if (mixture >= 0.9 && mixture <= 1.2) return 1;
  if (mixture < 0.9) return clamp((mixture - 0.5) / 0.4, 0, 1);
  return clamp((1.8 - mixture) / 0.6, 0, 1);
}

export function stepGas(
  cyl: CylinderGas,
  fromDeg: number,
  toDeg: number,
  inputs: GasInputs,
): CylinderGas {
  const dTheta = toDeg - fromDeg;
  const next: CylinderGas = { ...cyl, phase: toDeg, hit: false };
  if (!(dTheta > 0) || !Number.isFinite(dTheta)) return next;

  const subStep = inputs.subStep && inputs.subStep > 0 ? inputs.subStep : 1;
  const steps = Math.max(1, Math.ceil(dTheta / subStep));
  const d = dTheta / steps;
  const dt = Math.max(0, inputs.dtPerDeg) * d;
  const n = clamp(inputs.n, 1, 1.6);
  const pIntake = 1.013 + inputs.pMan;
  const pEscape = 1.1 + Math.max(0, inputs.backpressure);
  const spark = clamp(inputs.spark, 0, 1);
  const kLeak = Math.max(0, inputs.kLeak);
  const kValve = Math.max(0, inputs.kValve);
  const lash = clamp(inputs.lash, 0, 1);

  let theta = fromDeg;
  let p = clamp(cyl.pressure, K.minPressure, K.maxPressure);
  let heat = cyl.heat;
  let burn = cyl.burn;
  let work = cyl.work;
  let peak = cyl.peak;
  let lastWork = cyl.lastWork;
  let lastPeak = cyl.lastPeak;
  let cycles = cyl.cycles;
  let hit = false;
  const camOffset = inputs.camOffset;

  for (let i = 0; i < steps; i++) {
    const t0 = theta;
    const t1 = t0 + d;
    const w0 = wrap(t0, 720);
    const w1 = wrap(t1, 720);
    // Válvulas y combustión siguen a la leva; el pistón, al cigüeñal.
    const cam0 = wrap(w0 - camOffset, 720);
    const cam1 = wrap(w1 - camOffset, 720);

    // Cierre de admisión: termina el ciclo anterior y arranca el nuevo.
    if (cam0 < 220 && cam0 + d >= 220) {
      lastWork = work;
      lastPeak = peak;
      cycles += 1;
      work = 0;
      peak = p;
      burn = 0;
      heat = K.qWot * (p / 1.013) * mixtureFactor(inputs.mixture) * spark;
    }

    const v0 = cylinderVolume(t0);
    const v1 = cylinderVolume(t1);
    const liftI = intakeLift(cam0, lash);
    const liftE = exhaustLift(cam0, lash);
    let p1 = p;

    if (liftI > 0 || liftE > 0) {
      // Válvula abierta: la presión se relaja a la del puerto.
      if (liftI > 0) {
        const tau = 0.002 * (9 / Math.max(liftI, 0.5));
        p1 = pIntake + (p1 - pIntake) * Math.exp(-dt / tau);
      }
      if (liftE > 0) {
        const tau = 0.002 * (9 / Math.max(liftE, 0.5));
        p1 = pEscape + (p1 - pEscape) * Math.exp(-dt / tau);
      }
    } else {
      const xb0 = heat > 0 ? burnFraction(cam0, inputs.advance) : 0;
      const xb1 = heat > 0 ? burnFraction(cam1, inputs.advance) : 0;
      const dQ = heat * Math.max(0, xb1 - xb0);
      // Forma integral de dp = −n·p·dV/V + (n−1)/V·dQ·1e-5 (V en m³):
      // p1·V1ⁿ = p·V0ⁿ + (n−1)·Vmedⁿ⁻¹·dQ, exacta para el politrópico y con
      // el calor al volumen medio (a 6000 rpm el subpaso de 1° alcanza, §11.15).
      const vm = 0.5 * (v0 + v1);
      const heatBar = ((n - 1) * dQ * 10 * Math.pow(vm / v1, n - 1)) / v1;
      p1 = p * Math.pow(v0 / v1, n) + heatBar;
      const inPower = cam0 >= 220 && cam0 < 540;
      const leak =
        p *
        (kLeak * Math.sqrt(Math.max(0, p - 1)) +
          (inPower ? kValve * Math.sqrt(Math.max(0, p - pEscape)) : 0)) *
        dt;
      p1 -= leak;
      burn = xb1;
    }

    work += 0.5 * (p + p1) * (v1 - v0) * 0.1; // bar·cm³ = 0,1 J
    p = clamp(p1, K.minPressure, K.maxPressure);
    if (p > peak) peak = p;
    const lift = Math.max(liftI, liftE);
    if (lift > 0 && PISTON_CLEARANCE_MM + pistonDrop(w0) - lift < 0) hit = true;
    theta = t1;
  }

  next.pressure = p;
  next.heat = heat;
  next.burn = burn;
  next.work = work;
  next.lastWork = lastWork;
  next.peak = peak;
  next.lastPeak = lastPeak;
  next.cycles = cycles;
  next.hit = hit;
  return next;
}
