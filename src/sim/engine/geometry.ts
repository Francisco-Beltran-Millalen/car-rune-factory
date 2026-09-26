// Geometría del motor de 4 tiempos (A11, spec four-stroke §5). Puro (§1).
// La comparten four-stroke y el encendido (A12): los módulos no se importan
// entre sí (§11), por eso vive en `sim/engine/`.

import { clamp, wrap } from '../../core/math.ts';

/** Diámetro (mm). */
export const BORE_MM = 86;
/** Carrera (mm). */
export const STROKE_MM = 86;
/** Biela (mm). */
export const ROD_MM = 143;
/** Relación de compresión. */
export const COMPRESSION_RATIO = 10;
export const CYL_AREA_MM2 = (Math.PI * BORE_MM * BORE_MM) / 4;
/** Cilindrada unitaria (cm³) ≈ 499,6. */
export const DISPLACEMENT_CM3 = (CYL_AREA_MM2 * STROKE_MM) / 1000;
/** Volumen de la cámara (cm³) = Vd/(CR−1) ≈ 55,5. */
export const CLEARANCE_CM3 = DISPLACEMENT_CM3 / (COMPRESSION_RATIO - 1);

/** Eventos de válvula en ° de cigüeñal (0 = PMS de cruce). */
export interface ValveEvents {
  open: number;
  close: number;
}

export const INTAKE_EVENTS: ValveEvents = { open: -10, close: 220 };
export const EXHAUST_EVENTS: ValveEvents = { open: 500, close: 730 };
export const VALVE_LIFT_MM = 9;
/** `rocker.lash = 1` recorta la alzada en 0,6 mm (spec §4). */
export const LASH_MM = 0.6;
/** Holgura válvula-pistón en el PMS (mm): motor de interferencia. */
export const PISTON_CLEARANCE_MM = 1.6;
/** Cierre de admisión y PMS de compresión (°): base de la prueba. */
export const INTAKE_CLOSE_DEG = INTAKE_EVENTS.close;
export const COMPRESSION_TDC_DEG = 360;
export const CRANK_TEST_RPM = 250;

const RAD = Math.PI / 180;
const R = STROKE_MM / 2;

/** Distancia del pistón al PMS (mm) para un ángulo. */
export function pistonDrop(deg: number): number {
  const t = deg * RAD;
  const s = Math.sin(t);
  return R + ROD_MM - (R * Math.cos(t) + Math.sqrt(ROD_MM * ROD_MM - R * R * s * s));
}

/** Volumen del cilindro (cm³) para un ángulo. */
export function cylinderVolume(deg: number): number {
  return CLEARANCE_CM3 + (CYL_AREA_MM2 * pistonDrop(deg)) / 1000;
}

/** dV/dθ (cm³ por grado). */
export function dVolumeDdeg(deg: number): number {
  const t = deg * RAD;
  const s = Math.sin(t);
  const root = Math.sqrt(ROD_MM * ROD_MM - R * R * s * s);
  const ds = R * s * (1 + (R * Math.cos(t)) / root); // mm/rad
  return (CYL_AREA_MM2 * ds) / 1000 / (180 / Math.PI);
}

/** Alzada de válvula (mm) con perfil sin² y juego de taqués. */
export function valveLift(deg: number, events: ValveEvents, lash = 0): number {
  const duration = events.close - events.open;
  const rel = wrap(wrap(deg, 720) - events.open, 720);
  if (rel > duration) return 0;
  const s = Math.sin((Math.PI * rel) / duration);
  return Math.max(0, VALVE_LIFT_MM * s * s - LASH_MM * lash);
}

export function intakeLift(deg: number, lash = 0): number {
  return valveLift(deg, INTAKE_EVENTS, lash);
}

export function exhaustLift(deg: number, lash = 0): number {
  return valveLift(deg, EXHAUST_EVENTS, lash);
}

/** Fracción quemada de Wiebe (a = 5, m = 2, 50°), con avance en ° APMS. */
export function burnFraction(deg: number, advance: number): number {
  const sparkDeg = COMPRESSION_TDC_DEG - advance;
  const rel = (wrap(deg, 720) - sparkDeg) / 50;
  if (rel <= 0) return 0;
  return 1 - Math.exp(-5 * Math.pow(rel, 3));
}

/**
 * Pico de la prueba de compresión (bar abs), estimado sin correr el modelo:
 * integra el politrópico `n` y la fuga de anillos desde el cierre de admisión
 * al PMS (spec four-stroke §5.8). La usa `engine.compression` y A12; el
 * mecanismo la re-mide en vivo con el mismo modelo.
 */
export function compressionPeak(kLeak: number, n = 1.2, rpm = CRANK_TEST_RPM): number {
  const dtPerDeg = 60 / (Math.max(rpm, 1) * 360);
  const duration = COMPRESSION_TDC_DEG - INTAKE_CLOSE_DEG;
  const steps = Math.ceil(duration / 0.5);
  const d = duration / steps;
  const k = Math.max(0, kLeak);
  let p = 1.013;
  for (let i = 0; i < steps; i++) {
    const deg = INTAKE_CLOSE_DEG + i * d;
    const v0 = cylinderVolume(deg);
    const v1 = cylinderVolume(deg + d);
    p = p * Math.pow(v0 / v1, n);
    p -= p * k * Math.sqrt(Math.max(0, p - 1)) * dtPerDeg * d;
    p = clamp(p, 0.05, 150);
  }
  return p;
}
