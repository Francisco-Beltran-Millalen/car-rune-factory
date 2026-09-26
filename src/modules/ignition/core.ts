// Controlador del encendido (A12): modelo por eventos con carga de corriente
// media al solver (spec ignition §5). Puro (§1); corre antes del solver (§25)
// y lee la tensión de la bobina del paso anterior.

import { clamp, expSmooth, wrap } from '../../core/math.ts';
import type { ParamValue } from '../../core/types.ts';
import type { ControllerContext, ControllerDef, ControllerStateValue } from '../../sim/controllers/base.ts';
import type { LabBus } from '../../sim/signals/bus.ts';
import { FIRING_OFFSETS, IG, type IgnitionVariant } from './constants.ts';
import {
  arcMs,
  availableVoltageKv,
  breakCurrent,
  chargeIntegral,
  copAdvance,
  dwellSeconds,
  pointsAdvance,
  requiredVoltageKv,
  sparkEnergy,
  sparkPressure,
} from './events.ts';

export type IgnitionKey = 'off' | 'on' | 'start' | 'run';

export type IgnitionParams = {
  ignitionKey: IgnitionKey;
  rpm: number;
  throttle: number;
  batteryV: number;
  camOffset: number;
  compression: number;
  humidity: number;
  dwellMs: number;
};

export type IgnitionFaults = {
  plugGapWear: number;
  plugFouled2: number;
  coilWeak: number;
  pointsGap: number;
  pointsPitted: number;
  condenserOpen: boolean;
  condenserShorted: boolean;
  ballastOpen: boolean;
  capCracked: number;
  rotorWorn: number;
  htLead3Open: boolean;
  centrifugalStuck: boolean;
  vacuumDiaphragm: boolean;
  crankSensorDead: boolean;
  crankSensorGap: number;
  camSensorDead: boolean;
  coil2Dead: boolean;
  igniterDead: boolean;
};

export type IgnitionState = {
  crankAngle: number;
  camAngle: number;
  advance: number;
  dwellMs: number;
  iBreak: number;
  /** mJ. */
  energy: number;
  /** kV. */
  vAvail: number;
  vReq: number;
  arcMs: number;
  lastCylinder: number;
  sparkOk: boolean;
  sparkRate: number;
  /** [4] 0..1, media por cilindro. */
  sparks: number[];
  /** [4] 0..1, pulso del último evento (destello de la bujía). */
  pulses: number[];
  coilV: number;
  busCurrent: number;
  sync: boolean;
  /** RPM a partir de la cual sincroniza el sensor de cigüeñal (COP). */
  syncRpm: number;
  /** Platinos cerrados ahora (cargando la bobina). */
  pointsOpen: boolean;
  codes: string[];
  pitting: number;
  eventCount: number;
};

export const DEFAULT_PARAMS: Readonly<IgnitionParams> = {
  ignitionKey: 'off',
  rpm: 800,
  throttle: 0,
  batteryV: 12.6,
  camOffset: 0,
  compression: 1,
  humidity: 0,
  dwellMs: 3,
};

export const DEFAULT_FAULTS: Readonly<IgnitionFaults> = {
  plugGapWear: 0,
  plugFouled2: 0,
  coilWeak: 0,
  pointsGap: 0,
  pointsPitted: 0,
  condenserOpen: false,
  condenserShorted: false,
  ballastOpen: false,
  capCracked: 0,
  rotorWorn: 0,
  htLead3Open: false,
  centrifugalStuck: false,
  vacuumDiaphragm: false,
  crankSensorDead: false,
  crankSensorGap: 0,
  camSensorDead: false,
  coil2Dead: false,
  igniterDead: false,
};

export function createInitialIgnitionState(): IgnitionState {
  return {
    crankAngle: 0,
    camAngle: 0,
    advance: 0,
    dwellMs: 0,
    iBreak: 0,
    energy: 0,
    vAvail: 0,
    vReq: 0,
    arcMs: 0,
    lastCylinder: 0,
    sparkOk: false,
    sparkRate: 1,
    sparks: [1, 1, 1, 1],
    pulses: [0, 0, 0, 0],
    coilV: 0,
    busCurrent: 0,
    sync: true,
    syncRpm: 0,
    pointsOpen: true,
    codes: [],
    pitting: 0,
    eventCount: 0,
  };
}

export interface IgnitionController extends ControllerDef {
  /** Estado mutable que el compilador publica (tests). */
  readonly ignition: IgnitionState;
}

export interface IgnitionOptions {
  bus: LabBus;
  variant: IgnitionVariant;
}

interface StepEvent {
  cylinder: number;
  coil: number;
  offset: number;
  kind: 'start' | 'break';
}

function num(value: ParamValue | undefined, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function flag(value: ParamValue | undefined): boolean {
  return value === true;
}

function signedWrap(deg: number): number {
  const w = wrap(deg, 720);
  return w > 360 ? w - 720 : w;
}

export function createIgnition(
  id: string,
  _params: Readonly<Record<string, ParamValue>>,
  options: IgnitionOptions,
): IgnitionController {
  const points = options.variant === 'points';
  const bus = options.bus;
  const state = createInitialIgnitionState();
  const controllerState: Record<string, ControllerStateValue> = state;
  /** Resultado del último evento por cilindro (0/1). */
  const lastResult = [1, 1, 1, 1];
  const charging = [false, false, false, false];
  const chargeStart = [0, 0, 0, 0];
  const coilCount = points ? 1 : 4;
  let refValue = 0;
  let refValid = false;
  let simTime = 0;
  let correlationTimer = 0;
  let pitting = 0;
  let eventCount = 0;

  function limitOf(): number {
    return points ? 0 : IG.copCurrentLimit;
  }

  function inductanceOf(coil: number, faults: Readonly<Record<string, ParamValue>>): number {
    const weak = clamp(num(faults['coilWeak']), 0, 1);
    if (points) return IG.pointsL * (1 - 0.6 * weak);
    return coil === 2 ? IG.copL * (1 - 0.6 * weak) : IG.copL;
  }

  function killCheck(
    cylinder: number,
    faults: Readonly<Record<string, ParamValue>>,
    sync: boolean,
    key: IgnitionKey,
  ): boolean {
    if (points) {
      if (flag(faults['condenserShorted'])) return true;
      if (flag(faults['ballastOpen']) && key === 'run') return true;
      if (flag(faults['htLead3Open']) && cylinder === 2) return true;
      return false;
    }
    if (flag(faults['igniterDead']) || !sync) return true;
    if (flag(faults['coil2Dead']) && cylinder === 1) return true;
    return false;
  }

  function update(ctx: ControllerContext): void {
    const dt = ctx.dt;
    const params = ctx.params;
    const faults = ctx.faults;
    const key: IgnitionKey =
      typeof params['ignitionKey'] === 'string' &&
      ['off', 'on', 'start', 'run'].includes(params['ignitionKey'])
        ? (params['ignitionKey'] as IgnitionKey)
        : 'off';

    // Baja tensión: batería, llave, balasto y puente de arranque.
    const battery = ctx.elements['battery'];
    if (battery) battery.control['v'] = clamp(num(params['batteryV'], 12.6), 0, 16);
    const keySwitch = ctx.elements['key'];
    if (keySwitch) keySwitch.control['closed'] = key !== 'off';
    const ballast = ctx.elements['ballast'];
    if (ballast) ballast.control['closed'] = !flag(faults['ballastOpen']);
    const bridge = ctx.elements['startBridge'];
    if (bridge) bridge.control['closed'] = key === 'start';

    const rpm = clamp(num(params['rpm']), 0, IG.maxRpm);
    const throttle = clamp(num(params['throttle']), 0, 1);
    const map = clamp(bus.get('intake.map'), -1, 1);
    const compression = clamp(bus.get('engine.compression'), 0, 1.5);
    const crankAngle = bus.get('engine.crankAngle');
    const camAngle = bus.get('engine.camAngle');
    const camOffset = clamp(num(params['camOffset']), -20, 20);
    const coilV = ctx.read('coilV');

    // Avance: platinos mide sobre la leva; el publicado va medido en el
    // cigüeñal (con el atraso de la leva adentro; spec §5.2 y plan §4).
    const pointsGap = clamp(num(faults['pointsGap']), 0, 1);
    const advanceCam = flag(faults['centrifugalStuck'])
      ? pointsAdvance(1000, map, throttle, pointsGap)
      : pointsAdvance(rpm, map, throttle, pointsGap);
    const advanceCrank = points ? advanceCam - camOffset : copAdvance(rpm, map);

    // Sincronía (COP): sensor de cigüeñal y separación.
    const sensorGap = clamp(num(faults['crankSensorGap']), 0, 1);
    const sync = points
      ? true
      : !flag(faults['crankSensorDead']) && rpm >= IG.syncBaseRpm + IG.syncGapRpm * sensorGap;

    const ref = points ? camAngle : crankAngle;
    const dDeg = refValid ? wrap(ref - refValue, 720) : 0;
    refValue = ref;
    refValid = true;

    const dwellSec = rpm > 0 ? dwellSeconds(num(params['dwellMs'], 3), rpm, points) : 0;
    const dwellDeg = dwellSec * (rpm / 60) * 360;
    const wasted = !points && flag(faults['camSensorDead']) && sync;

    // Umbrales del paso: arranque del dwell y corte de cada cilindro.
    const events: StepEvent[] = [];
    if (dDeg > 0 && rpm > 0 && sync) {
      for (let i = 0; i < 4; i++) {
        const advanceRef = points ? advanceCam : advanceCrank;
        const breakAngle = wrap(360 - advanceRef + (FIRING_OFFSETS[i] ?? 0), 720);
        const coil = points ? 0 : i;
        const breakAngles = wasted ? [breakAngle, wrap(breakAngle + 360, 720)] : [breakAngle];
        for (const angle of breakAngles) {
          const relBreak = wrap(angle - ref, 720);
          const relStart = wrap(angle - dwellDeg - ref, 720);
          if (relBreak < dDeg) events.push({ cylinder: i, coil, offset: relBreak, kind: 'break' });
          if (relStart < dDeg) events.push({ cylinder: i, coil, offset: relStart, kind: 'start' });
        }
      }
      events.sort((a, b) => a.offset - b.offset);
    }

    const rBallast = points && key === 'run' ? IG.pointsBallastR : 0;
    const rPitting = points
      ? IG.pittingR * Math.max(clamp(num(faults['pointsPitted']), 0, 1), pitting)
      : 0;
    const rTotal = (points ? IG.pointsPrimaryR : IG.copPrimaryR) + rBallast + rPitting;
    const eta = points && flag(faults['condenserOpen']) ? IG.condenserOpenEta : IG.eta;
    const gap = IG.gapBase + IG.gapWearSpan * clamp(num(faults['plugGapWear']), 0, 1);
    const fouled = clamp(num(faults['plugFouled2']), 0, 1) * IG.fouledGain;
    const rotor = clamp(num(faults['rotorWorn']), 0, 1) * IG.rotorWornKv;
    const capCracked = points
      ? clamp(num(faults['capCracked']), 0, 1) * (0.3 + 0.7 * clamp(num(params['humidity']), 0, 1))
      : 0;

    // Consumo: se recorre el paso partido por los eventos (A·s por bobina).
    const charge = [0, 0, 0, 0];
    const timeAt = (offset: number): number => simTime + (offset / dDeg) * dt;
    let segTime = simTime;
    for (const event of events) {
      const eventTime = timeAt(event.offset);
      for (let i = 0; i < coilCount; i++) {
        if (!charging[i]) continue;
        const l = inductanceOf(i, faults);
        charge[i] =
          (charge[i] ?? 0) +
          chargeIntegral(eventTime - (chargeStart[i] ?? 0), coilV, rTotal, l, limitOf()) -
          chargeIntegral(segTime - (chargeStart[i] ?? 0), coilV, rTotal, l, limitOf());
      }
      segTime = eventTime;

      if (event.kind === 'start') {
        charging[event.coil] = true;
        chargeStart[event.coil] = eventTime;
        continue;
      }

      charging[event.coil] = false;
      const l = inductanceOf(event.coil, faults);
      const started = chargeStart[event.coil] ?? 0;
      const elapsed = started > 0 ? Math.max(eventTime - started, 1e-6) : Math.max(dwellSec, 1e-6);
      const iBreak = breakCurrent(coilV, rTotal, l, elapsed, limitOf());
      const energy = sparkEnergy(iBreak, l);
      const vAvail = availableVoltageKv(energy, eta);
      const p = sparkPressure(map, advanceCrank, compression);
      const vReq = requiredVoltageKv(gap, p, points ? rotor : 0);
      let ok = !killCheck(event.cylinder, faults, sync, key) && vAvail * (1 - fouled) >= vReq;
      if (ok && capCracked > 0 && ctx.rng.chance(capCracked)) ok = false;

      lastResult[event.cylinder] = ok ? 1 : 0;
      if (ok) state.pulses[event.cylinder] = 1;
      state.iBreak = iBreak;
      state.energy = energy * 1000;
      state.vAvail = vAvail;
      state.vReq = vReq;
      state.arcMs = ok ? arcMs(energy, eta, vReq) : 0;
      state.lastCylinder = event.cylinder + 1;
      state.sparkOk = ok;
      eventCount++;
    }
    for (let i = 0; i < coilCount; i++) {
      if (!charging[i]) continue;
      const l = inductanceOf(i, faults);
      charge[i] =
        (charge[i] ?? 0) +
        chargeIntegral(simTime + dt - (chargeStart[i] ?? 0), coilV, rTotal, l, limitOf()) -
        chargeIntegral(segTime - (chargeStart[i] ?? 0), coilV, rTotal, l, limitOf());
    }

    // Consumo medio al solver: cada bobina su currentLoad. La lectura del
    // estado va suavizada (τ = 0,1 s) para que se lea como un amperímetro.
    let stepBus = 0;
    for (let i = 0; i < coilCount; i++) {
      const average = dt > 0 ? (charge[i] ?? 0) / dt : 0;
      stepBus += average;
      const element = ctx.elements[points ? 'coil' : `coil${i + 1}`];
      if (element) element.control['i'] = average;
    }
    if (!sync) lastResult.fill(0);
    state.busCurrent = expSmooth(state.busCurrent, stepBus, dt, 0.1);

    const globalKill = points
      ? flag(faults['condenserShorted']) || (flag(faults['ballastOpen']) && key === 'run')
      : flag(faults['igniterDead']) || !sync;
    if (globalKill) {
      lastResult.fill(0);
      state.sparks.fill(0);
      state.sparkRate = 0;
    } else {
      for (let i = 0; i < 4; i++) {
        state.sparks[i] = expSmooth(state.sparks[i] ?? 1, lastResult[i] ?? 1, dt, IG.sparkTau);
      }
      state.sparkRate =
        ((state.sparks[0] ?? 1) +
          (state.sparks[1] ?? 1) +
          (state.sparks[2] ?? 1) +
          (state.sparks[3] ?? 1)) /
        4;
    }

    if (points && flag(faults['condenserOpen']) && events.length > 0) {
      pitting = clamp(pitting + IG.pittingGain * dt, 0, 1);
    }
    for (let i = 0; i < 4; i++) {
      state.pulses[i] = Math.max(0, (state.pulses[i] ?? 0) - dt * 12);
    }

    const codes: string[] = [];
    if (!points) {
      if (flag(faults['camSensorDead'])) codes.push('P0340');
      const measured = Math.abs(signedWrap(crankAngle - camAngle));
      if (measured > IG.correlationDeg) correlationTimer += dt;
      else correlationTimer = 0;
      if (correlationTimer >= IG.correlationTime) codes.push('P0016');
    }

    state.crankAngle = crankAngle;
    state.camAngle = camAngle;
    state.advance = advanceCrank;
    state.dwellMs = dwellSec * 1000;
    state.coilV = coilV;
    state.sync = sync;
    state.syncRpm = IG.syncBaseRpm + IG.syncGapRpm * sensorGap;
    state.pointsOpen = !charging[0];
    state.codes = codes;
    state.pitting = pitting;
    state.eventCount = eventCount;

    const vacuumLeak =
      points && flag(faults['vacuumDiaphragm']) ? (map < -0.1 ? IG.vacuumLeakKgH : 0.25) : 0;
    bus.set('ignition', 'ignition.spark', clamp(state.sparkRate, 0, 1));
    bus.set('ignition', 'ignition.advance', advanceCrank);
    bus.set('ignition', 'ignition.vacuumLeak', vacuumLeak);
    bus.set('ignition', 'ecu.sync', sync ? 1 : 0);

    simTime += dt;
  }

  return {
    id,
    state: controllerState,
    update,
    ignition: state,
  };
}
