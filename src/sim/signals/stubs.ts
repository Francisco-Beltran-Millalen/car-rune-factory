// Stubs ideales del bus de laboratorio (§29; tabla del plan del vehículo
// §5.3). Puro (§1). Extiende, no reemplaza, `sim/controllers/stubs.ts`.

import { wrap } from '../../core/math.ts';
import type { ParamRecord, ParamValue } from '../../core/types.ts';
import type { StubSource } from './bus.ts';

function num(value: ParamValue | undefined, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** `intake.map` (bar relativos) sale del acelerador (la mariposa). */
export function mapStub(params: Readonly<ParamRecord>): number {
  return -0.65 + 0.65 * num(params['throttle']);
}

/** `air.massFlow` (kg/h) del laboratorio: fórmula de `carburetor.md` §5.1. */
export function airMassFlowStub(params: Readonly<ParamRecord>): number {
  const rpm = num(params['rpm']);
  const map = mapStub(params);
  return 1.2e-3 * 2.0 * (rpm / 120) * (0.8 + 0.05 * num(params['throttle'])) * ((1.013 + map) / 1.013) * 3600;
}

/**
 * Stub de fase: integra `engine.crankAngle` desde `rpm` y publica
 * `engine.camAngle = crankAngle − camOffset` (0 si no existe). Lo usan los
 * laboratorios que leen la fase y no la producen (A12, A15).
 */
export interface PhaseStub {
  step(dt: number, params: Readonly<ParamRecord>): void;
  get(): number;
  reset(): void;
  /** `engine.camAngle` para unos params. */
  cam(params: Readonly<ParamRecord>): number;
}

export function createPhaseStub(): PhaseStub {
  let angle = 0;
  return {
    step(dt, params): void {
      angle = wrap(angle + (num(params['rpm']) / 60) * 360 * dt, 720);
    },
    get(): number {
      return angle;
    },
    reset(): void {
      angle = 0;
    },
    cam(params): number {
      return wrap(angle - num(params['camOffset']), 720);
    },
  };
}

/** Tabla de stubs ideales del plan del vehículo §5.3 (menos la fase). */
export const SIGNAL_STUBS: Readonly<Record<string, StubSource>> = {
  'ignition.spark': 1,
  'ignition.advance': 10,
  'ignition.vacuumLeak': 0,
  'ecu.sync': 1,
  'engine.rpm': (p) => num(p['rpm']),
  'engine.load': (p) => num(p['throttle']),
  'engine.compression': 1,
  'engine.cylinderBalance': 1,
  'intake.map': mapStub,
  'air.ratio': 1,
  'air.massFlow': airMassFlowStub,
  'fuel.mixture': 1,
  'lubrication.pressure': 3,
  'lubrication.seized': 0,
  'engine.coolantTemp': 90,
  'cooling.boiling': 0,
  'electrical.crankVoltage': 12.6,
  'exhaust.backpressure': 0,
  'vehicle.speed': 0,
  'vehicle.accel': 0,
  'wheel.speedFL': 0,
  'wheel.speedFR': 0,
  'wheel.speedRL': 0,
  'wheel.speedRR': 0,
  'steering.angle': 0,
  'wheel.pressureFL': 2.2,
  'wheel.pressureFR': 2.2,
  'wheel.pressureRL': 2.2,
  'wheel.pressureRR': 2.2,
  'wheel.gripFL': 1,
  'wheel.gripFR': 1,
  'wheel.gripRL': 1,
  'wheel.gripRR': 1,
  'suspension.pull': 0,
  'suspension.toeDeltaFL': 0,
  'suspension.toeDeltaFR': 0,
  'suspension.camberFL': -0.5,
  'suspension.camberFR': -0.5,
  'suspension.camberRL': -0.5,
  'suspension.camberRR': -0.5,
  'steering.toeFL': 0.1,
  'steering.toeFR': 0.1,
  'belt.slip': 0,
};

/**
 * Tabla del laboratorio: la de §5.3 más el stub de fase, con los overrides
 * que cada módulo ata a sus params (p. ej. `lubrication.pressure`).
 */
export function createSignalStubs(
  overrides: Readonly<Record<string, StubSource>> = {},
): Record<string, StubSource> {
  const phase = createPhaseStub();
  return {
    ...SIGNAL_STUBS,
    'engine.crankAngle': phase,
    'engine.camAngle': (params) => phase.cam(params),
    ...overrides,
  };
}
