// Controladores del combustible (P23 §8.3): ECU, alternador y alimentación.
// Reproducen los pasos 1, 2, 7, 9 y 6/10 (regulador) de fuel/model.ts sin
// cambiar números. Puro (§1); corren antes del solver (§25).

import { clamp, expSmooth, wrap } from '../../core/math.ts';
import type { ParamValue } from '../../core/types.ts';
import type { ControllerStateValue } from '../../sim/controllers/base.ts';
import type { ControllerDef } from '../../sim/controllers/index.ts';
import type { EngineSignals } from '../../sim/controllers/engineCore.ts';
import { K } from './reference-model.ts';

/** Señales compartidas del motor (las escribe `engineCore` y la ECU). */
export interface FuelSignals extends EngineSignals {
  /** Orden del relé: el alternador deja la batería en 0 V si está abierto. */
  relayOn: boolean;
}

const FIRING_OFFSETS = [0, 540, 180, 360]; // inyectores 1..4, orden 1-3-4-2
const KINJ = K.injFlow3bar / Math.sqrt(3);

function num(value: ParamValue | undefined, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/**
 * ECU del combustible: cebado de 2 s, relé (con falla intermitente), ancho de
 * pulso e inyección por ángulo, mezcla filtrada, fugas y regulador.
 */
export function createEcuFuel(
  id: string,
  _params: Readonly<Record<string, ParamValue>>,
  signals: FuelSignals,
): ControllerDef {
  const injectors = [{ open: false }, { open: false }, { open: false }, { open: false }];
  const state: Record<string, ControllerStateValue> = {
    relayOn: false,
    primeTimer: 0,
    injectors,
    qInjTotal: 0,
    qInjAvg: 0,
    mixtureRatio: 0,
    qLeakInj: 0,
    qLeakLine: 0,
    qReturn: 0,
    regOpen: 0,
    dpFilter: 0,
  };
  let prevKey = 'off';
  let primeTimer = 0;
  let relayCut = 0;
  let injAvg = 0;
  let injExpected = 0;

  return {
    id,
    probes: ['pRail', 'pFilterIn', 'pFilterOut'],
    state,
    update(ctx): void {
      const dt = ctx.dt;
      const key =
        typeof ctx.params['ignitionKey'] === 'string' ? ctx.params['ignitionKey'] : 'off';

      // Paso 1 (parte del combustible): cebado y relé.
      if (key !== prevKey) {
        if (key === 'on' && prevKey === 'off') primeTimer = K.primeTime;
        if (key === 'off') primeTimer = 0;
        prevKey = key;
      }
      primeTimer = Math.max(0, primeTimer - dt);

      const engineState = signals.engineState;
      const cranking = engineState === 'cranking';
      const running = engineState === 'running' || engineState === 'misfire';
      let relayCmd = primeTimer > 0 || cranking || running;
      if (key === 'off') relayCmd = false;
      const relayFault = ctx.faults['relay'];
      if (relayFault === 'dead') {
        relayCmd = false;
      } else if (relayFault === 'intermittent' && relayCmd) {
        if (relayCut > 0) relayCut -= dt;
        else if (ctx.rng.chance(dt / K.relayCutMeanInterval)) relayCut = K.relayCutTime;
        if (relayCut > 0) relayCmd = false;
      } else {
        relayCut = 0;
      }
      // La llave y el relé van siempre cerrados: el corte lo hace la tensión
      // de la batería (abajo), para que el solver no vea un escalón de
      // conductancia de 1e7 (ver fuel.md §9b, paridad A6).
      const relay = ctx.elements['relay'];
      if (relay) relay.control['closed'] = true;
      const keySwitch = ctx.elements['key'];
      if (keySwitch) keySwitch.control['closed'] = true;
      signals.relayOn = relayCmd;

      // Paso 7: ancho de pulso e inyección por ángulo. La presión de riel es
      // la del paso anterior (como la referencia); el vacío es del mismo paso.
      const rpm = signals.rpmEff;
      const turning = rpm > 0;
      const throttle = clamp(num(ctx.params['throttle']), 0, 1);
      const pwMs = 1.8 + 10.5 * throttle + (cranking ? 3 : 0);
      const pwDeg = ((pwMs * rpm) / 60) * (360 / 1000);
      const pRail = ctx.read('pRail');
      const pMan = signals.pMan;
      const qOpen = KINJ * Math.sqrt(Math.max(0, pRail - pMan));
      const qOpenExpected = KINJ * Math.sqrt(K.regSet);
      let nOpen = 0;
      for (let i = 0; i < 4; i++) {
        const open = turning && wrap(signals.crankAngle - (FIRING_OFFSETS[i] ?? 0), 720) < pwDeg;
        const injector = injectors[i];
        if (injector) injector.open = open;
        if (open) nOpen++;
        const element = ctx.elements[`injector${i + 1}`];
        if (element) element.control['open'] = open;
      }
      injAvg = expSmooth(injAvg, nOpen * qOpen, dt, K.injTau);
      injExpected = expSmooth(injExpected, nOpen * qOpenExpected, dt, K.injTau);
      const mixtureRatio = injExpected > 1e-3 ? injAvg / injExpected : 0;
      signals.mixture = mixtureRatio;

      // Paso 9: fugas (la de línea va por el elemento `leak`; acá se reporta).
      const sqrtRail = pRail > 0 ? Math.sqrt(pRail) : 0;
      const qLeakInj = 0.6 * clamp(num(ctx.faults['injectorLeak']), 0, 1) * sqrtRail;
      const qLeakLine = 2.0 * clamp(num(ctx.faults['lineLeak']), 0, 1) * sqrtRail;

      // Paso 6: regulador (el elemento hace la cuenta; la ECU fija set/retorno).
      const regulatorFault = ctx.faults['regulator'];
      const set = regulatorFault === 'stuckOpen' ? K.regSetStuckOpen : K.regSet;
      const regulator = ctx.elements['regulator'];
      if (regulator) {
        regulator.control['set'] = set;
        regulator.control['noReturn'] = regulatorFault === 'stuckClosed';
      }
      const qReturn =
        regulatorFault === 'stuckClosed'
          ? 0
          : K.kReg * Math.max(0, pRail - (signals.pRef + set));

      state['relayOn'] = relayCmd;
      state['primeTimer'] = primeTimer;
      state['qInjTotal'] = nOpen * qOpen;
      state['qInjAvg'] = injAvg;
      state['mixtureRatio'] = mixtureRatio;
      state['qLeakInj'] = qLeakInj;
      state['qLeakLine'] = qLeakLine;
      state['qReturn'] = qReturn;
      state['regOpen'] = clamp(qReturn / 100, 0, 1);
      state['dpFilter'] = ctx.read('pFilterIn') - ctx.read('pFilterOut');
    },
  };
}

/** Alternador: +1,4 V en marcha y −2 V en arranque sobre la batería. */
export function createAlternator(
  id: string,
  _params: Readonly<Record<string, ParamValue>>,
  signals: FuelSignals,
): ControllerDef {
  return {
    id,
    update(ctx): void {
      const batteryV = clamp(num(ctx.params['batteryV'], K.vNominal), 0, 16);
      const engineState = signals.engineState;
      const running = engineState === 'running' || engineState === 'misfire';
      const cranking = engineState === 'cranking';
      const v = batteryV + (running ? K.alternatorV : 0) - (cranking ? K.crankSagV : 0);
      // Relé abierto → 0 V (la bomba no recibe corriente), como la referencia.
      const battery = ctx.elements['battery'];
      if (battery) battery.control['v'] = signals.relayOn ? v : 0;
    },
  };
}

/** Alimentación: el aire que aspira la bomba sale del nivel del estanque. */
export function createFuelSupply(
  id: string,
  _params: Readonly<Record<string, ParamValue>>,
): ControllerDef {
  return {
    id,
    probes: ['pickupAir'],
    update(ctx): void {
      const pump = ctx.elements['pump'];
      if (pump) pump.control['air'] = clamp(ctx.read('pickupAir'), 0, 1);
    },
  };
}
