// Controlador de la refrigeración (A13, spec cooling §5): calor, advección,
// termostato, ventilador, presión/ebullición, aire, nivel y sensor. Puro (§1);
// corre antes del solver (§25) y lee las sondas del paso anterior.

import { clamp, expSmooth } from '../../core/math.ts';
import type { ParamValue } from '../../core/types.ts';
import type { ControllerContext, ControllerDef, ControllerStateValue } from '../../sim/controllers/base.ts';
import type { LabBus } from '../../sim/signals/bus.ts';
import { K, type CoolingVariant } from './constants.ts';

export type CoolingMode = 'ok' | 'stuckOpen' | 'stuckClosed';
export type SensorMode = 'ok' | 'readsCold' | 'open';

export type CoolingParams = {
  rpm: number;
  load: number;
  vehicleSpeedKmh: number;
  ambientC: number;
  heaterOn: boolean;
  batteryV: number;
  fastThermal: boolean;
};

export type CoolingFaults = {
  thermostat: CoolingMode;
  pumpWear: number;
  pumpLeak: number;
  hoseLeak: number;
  beltSlip: number;
  finsClog: number;
  tubesClog: number;
  capFailed: boolean;
  heaterClog: number;
  fanDead: boolean;
  fanClutchWorn: number;
  fanSwitchDead: boolean;
  sensorFault: SensorMode;
};

export type CoolingState = {
  engineTemp: number;
  radiatorTemp: number;
  heaterTemp: number;
  gaugeTemp: number;
  thermostatOpen: number;
  qPump: number;
  qRadiator: number;
  qBypass: number;
  qHeater: number;
  pSystem: number;
  boilPoint: number;
  boiling: boolean;
  level: number;
  pumpAir: number;
  fanOn: boolean;
  fanAir: number;
  fanCurrent: number;
  heatIn: number;
  heatRadiator: number;
  heatCabin: number;
};

export const DEFAULT_PARAMS: Readonly<CoolingParams> = {
  rpm: 800,
  load: 0,
  vehicleSpeedKmh: 0,
  ambientC: 25,
  heaterOn: false,
  batteryV: 13.8,
  fastThermal: false,
};

export const DEFAULT_FAULTS: Readonly<CoolingFaults> = {
  thermostat: 'ok',
  pumpWear: 0,
  pumpLeak: 0,
  hoseLeak: 0,
  beltSlip: 0,
  finsClog: 0,
  tubesClog: 0,
  capFailed: false,
  heaterClog: 0,
  fanDead: false,
  fanClutchWorn: 0,
  fanSwitchDead: false,
  sensorFault: 'ok',
};

export function createInitialCoolingState(): CoolingState {
  return {
    engineTemp: 25,
    radiatorTemp: 25,
    heaterTemp: 25,
    gaugeTemp: 25,
    thermostatOpen: 0,
    qPump: 0,
    qRadiator: 0,
    qBypass: 0,
    qHeater: 0,
    pSystem: 0,
    boilPoint: K.boilBase,
    boiling: false,
    level: K.levelFull,
    pumpAir: 0,
    fanOn: false,
    fanAir: 0,
    fanCurrent: 0,
    heatIn: 0,
    heatRadiator: 0,
    heatCabin: 0,
  };
}

export interface CoolingController extends ControllerDef {
  readonly cooling: CoolingState;
  /** Acción `topUp()`: rellena el refrigerante. */
  topUp(): void;
  /** Acción `setEngineTemp(°C)`: motor y radiador a esa temperatura. */
  setEngineTemp(value: number): void;
}

export interface CoolingOptions {
  bus: LabBus;
  variant: CoolingVariant;
  /** Escribe el potencial de un nodo del circuito (acción del modo). */
  setPotential(part: string, port: string, value: number): void;
}

function num(value: ParamValue | undefined, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function flag(value: ParamValue | undefined): boolean {
  return value === true;
}

function str<T extends string>(value: ParamValue | undefined, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

export function createCooling(
  id: string,
  _params: Readonly<Record<string, ParamValue>>,
  options: CoolingOptions,
): CoolingController {
  const bus = options.bus;
  const electric = options.variant === 'electric';
  const state = createInitialCoolingState();
  const controllerState: Record<string, ControllerStateValue> = state;
  let initialized = false;
  let level: number = K.levelFull;

  function topUp(): void {
    level = K.levelFull;
  }

  function setEngineTemp(value: number): void {
    const t = clamp(Number.isFinite(value) ? value : 0, -40, 200);
    initialized = true;
    options.setPotential('tEngine', 'a', t);
    options.setPotential('tRadiator', 'a', t);
    options.setPotential('tHeater', 'a', t);
  }

  function update(ctx: ControllerContext): void {
    const dt = ctx.dt;
    const params = ctx.params;
    const faults = ctx.faults;

    const ambient = clamp(num(params['ambientC'], 25), -40, 60);
    if (!initialized) {
      initialized = true;
      options.setPotential('tEngine', 'a', ambient);
      options.setPotential('tRadiator', 'a', ambient);
      options.setPotential('tHeater', 'a', ambient);
    }
    const ambientSrc = ctx.elements['ambient'];
    if (ambientSrc) ambientSrc.control['t'] = ambient;

    const rpm = clamp(num(params['rpm']), 0, K.maxRpm);
    const load = clamp(num(params['load']), 0, 1);
    const speed = clamp(num(params['vehicleSpeedKmh']), 0, 220);
    const running = rpm > 0;
    const fast = flag(params['fastThermal']) ? K.fastThermal : 1;

    // Temperaturas y sensor (la lectura publicada es la del reloj).
    const engineTemp = ctx.read('tEngine');
    const radiatorTemp = ctx.read('tRadiator');
    const heaterTemp = ctx.read('tHeater');
    const sensor = str(faults['sensorFault'], ['ok', 'readsCold', 'open'] as const, 'ok');
    const gaugeTemp =
      sensor === 'readsCold' ? engineTemp - K.sensorColdC : sensor === 'open' ? K.sensorOpenC : engineTemp;

    // Termostato: la cera sigue a la temperatura del motor con τ = 5 s.
    const thermostatFault = str(faults['thermostat'], ['ok', 'stuckOpen', 'stuckClosed'] as const, 'ok');
    const target =
      thermostatFault === 'stuckOpen'
        ? 1
        : thermostatFault === 'stuckClosed'
          ? 0
          : clamp((engineTemp - 88) / 12, 0, 1);
    state.thermostatOpen = expSmooth(state.thermostatOpen, target, dt, K.thermostatTau);
    const thermostat = ctx.elements['thermostat'];
    if (thermostat) thermostat.control['open'] = state.thermostatOpen;
    const heaterValve = ctx.elements['heaterValve'];
    if (heaterValve) {
      heaterValve.control['open'] = flag(params['heaterOn'])
        ? 1 - 0.97 * clamp(num(faults['heaterClog']), 0, 1)
        : 0;
    }

    // Presión del sistema y aire en la bomba (§5.4–§5.6).
    state.pSystem = flag(faults['capFailed'])
      ? 0
      : clamp(K.pressureK * (engineTemp - K.pressureT0), 0, K.pressureMax);
    const tank = ctx.elements['expansionTank'];
    if (tank) tank.control['p'] = state.pSystem;
    state.boilPoint = K.boilBase + K.boilPerBar * state.pSystem;
    state.boiling = engineTemp > state.boilPoint;
    const airLevel = clamp((K.levelAir - level) / K.levelAirSpan, 0, 0.9);
    const airBoil = clamp((engineTemp - state.boilPoint) / K.boilAirSpan, 0, 0.8);
    state.pumpAir = Math.max(airLevel, airBoil);

    const pump = ctx.elements['waterPump'];
    if (pump) {
      const slip = clamp(num(faults['beltSlip']), 0, 1);
      pump.control['n'] = rpm * (1 - 0.5 * slip);
      pump.control['air'] = state.pumpAir;
      pump.control['wear'] = clamp(num(faults['pumpWear']), 0, 1);
    }
    const pumpLeak = ctx.elements['pumpLeak'];
    if (pumpLeak) pumpLeak.control['severity'] = clamp(num(faults['pumpLeak']), 0, 1);
    const hoseLeak = ctx.elements['hoseLeak'];
    if (hoseLeak) hoseLeak.control['severity'] = clamp(num(faults['hoseLeak']), 0, 1);

    // Ventilador.
    if (electric) {
      if (gaugeTemp > K.fanOnC) state.fanOn = true;
      else if (gaugeTemp < K.fanOffC) state.fanOn = false;
      const dead = flag(faults['fanDead']) || flag(faults['fanSwitchDead']);
      const relay = ctx.elements['fanRelay'];
      if (relay) relay.control['closed'] = state.fanOn && !dead;
      const battery = ctx.elements['battery'];
      if (battery) battery.control['v'] = clamp(num(params['batteryV'], 13.8), 0, 16);
      state.fanCurrent = ctx.read('fanI');
      state.fanAir = dead ? 0 : K.fanAirMax * clamp(state.fanCurrent / K.fanCurrentRef, 0, 1.1);
    } else {
      const worn = clamp(num(faults['fanClutchWorn']), 0, 1);
      let couple = Math.min(
        K.clutchMin + K.clutchSpan * clamp((radiatorTemp - K.clutchTRef) / K.clutchTSpan, 0, 1),
        K.clutchMax - K.clutchWorn * worn,
      );
      if (flag(faults['fanDead'])) couple = 0;
      state.fanAir = Math.min(K.fanAirMaxViscous, K.fanAirMax * (rpm / K.fanOnRpmRef) * couple);
      state.fanOn = couple > 0.05;
      state.fanCurrent = 0;
    }

    // Calor que entra y advección (los dos sentidos del lazo). El estado
    // publica valores sin escalar; `fastThermal` sólo escala los controles.
    const heatInW = running ? K.heatBase + (K.heatSpan * load * rpm) / K.pumpNRef : 0;
    state.heatIn = heatInW;
    const heat = ctx.elements['heat'];
    if (heat) heat.control['q'] = heatInW * fast;
    const qRadiator = Math.max(0, ctx.read('qRadiator'));
    const qHeater = Math.max(0, ctx.read('qHeater'));
    const mcRadiator = K.mcPerLh * qRadiator * (1 - state.pumpAir) * fast;
    const mcHeater = K.mcPerLh * qHeater * (1 - state.pumpAir) * fast;
    for (const name of ['advEngineRadiator', 'advRadiatorEngine']) {
      const element = ctx.elements[name];
      if (element) element.control['mc'] = mcRadiator;
    }
    for (const name of ['advEngineHeater', 'advHeaterEngine']) {
      const element = ctx.elements[name];
      if (element) element.control['mc'] = mcHeater;
    }

    // Radiador y pérdidas: UA al aire, calefactor a la cabina.
    const air = speed / 3.6 + state.fanAir;
    const ua =
      (K.uaBase + K.uaSpan * (1 - Math.exp(-air / K.airTau))) *
      (1 - K.finsUa * clamp(num(faults['finsClog']), 0, 1)) *
      (1 - K.tubesUa * clamp(num(faults['tubesClog']), 0, 1));
    const radiatorLoss = ctx.elements['radiatorLoss'];
    if (radiatorLoss) radiatorLoss.control['g'] = ua * fast;
    const engineLoss = ctx.elements['engineLoss'];
    if (engineLoss) engineLoss.control['g'] = K.gEngineAmbient * fast;
    const cabin = ctx.elements['cabinHeater'];
    if (cabin) cabin.control['g'] = (flag(params['heaterOn']) ? K.gCabin : 0) * fast;
    const coolant = ctx.elements['radiator'];
    if (coolant) coolant.control['clog'] = clamp(num(faults['tubesClog']), 0, 1);

    // Nivel: las fugas sólo fluyen con presión (§5.7).
    const leakPump = ctx.read('qPumpLeak');
    const leakHose = ctx.read('qHoseLeak');
    level = clamp(level - ((leakPump + leakHose) / 3600) * dt, 0, K.levelFull);

    // Estado publicado.
    state.engineTemp = engineTemp;
    state.radiatorTemp = radiatorTemp;
    state.heaterTemp = heaterTemp;
    state.gaugeTemp = gaugeTemp;
    state.qPump = ctx.read('qPump');
    state.qRadiator = ctx.read('qRadiator');
    state.qBypass = ctx.read('qBypass');
    state.qHeater = ctx.read('qHeater');
    state.level = level;
    state.heatRadiator = (ua * (radiatorTemp - ambient)) / 1000;
    state.heatCabin = flag(params['heaterOn']) ? (K.gCabin * (heaterTemp - ambient)) / 1000 : 0;

    bus.set('cooling', 'engine.coolantTemp', gaugeTemp);
    bus.set('cooling', 'cooling.boiling', state.boiling ? 1 : 0);
  }

  return {
    id,
    state: controllerState,
    update,
    cooling: state,
    topUp,
    setEngineTemp,
  };
}
