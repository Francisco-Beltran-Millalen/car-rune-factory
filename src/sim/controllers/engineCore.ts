// Cerebro del motor (§14.1): dueño de `engine.state` y `engine.rpm` (§28).
// Una sola implementación: el laboratorio del combustible (A6, con stubs §29)
// y el vehículo (A10, con entradas reales del resto de los sistemas).
// Reproduce los pasos 1, 5 y 8 de fuel/model.ts sin cambiar números.

import { clamp, wrap } from '../../core/math.ts';
import type { ParamValue } from '../../core/types.ts';
import type { SignalBus } from '../signals/bus.ts';
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
  // §4.8 (vehículo): condiciones nuevas de arranque/misfire/stall.
  minCrankRpmStart: 150,
  minSparkStart: 0.5,
  minCompressionStart: 0.5,
  minSparkRun: 0.9,
  minCylinderBalance: 0.8,
  minSparkStall: 0.3,
  sparkStallTime: 0.3,
  minCompressionStall: 0.3,
  airMassFlowFloor: 0.5,
} as const;

/** `engine.state` en el bus (§4.8): sólo números, así que el string se
 *  codifica; ambos sentidos quedan exportados para el puente de `fuel`. */
export const ENGINE_STATE_CODE: Readonly<Record<string, number>> = {
  off: 0,
  cranking: 1,
  running: 2,
  misfire: 3,
  stalled: 4,
};

export const ENGINE_STATE_NAME: readonly string[] = ['off', 'cranking', 'running', 'misfire', 'stalled'];

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

/** Opciones de `createVehicleEngineCore` (plan del vehículo §4.8). */
export interface VehicleEngineCoreOptions {
  bus: SignalBus;
  /**
   * Ids reales de `manifold`/`vacuumHose` en el vehículo (§4 paso 5: el
   * laboratorio los llama `manifold`/`vacuumHose`; el vehículo los tiene
   * prefijados, p. ej. `fuel:manifold`). Sin `manifold`/`vacuumHose` propio
   * (el carburador no tiene el segundo), el `control` no se escribe (no-op).
   */
  elementIds?: { manifold?: string; vacuumHose?: string };
  /** Clave de la falla "manguera de vacío suelta" (prefijada en el vehículo,
   *  p. ej. `fuel:vacuumHoseOff`); sin ella, `pRef` nunca se corta a 0. */
  vacuumHoseOffFaultKey?: string;
}

/**
 * `engineCore` del vehículo (plan del vehículo §4.8, D-V5): mismo cerebro que
 * el de A6, pero con entradas reales tomadas del bus compartido (§28) en vez
 * de los stubs ideales de `sim/controllers/stubs.ts`, y publicando sus
 * salidas en el bus (dueño `'engineCore'`, §6) en vez de un objeto `signals`
 * privado. `four-stroke` es dueño de `engine.crankAngle`/`camAngle` en el
 * vehículo (D-V6): este controlador nunca los escribe.
 */
export function createVehicleEngineCore(
  id: string,
  options: VehicleEngineCoreOptions,
): ControllerDef {
  const bus = options.bus;
  const manifoldId = options.elementIds?.manifold ?? 'manifold';
  const vacuumHoseId = options.elementIds?.vacuumHose ?? 'vacuumHose';
  const vacuumHoseOffKey = options.vacuumHoseOffFaultKey;

  let engineState = 'off';
  let prevKey = 'off';
  let rpmEff = 0;
  let seizedLatch = false;
  let goodMixTime = 0;
  let badMixTime = 0;
  let stallSparkTime = 0;
  const state: Record<string, ControllerStateValue> = {
    engineState,
    rpmEff,
    pMan: 0,
    pRef: 0,
  };

  return {
    id,
    state,
    update(ctx): void {
      const dt = ctx.dt;
      const key = typeof ctx.params['ignitionKey'] === 'string' ? ctx.params['ignitionKey'] : 'off';

      const seized = bus.get('lubrication.seized') >= 0.5;
      if (seized) seizedLatch = true; // agarrotado: no vuelve a `cranking` (§4.8)

      // Paso 1: estados de la llave, igual que la referencia (fuel/model.ts).
      if (key !== prevKey) {
        if (key === 'off' || key === 'on') engineState = 'off';
        if (
          key === 'start' &&
          engineState !== 'running' &&
          engineState !== 'misfire' &&
          !seizedLatch
        ) {
          engineState = 'cranking';
          goodMixTime = 0;
        }
        prevKey = key;
      }
      if (key === 'run' && engineState === 'off' && !seizedLatch) {
        engineState = 'cranking';
        goodMixTime = 0;
      }

      const cranking = engineState === 'cranking';
      const running = engineState === 'running' || engineState === 'misfire';
      // `starter.rpm` (A17) todavía no existe: la rpm de arranque es 250 fija
      // (§4.8, "si no [existe], 250"); la condición "≥150" queda escrita para
      // cuando A17 la haga variable.
      const crankRpm = ENGINE.crankRpm;
      const rpm = clamp(num(ctx.params['rpm'], 800), ENGINE.idleRpmMin, 6500);
      rpmEff = running ? rpm : cranking ? crankRpm : 0;

      // Paso 5: vacío del múltiple y referencia del regulador (igual que A6).
      const throttle = clamp(num(ctx.params['throttle'], 0), 0, 1);
      const pMan = rpmEff > 0 ? ENGINE.idleVacuum + ENGINE.vacuumSpan * throttle : 0;
      const vacuumHoseOff = vacuumHoseOffKey !== undefined && ctx.faults[vacuumHoseOffKey] === true;
      const pRef = vacuumHoseOff ? 0 : pMan;
      const manifold = ctx.elements[manifoldId];
      if (manifold) manifold.control['p'] = pMan;
      const vacuumHose = ctx.elements[vacuumHoseId];
      if (vacuumHose) vacuumHose.control['p'] = pRef;

      // `air.massFlow`/`air.ratio`/`intake.map` provisionales (§4.8, D-V7):
      // mientras no exista la admisión (A18), los calcula `engineCore`.
      const airMassFlow =
        1.2e-3 * 2.0 * (rpmEff / 120) * (0.8 + 0.05 * throttle) * ((1.013 + pMan) / 1.013) * 3600;
      const vacuumLeak = Math.max(0, bus.get('ignition.vacuumLeak'));
      const airRatio =
        airMassFlow < ENGINE.airMassFlowFloor ? 1 : 1 + vacuumLeak / airMassFlow;

      // Paso 8: mezcla efectiva y condiciones reales de arranque/misfire/stall.
      const rawMixture = bus.get('fuel.mixture');
      const mixture = airRatio > 0 ? rawMixture / airRatio : rawMixture;
      const spark = bus.get('ignition.spark');
      const compression = bus.get('engine.compression');
      const crankVoltage = bus.get('electrical.crankVoltage');
      const ecuSync = bus.get('ecu.sync');
      const cylinderBalance = bus.get('engine.cylinderBalance');
      const boiling = bus.get('cooling.boiling') >= 0.5;

      if (cranking) {
        // `crankRpm >= ENGINE.minCrankRpmStart` (250 ≥ 150) queda afuera:
        // hoy `crankRpm` es la constante fija de arriba, siempre la cumple;
        // vuelve a ser necesaria cuando A17 la haga variable (`starter.rpm`).
        const canStart =
          spark >= ENGINE.minSparkStart &&
          compression >= ENGINE.minCompressionStart &&
          crankVoltage >= ENGINE.minCrankV &&
          !seizedLatch &&
          ecuSync >= 1;
        goodMixTime = canStart && mixture >= ENGINE.startRatio ? goodMixTime + dt : 0;
        if (goodMixTime >= ENGINE.startTime) {
          engineState = 'running';
          badMixTime = 0;
          stallSparkTime = 0;
        }
      } else if (running) {
        stallSparkTime = spark < ENGINE.minSparkStall ? stallSparkTime + dt : 0;
        badMixTime = mixture < ENGINE.stallRatio ? badMixTime + dt : 0;
        const stall =
          badMixTime >= ENGINE.stallTime ||
          stallSparkTime >= ENGINE.sparkStallTime ||
          compression < ENGINE.minCompressionStall ||
          ecuSync < 1 ||
          seizedLatch;
        const misfire =
          mixture < ENGINE.leanRatio ||
          mixture > ENGINE.richRatio ||
          spark < ENGINE.minSparkRun ||
          cylinderBalance < ENGINE.minCylinderBalance ||
          boiling;
        if (stall) engineState = 'stalled';
        else if (misfire) engineState = 'misfire';
        else engineState = 'running';
      }

      // `engine.load` (§6): con el estado YA actualizado por el paso 8 (si
      // este paso pasó de `cranking` a `running`, `load` lo refleja de una,
      // no un paso después). Sin torque real hasta A21.
      const load = engineState === 'running' || engineState === 'misfire' ? clamp(throttle, 0, 1) : 0;

      state['engineState'] = engineState;
      state['rpmEff'] = rpmEff;
      state['pMan'] = pMan;
      state['pRef'] = pRef;

      bus.set('engineCore', 'engine.state', ENGINE_STATE_CODE[engineState] ?? 0);
      bus.set('engineCore', 'engine.rpm', rpmEff);
      bus.set('engineCore', 'engine.load', load);
      bus.set('engineCore', 'intake.map', pMan);
      bus.set('engineCore', 'air.massFlow', airMassFlow);
      bus.set('engineCore', 'air.ratio', airRatio);
    },
  };
}
