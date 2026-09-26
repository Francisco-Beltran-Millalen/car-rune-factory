// Cerebro del motor (§14.1): dueño de `engine.state` y `engine.rpm` (§28).
// Una sola implementación: el laboratorio del combustible (A6, con stubs §29)
// y el vehículo (A10, con entradas reales del resto de los sistemas).
// Reproduce los pasos 1, 5 y 8 de fuel/model.ts sin cambiar números.

import { clamp, wrap } from '../../core/math.ts';
import type { ParamValue } from '../../core/types.ts';
import type { ControllerContext, ControllerDef, ControllerStateValue } from './base.ts';
import { createIdealInputs, type EngineInputs } from './stubs.ts';

/** Señales que el motor comparte con los demás sistemas (§28). */
export interface EngineSignals {
  engineState: string;
  rpmEff: number;
  crankAngle: number;
  pMan: number;
  pRef: number;
  /** Mezcla de combustible; la escribe el sistema de combustible. */
  mixture: number;
}

export interface EngineCoreOptions {
  /** Aportes de los otros sistemas; por defecto, stubs ideales. */
  inputs?: EngineInputs;
  /** Si se pasa, el motor escribe en él `engineState`, `rpmEff`, `crankAngle`, `pMan` y `pRef`. */
  signals?: EngineSignals;
  /** De dónde sale la mezcla; por defecto `signals.mixture` o la sonda `mixture`. */
  mixture?: (ctx: ControllerContext) => number;
}

/** Valores del motor, idénticos a fuel/model.ts §4 pasos 1, 5 y 8. */
export const ENGINE = {
  idleRpmMin: 600,
  crankRpm: 250,
  idleVacuum: -0.65,
  vacuumSpan: 0.65,
  startRatio: 0.6,
  startTime: 0.5,
  stallRatio: 0.4,
  stallTime: 0.3,
  leanRatio: 0.8,
  richRatio: 1.35,
  minCrankV: 6,
} as const;

function num(value: ParamValue | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function createEngineCore(
  id: string,
  _params: Readonly<Record<string, ParamValue>>,
  options: EngineCoreOptions = {},
): ControllerDef {
  const inputs = options.inputs ?? createIdealInputs();
  const signals = options.signals;
  const mixtureOf =
    options.mixture ??
    ((ctx: ControllerContext): number => (signals ? signals.mixture : ctx.read('mixture')));

  let engineState = 'off';
  let prevKey = 'off';
  let rpmEff = 0;
  let crankAngle = 0;
  let pMan = 0;
  let pRef = 0;
  let goodMixTime = 0;
  let badMixTime = 0;
  const state: Record<string, ControllerStateValue> = {
    engineState,
    rpmEff,
    crankAngle,
    pMan,
    pRef,
  };

  return {
    id,
    state,
    update(ctx): void {
      const dt = ctx.dt;
      const key =
        typeof ctx.params['ignitionKey'] === 'string' ? ctx.params['ignitionKey'] : 'off';

      // Paso 1: estados de la llave, igual que fuel/model.ts.
      if (key !== prevKey) {
        if (key === 'off' || key === 'on') engineState = 'off';
        if (key === 'start' && engineState !== 'running' && engineState !== 'misfire') {
          engineState = 'cranking';
          goodMixTime = 0;
        }
        prevKey = key;
      }
      if (key === 'run' && engineState === 'off') {
        engineState = 'cranking';
        goodMixTime = 0;
      }
      const cranking = engineState === 'cranking';
      const running = engineState === 'running' || engineState === 'misfire';
      const rpm = clamp(num(ctx.params['rpm'], 800), ENGINE.idleRpmMin, 6500);
      rpmEff = running ? rpm : cranking ? ENGINE.crankRpm : 0;
      crankAngle = wrap(crankAngle + (rpmEff / 60) * 360 * dt, 720);

      // Paso 5: vacío del múltiple y referencia del regulador.
      const throttle = clamp(num(ctx.params['throttle'], 0), 0, 1);
      pMan = rpmEff > 0 ? ENGINE.idleVacuum + ENGINE.vacuumSpan * throttle : 0;
      pRef = ctx.faults['vacuumHoseOff'] === true ? 0 : pMan;
      const manifold = ctx.elements['manifold'];
      if (manifold) manifold.control['p'] = pMan;
      const vacuumHose = ctx.elements['vacuumHose'];
      if (vacuumHose) vacuumHose.control['p'] = pRef;

      // Paso 8: el motor parte, falla o se detiene según la mezcla (§14 los
      // demás aportes; con stubs ideales queda igual que la referencia).
      const mixture = mixtureOf(ctx);
      if (cranking) {
        const canStart =
          inputs.spark > 0.5 &&
          inputs.airOk > 0.5 &&
          inputs.compression > 0.5 &&
          inputs.crankVoltage >= ENGINE.minCrankV;
        goodMixTime = canStart && mixture >= ENGINE.startRatio ? goodMixTime + dt : 0;
        if (goodMixTime >= ENGINE.startTime) {
          engineState = 'running';
          badMixTime = 0;
        }
      } else if (running) {
        badMixTime = mixture < ENGINE.stallRatio ? badMixTime + dt : 0;
        if (badMixTime >= ENGINE.stallTime) engineState = 'stalled';
        else if (mixture < ENGINE.leanRatio || mixture > ENGINE.richRatio) engineState = 'misfire';
        else engineState = 'running';
      }

      state['engineState'] = engineState;
      state['rpmEff'] = rpmEff;
      state['crankAngle'] = crankAngle;
      state['pMan'] = pMan;
      state['pRef'] = pRef;
      if (signals) {
        signals.engineState = engineState;
        signals.rpmEff = rpmEff;
        signals.crankAngle = crankAngle;
        signals.pMan = pMan;
        signals.pRef = pRef;
      }
    },
  };
}
