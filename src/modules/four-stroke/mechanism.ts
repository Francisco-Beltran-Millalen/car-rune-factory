// Mecanismo del ciclo de 4 tiempos (A11): un `ControllerDef` con integrador
// propio, sin red de solver. Publica la fase y la compresión (§28) y lee el
// resto del bus de laboratorio (§29). Puro (§1); corre antes del solver (§25).

import { clamp, wrap } from '../../core/math.ts';
import type { ParamValue } from '../../core/types.ts';
import {
  compressionPeak,
  cylinderVolume,
  dVolumeDdeg,
  exhaustLift,
  intakeLift,
} from '../../sim/engine/geometry.ts';
import type { ControllerContext, ControllerDef, ControllerStateValue } from '../../sim/controllers/base.ts';
import type { LabBus } from '../../sim/signals/bus.ts';
import { FIRING_OFFSETS, K, VARIANTS, type DriveType, type FourStrokeVariant } from './constants.ts';
import { createCylinderGas, stepGas, type CylinderGas, type GasInputs } from './gas.ts';
import { createTimingState, stepTiming, type TimingFaults, type TimingState } from './timing.ts';

export type FourStrokeParams = {
  mode: 'auto' | 'manual';
  rpm: number;
  crankDeg: number;
  throttle: number;
  sparkAdvance: number;
  spark: boolean;
  oilPressure: number;
  viewCylinder: number;
  drive: DriveType;
  showOverlap: boolean;
};

export type FourStrokeFaults = {
  ringWear1: number;
  ringWear2: number;
  ringWear3: number;
  ringWear4: number;
  burntValve1: number;
  burntValve2: number;
  burntValve3: number;
  burntValve4: number;
  crankBoltLoose: boolean;
  keywayWorn: number;
  keySheared: boolean;
  tensionerWeak: number;
  guideBroken: boolean;
  chainStretch: number;
  skippedTeeth: number;
  beltWear: number;
  valveLash: number;
};

/** Unión de tiempos del cilindro visto, para la vista y la narración. */
export type StrokeName = 'admisión' | 'compresión' | 'expansión' | 'escape';

export type FourStrokeState = {
  crankAngle: number;
  camAngle: number;
  camOffset: number;
  stroke: StrokeName;
  pressure: number;
  volume: number;
  intakeLift: number;
  exhaustLift: number;
  burnFraction: number;
  torque: number;
  workPerCycle: number[];
  peakPressure: number[];
  compression: number[];
  compressionRel: number;
  cylinderBalance: number;
  slack: number;
  keywayPlay: number;
  keywayDamage: number;
  keyShearedState: boolean;
  teethJumped: number;
  bentValve: boolean[];
  beltSnapped: boolean;
  knock: number;
  rattle: number;
  valveHit: number;
  testing: boolean;
  cycleCount: number;
  /** Trabajo del último ciclo del cilindro visto (J), para la lectura. */
  viewWork: number;
};

export const DEFAULT_PARAMS: Readonly<FourStrokeParams> = {
  mode: 'auto',
  rpm: 800,
  crankDeg: 0,
  throttle: 0,
  sparkAdvance: 10,
  spark: true,
  oilPressure: 3,
  viewCylinder: 1,
  drive: 'chain',
  showOverlap: false,
};

export const DEFAULT_FAULTS: Readonly<FourStrokeFaults> = {
  ringWear1: 0,
  ringWear2: 0,
  ringWear3: 0,
  ringWear4: 0,
  burntValve1: 0,
  burntValve2: 0,
  burntValve3: 0,
  burntValve4: 0,
  crankBoltLoose: false,
  keywayWorn: 0,
  keySheared: false,
  tensionerWeak: 0,
  guideBroken: false,
  chainStretch: 0,
  skippedTeeth: 0,
  beltWear: 0,
  valveLash: 0,
};

export function createInitialFourStrokeState(): FourStrokeState {
  return {
    crankAngle: 0,
    camAngle: 0,
    camOffset: 0,
    stroke: 'admisión',
    pressure: 1.013,
    volume: cylinderVolume(0),
    intakeLift: 0,
    exhaustLift: 0,
    burnFraction: 0,
    torque: 0,
    workPerCycle: [0, 0, 0, 0],
    peakPressure: [1.013, 1.013, 1.013, 1.013],
    compression: [0, 0, 0, 0],
    compressionRel: 1,
    cylinderBalance: 1,
    slack: 0,
    keywayPlay: 0,
    keywayDamage: 0,
    keyShearedState: false,
    teethJumped: 0,
    bentValve: [false, false, false, false],
    beltSnapped: false,
    knock: 0,
    rattle: 0,
    valveHit: 0,
    testing: false,
    cycleCount: 0,
    viewWork: 0,
  };
}

export interface FourStrokeController extends ControllerDef {
  /** Acción `compressionTest()`: 3 s a 250 rpm, sin chispa, a fondo. */
  compressionTest(): void;
}

export interface FourStrokeOptions {
  bus: LabBus;
  variant: FourStrokeVariant;
}

function num(value: ParamValue | undefined, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function flag(value: ParamValue | undefined): boolean {
  return value === true;
}

function strokeOf(phase: number): StrokeName {
  const w = wrap(phase, 720);
  if (w < 220) return 'admisión';
  if (w < 360) return 'compresión';
  if (w < 540) return 'expansión';
  return 'escape';
}

export function createFourStroke(
  id: string,
  _params: Readonly<Record<string, ParamValue>>,
  options: FourStrokeOptions,
): FourStrokeController {
  const info = VARIANTS[options.variant];
  const bus = options.bus;
  const state = createInitialFourStrokeState();
  const cylinders: CylinderGas[] = FIRING_OFFSETS.map((offset) => createCylinderGas(-offset));
  let timing: TimingState = createTimingState();
  let crankAbs = 0;
  let prevRpm = 0;
  let testTimer = 0;
  let compressionTimer = 0;
  let valveHitPulse = 0;

  const controllerState: Record<string, ControllerStateValue> = state;

  function compressionTest(): void {
    testTimer = K.testTime;
    for (let i = 0; i < 4; i++) state.compression[i] = 0;
  }

  function update(ctx: ControllerContext): void {
    const dt = ctx.dt;
    const params = ctx.params;
    const faults = ctx.faults;

    if (testTimer > 0) testTimer = Math.max(0, testTimer - dt);
    const testing = testTimer > 0;
    const mode = testing ? 'auto' : params['mode'] === 'manual' ? 'manual' : 'auto';

    const busRpm = clamp(bus.get('engine.rpm'), 0, K.maxRpm);
    const rpm = testing ? K.testRpm : busRpm;
    const load = testing ? 1 : clamp(bus.get('engine.load'), 0, 1);
    const pMan = testing ? 0 : bus.get('intake.map');
    const spark = testing ? 0 : clamp(bus.get('ignition.spark'), 0, 1);
    const advance = clamp(bus.get('ignition.advance'), 0, 60);
    const mixture = bus.get('fuel.mixture');
    const oilPressure = bus.get('lubrication.pressure');
    const backpressure = bus.get('exhaust.backpressure');
    const drive: DriveType = params['drive'] === 'belt' && info.hasBelt ? 'belt' : 'chain';

    // Ángulo: en manual lo fija el slider (sin integrar rpm).
    let dTheta = 0;
    if (mode === 'manual') {
      const delta = clamp(num(params['crankDeg']), 0, 720) - wrap(crankAbs, 720);
      if (delta >= 0 && delta <= 180) dTheta = delta;
    } else {
      dTheta = (rpm / 60) * 360 * dt;
    }
    if (!Number.isFinite(dTheta) || dTheta < 0) dTheta = 0;
    const prevCrankAbs = crankAbs;
    crankAbs += dTheta;
    const crankAngle = wrap(crankAbs, 720);

    const timingFaults: TimingFaults = {
      crankBoltLoose: flag(faults['crankBoltLoose']),
      keywayWorn: num(faults['keywayWorn']),
      keySheared: flag(faults['keySheared']),
      tensionerWeak: num(faults['tensionerWeak']),
      guideBroken: flag(faults['guideBroken']),
      chainStretch: num(faults['chainStretch']),
      skippedTeeth: num(faults['skippedTeeth']),
      beltWear: num(faults['beltWear']),
    };
    timing = stepTiming(timing, {
      dt,
      crankDeg: crankAngle,
      rpm,
      load,
      oilPressure,
      hydraulic: info.hydraulicTensioner,
      drive,
      faults: timingFaults,
      rng: ctx.rng,
      prevRpm,
    });
    prevRpm = rpm;

    const lash = info.hasRocker ? clamp(num(faults['valveLash']), 0, 1) : 0;
    const n = rpm >= K.crankRpm ? K.nRun : K.nCrank;
    const dtPerDeg = dTheta > 0 ? dt / dTheta : 0;
    let torqueSum = 0;
    for (let i = 0; i < 4; i++) {
      const offset = FIRING_OFFSETS[i] ?? 0;
      const from = prevCrankAbs - offset;
      const to = crankAbs - offset;
      const ring = clamp(num(faults[`ringWear${i + 1}`]), 0, 1);
      const burnt = clamp(num(faults[`burntValve${i + 1}`]), 0, 1);
      const inputs: GasInputs = {
        dtPerDeg,
        pMan,
        backpressure,
        advance,
        spark,
        mixture,
        n,
        kLeak: K.ringLeak * ring,
        kValve: K.burntValveLeak * Math.max(burnt, state.bentValve[i] ? 1 : 0),
        lash,
        camOffset: timing.camOffset,
      };
      const next = stepGas(cylinders[i] ?? createCylinderGas(to), from, to, inputs);
      cylinders[i] = next;
      if (next.hit && !state.bentValve[i]) {
        state.bentValve[i] = true;
        valveHitPulse = 1;
      }
      torqueSum += (next.pressure - 1.013) * dVolumeDdeg(next.phase) * 5.72958;
      state.workPerCycle[i] = next.lastWork;
      state.peakPressure[i] = next.lastPeak;
      if (testing) {
        state.compression[i] = Math.max(state.compression[i] ?? 0, next.peak - 1.013);
      }
    }

    const view = Math.round(clamp(num(params['viewCylinder'], 1), 1, 4));
    const viewPhase = crankAbs - (FIRING_OFFSETS[view - 1] ?? 0);
    const viewCam = viewPhase - timing.camOffset;
    const viewGas = cylinders[view - 1] ?? createCylinderGas(viewPhase);
    const friction = K.friction0 + K.frictionRpm * rpm;

    state.crankAngle = crankAngle;
    state.camAngle = wrap(crankAbs - timing.camOffset, 720);
    state.camOffset = timing.camOffset;
    state.stroke = strokeOf(viewPhase);
    state.pressure = viewGas.pressure;
    state.volume = cylinderVolume(viewPhase);
    state.intakeLift = intakeLift(wrap(viewCam, 720), lash);
    state.exhaustLift = exhaustLift(wrap(viewCam, 720), lash);
    state.burnFraction = viewGas.burn;
    state.torque = torqueSum - friction;
    state.slack = timing.slack;
    state.keywayPlay = timing.keywayPlay;
    state.keywayDamage = timing.keywayDamage;
    state.keyShearedState = timing.keyShearedState;
    state.teethJumped = timing.teethJumped;
    state.beltSnapped = timing.beltSnapped;
    state.knock = timing.knock;
    state.rattle = timing.rattle;
    state.valveHit = valveHitPulse;
    state.testing = testing;
    state.cycleCount = cylinders[0]?.cycles ?? 0;
    state.viewWork = state.workPerCycle[view - 1] ?? 0;

    valveHitPulse = Math.max(0, valveHitPulse - dt * 2);

    // Balance entre cilindros: min/promedio del trabajo del último ciclo.
    const works = state.workPerCycle;
    const avg = ((works[0] ?? 0) + (works[1] ?? 0) + (works[2] ?? 0) + (works[3] ?? 0)) / 4;
    if (avg > 1e-6) {
      state.cylinderBalance = clamp(Math.min(...works) / avg, 0, 1);
    }

    // `engine.compression`: estimación analítica cada 0,1 s (spec §5.9).
    compressionTimer += dt;
    if (compressionTimer >= K.compressionEvery) {
      compressionTimer = 0;
      const healthy = compressionPeak(0);
      let sum = 0;
      for (let i = 0; i < 4; i++) {
        const ring = clamp(num(faults[`ringWear${i + 1}`]), 0, 1);
        sum += compressionPeak(K.ringLeak * ring) / healthy;
      }
      state.compressionRel = clamp(sum / 4, 0, 1);
    }

    bus.set('fourStroke', 'engine.crankAngle', crankAngle);
    bus.set('fourStroke', 'engine.camAngle', state.camAngle);
    bus.set('fourStroke', 'engine.compression', state.compressionRel);
    bus.set('fourStroke', 'engine.cylinderBalance', state.cylinderBalance);
  }

  return {
    id,
    state: controllerState,
    update,
    compressionTest,
  };
}
