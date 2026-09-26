// Controlador de la lubricación (A14, spec lubrication §5): viscosidad,
// cojinetes, aire/cavitación, daño, testigo y manómetro. Puro (§1); corre
// antes del solver (§25) y lee las sondas del paso anterior.

import { clamp, expSmooth } from '../../core/math.ts';
import type { ParamValue } from '../../core/types.ts';
import type { ControllerContext, ControllerDef, ControllerStateValue } from '../../sim/controllers/base.ts';
import type { LabBus } from '../../sim/signals/bus.ts';
import { K, viscosityOf, type LubricationVariant, type OilGrade } from './constants.ts';

export type KeyState = 'off' | 'on' | 'run';
export type SwitchMode = 'ok' | 'alwaysOn' | 'neverOn';

export type LubricationParams = {
  ignitionKey: KeyState;
  rpm: number;
  oilTempC: number;
  oilGrade: OilGrade;
  lateralG: number;
};

export type LubricationFaults = {
  bearingWear: number;
  pumpWear: number;
  reliefStuckOpen: boolean;
  filterClog: number;
  pickupClog: number;
  filterGasketLeak: number;
  panDrip: number;
  antiDrainbackFailed: boolean;
  switchStuck: SwitchMode;
};

export type LubricationState = {
  pGallery: number;
  pPumpOut: number;
  pSuction: number;
  dpFilter: number;
  qPump: number;
  qRelief: number;
  qBypass: number;
  qBearings: number;
  viscosity: number;
  oilTemp: number;
  level: number;
  pumpAir: number;
  bypassOpen: boolean;
  lampOn: boolean;
  gauge: number;
  bearingDamage: number;
  seized: boolean;
  knock: number;
  startupDry: number;
};

export const DEFAULT_PARAMS: Readonly<LubricationParams> = {
  ignitionKey: 'off',
  rpm: 800,
  oilTempC: 90,
  oilGrade: '10W-40',
  lateralG: 0,
};

export const DEFAULT_FAULTS: Readonly<LubricationFaults> = {
  bearingWear: 0,
  pumpWear: 0,
  reliefStuckOpen: false,
  filterClog: 0,
  pickupClog: 0,
  filterGasketLeak: 0,
  panDrip: 0,
  antiDrainbackFailed: false,
  switchStuck: 'ok',
};

export function createInitialLubricationState(): LubricationState {
  return {
    pGallery: 0,
    pPumpOut: 0,
    pSuction: 0,
    dpFilter: 0,
    qPump: 0,
    qRelief: 0,
    qBypass: 0,
    qBearings: 0,
    viscosity: 0,
    oilTemp: 90,
    level: K.levelFull,
    pumpAir: 0,
    bypassOpen: false,
    lampOn: false,
    gauge: 0,
    bearingDamage: 0,
    seized: false,
    knock: 0,
    startupDry: 0,
  };
}

export interface LubricationController extends ControllerDef {
  readonly lube: LubricationState;
  /** Acción `setOilLevel(L)`. */
  setOilLevel(liters: number): void;
  /** Acción `changeOil()`: 4 L nuevos (las fallas las cambia el modo). */
  changeOil(): void;
}

export interface LubricationOptions {
  bus: LabBus;
  variant: LubricationVariant;
}

function num(value: ParamValue | undefined, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function flag(value: ParamValue | undefined): boolean {
  return value === true;
}

function str<T extends string>(
  value: ParamValue | undefined,
  allowed: readonly T[],
  fallback: T,
): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

export function createLubrication(
  id: string,
  _params: Readonly<Record<string, ParamValue>>,
  options: LubricationOptions,
): LubricationController {
  const bus = options.bus;
  const state = createInitialLubricationState();
  const controllerState: Record<string, ControllerStateValue> = state;
  let stoppedTime = 0;
  let startupDry = 0;
  let airCav = 0;
  let pendingLevel: number | null = null;

  function setOilLevel(liters: number): void {
    pendingLevel = clamp(Number.isFinite(liters) ? liters : 0, 0, K.sumpCapacity);
  }

  function changeOil(): void {
    pendingLevel = K.levelFull;
  }

  function update(ctx: ControllerContext): void {
    const dt = ctx.dt;
    const params = ctx.params;
    const faults = ctx.faults;

    if (pendingLevel !== null) {
      const sumpElement = ctx.elements['sump'];
      if (sumpElement) sumpElement.state['level'] = pendingLevel;
      pendingLevel = null;
    }

    // rpm y carga vienen del bus (§12, §29): en el laboratorio los da el stub.
    const key = str(params['ignitionKey'], ['off', 'on', 'run'] as const, 'off');
    const rpm = clamp(bus.get('engine.rpm'), 0, K.maxRpm);
    const load = clamp(bus.get('engine.load'), 0, 1);
    const running = rpm > 0;
    const oilTemp = clamp(num(params['oilTempC'], 90), -20, 160);
    const grade = str(params['oilGrade'], ['5W-30', '10W-40', '20W-50'] as const, '10W-40');
    const lateralG = clamp(num(params['lateralG']), 0, 1);
    const visc = viscosityOf(grade, oilTemp);

    // Cojinetes: g ∝ 1/viscosidad y crece con el juego (1 + wear)³.
    const wearEf = Math.max(clamp(num(faults['bearingWear']), 0, 1), state.bearingDamage);
    const gBase = (K.gTotal * K.wearRef) / visc;
    const gFactor = Math.pow(1 + wearEf, 3);
    const setG = (name: string, share: number): void => {
      const element = ctx.elements[name];
      if (element) element.control['g'] = gBase * share * gFactor;
    };
    setG('mainBearings', K.shareMain);
    setG('rodBearings', K.shareRod);
    setG('camBearings', K.shareCam);

    // Bomba y válvula de alivio.
    const pumpWear = clamp(num(faults['pumpWear']), 0, 1);
    const pump = ctx.elements['oilPump'];
    if (pump) {
      // El caudal ya baja con `wear` en la ley de la bomba (wearQ = 0,5).
      pump.control['n'] = state.seized ? 0 : rpm;
      pump.control['wear'] = pumpWear;
      pump.control['slipFactor'] = K.wearRef / visc;
    }
    const relief = ctx.elements['reliefValve'];
    if (relief) relief.control['set'] = flag(faults['reliefStuckOpen']) ? K.reliefSetOpen : K.reliefSet;

    const filter = ctx.elements['oilFilter'];
    if (filter) filter.control['clog'] = clamp(num(faults['filterClog']), 0, 1);
    const pickup = ctx.elements['pickup'];
    if (pickup) pickup.control['clog'] = clamp(num(faults['pickupClog']), 0, 1);
    const gasket = ctx.elements['filterLeak'];
    if (gasket) gasket.control['severity'] = clamp(num(faults['filterGasketLeak']), 0, 1);
    const sump = ctx.elements['sump'];
    if (sump) sump.control['drain'] = K.panDrip * clamp(num(faults['panDrip']), 0, 1);

    // Antirretorno (enroscable): tras 60 s detenido, 3 s sin presión.
    if (!running) {
      stoppedTime += dt;
    } else {
      if (stoppedTime > K.dryAfter && flag(faults['antiDrainbackFailed']) && options.variant === 'lamp') {
        startupDry = K.dryTime;
      }
      stoppedTime = 0;
    }
    startupDry = Math.max(0, startupDry - dt);

    // Aire: nivel efectivo (curvas) + cavitación + filtro vacío.
    const pSuction = ctx.read('pSuction');
    const level = clamp(ctx.read('level'), 0, K.sumpCapacity);
    const levelEff = level - K.lateralShift * lateralG;
    const airLevel = clamp((K.airLevelRef - levelEff) / 1, 0, 1);
    // Filtrado (τ = cavTau): con el paso de retraso (§25) el lazo aire →
    // caudal → p_aspiración oscila 0,8 ↔ 0 cada paso (ganancia ≈ 7).
    airCav = expSmooth(airCav, clamp((K.cavRef - pSuction) / K.cavSpan, 0, 0.8), dt, K.cavTau);
    state.pumpAir = Math.max(airLevel, airCav, startupDry > 0 ? 1 : 0);
    if (pump) pump.control['air'] = state.pumpAir;

    // Llave, batería y testigo.
    const keySwitch = ctx.elements['key'];
    if (keySwitch) keySwitch.control['closed'] = key !== 'off';
    const battery = ctx.elements['battery'];
    if (battery) battery.control['v'] = running ? K.vBusRun : K.vBusOff;
    const pGallery = ctx.read('pGallery');
    const switchMode = str(
      faults['switchStuck'],
      ['ok', 'alwaysOn', 'neverOn'] as const,
      'ok',
    );
    const switchClosed =
      switchMode === 'alwaysOn'
        ? true
        : switchMode === 'neverOn'
          ? false
          : pGallery < K.switchBar;
    const pressureSwitch = ctx.elements['pressureSwitch'];
    if (pressureSwitch) pressureSwitch.control['closed'] = switchClosed;

    // Daño de cojinetes y agarrotamiento.
    if (running && !state.seized && pGallery < 0.3) {
      state.bearingDamage = clamp(
        state.bearingDamage + K.damageRate * (rpm / 3000) * dt,
        0,
        1,
      );
      if (state.bearingDamage >= K.damageSeized) state.seized = true;
    }

    // Estado publicado.
    state.pGallery = pGallery;
    state.pPumpOut = ctx.read('pPumpOut');
    state.pSuction = pSuction;
    state.dpFilter = ctx.read('pFilterIn') - ctx.read('pFilterOut');
    state.qPump = ctx.read('qPump');
    state.qRelief = ctx.read('qRelief');
    state.qBypass = ctx.read('qBypass');
    state.qBearings = ctx.read('qMain') + ctx.read('qRod') + ctx.read('qCam');
    state.viscosity = visc;
    state.oilTemp = oilTemp;
    state.level = level;
    state.bypassOpen = state.qBypass > 1;
    state.lampOn = key !== 'off' && switchClosed;
    state.gauge = expSmooth(state.gauge, pGallery, dt, K.gaugeTau);
    state.knock = running ? clamp((wearEf - 0.5) * 2, 0, 1) * load : 0;
    state.startupDry = startupDry;

    bus.set('lubrication', 'lubrication.pressure', pGallery);
    bus.set('lubrication', 'lubrication.seized', state.seized ? 1 : 0);
    bus.set('lubrication', 'lubrication.viscosity', visc);
  }

  return {
    id,
    state: controllerState,
    update,
    lube: state,
    setOilLevel,
    changeOil,
  };
}
