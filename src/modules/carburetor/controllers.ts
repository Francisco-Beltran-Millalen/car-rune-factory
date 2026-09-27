// Controlador del carburador (A16, spec carburetor §5): venturi, transitorio,
// red de bencina y la señal `fuel.mixture`. Puro (§1); corre antes del
// solver (§25) y lee las sondas del paso anterior.

import { clamp } from '../../core/math.ts';
import type { ParamValue } from '../../core/types.ts';
import type { ControllerContext, ControllerDef, ControllerStateValue } from '../../sim/controllers/base.ts';
import type { LabBus } from '../../sim/signals/bus.ts';
import { K } from './constants.ts';
import { INITIAL_TRANSIENT, mixtureOf, stepTransient, type TransientState } from './transient.ts';
import { bowlHeight, mainFraction, mixtureRatio, vaporization, venturiDp } from './venturi.ts';

export type ChokeStuck = 'ok' | 'closed' | 'open';

export type CarburetorParams = {
  rpm: number;
  throttle: number;
  engineTempC: number;
  choke: number;
  idleScrew: number;
};

export type CarburetorFaults = {
  idleJetClog: number;
  mainJetClog: number;
  floatPunctured: boolean;
  needleStuck: boolean;
  chokeStuck: ChokeStuck;
  accelPumpFailed: boolean;
  pumpWear: number;
  pumpDiaphragm: boolean;
  filterClog: number;
};

export type CarburetorState = {
  airMass: number;
  venturiDp: number;
  mainFraction: number;
  mixtureTarget: number;
  mixture: number;
  fuelDelivered: number;
  accelBoost: number;
  bowlLevel: number;
  needleOpen: number;
  qPump: number;
  pPump: number;
  qFilter: number;
  tankLevel: number;
  flooding: boolean;
  vaporization: number;
  chokeEff: number;
};

export const DEFAULT_PARAMS: Readonly<CarburetorParams> = {
  rpm: 800,
  throttle: 0,
  engineTempC: 90,
  choke: 0,
  idleScrew: 1,
};

export const DEFAULT_FAULTS: Readonly<CarburetorFaults> = {
  idleJetClog: 0,
  mainJetClog: 0,
  floatPunctured: false,
  needleStuck: false,
  chokeStuck: 'ok',
  accelPumpFailed: false,
  pumpWear: 0,
  pumpDiaphragm: false,
  filterClog: 0,
};

export function createInitialCarburetorState(): CarburetorState {
  return {
    airMass: 0,
    venturiDp: 0,
    mainFraction: 0,
    mixtureTarget: 0,
    mixture: 0,
    fuelDelivered: 0,
    accelBoost: 0,
    bowlLevel: K.bowlNominal,
    needleOpen: 0,
    qPump: 0,
    pPump: 0,
    qFilter: 0,
    tankLevel: K.tankDefault,
    flooding: false,
    vaporization: 1,
    chokeEff: 0,
  };
}

export interface CarburetorController extends ControllerDef {
  readonly carb: CarburetorState;
}

export interface CarburetorOptions {
  bus: LabBus;
}

function num(value: ParamValue | undefined, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function flag(value: ParamValue | undefined): boolean {
  return value === true;
}

function chokeStuckOf(value: ParamValue | undefined): ChokeStuck {
  return value === 'closed' || value === 'open' ? value : 'ok';
}

export function createCarburetor(
  id: string,
  _params: Readonly<Record<string, ParamValue>>,
  options: CarburetorOptions,
): CarburetorController {
  const bus = options.bus;
  const state = createInitialCarburetorState();
  const controllerState: Record<string, ControllerStateValue> = state;
  let transient: TransientState = INITIAL_TRANSIENT;
  let prevThrottle = 0;
  let first = true;

  function update(ctx: ControllerContext): void {
    const dt = ctx.dt;
    const params = ctx.params;
    const faults = ctx.faults;

    const rpm = clamp(num(params['rpm']), 0, K.maxRpm);
    const throttle = clamp(num(params['throttle']), 0, 1);
    const engineTempC = clamp(num(params['engineTempC']), -10, 110);
    const chokeParam = clamp(num(params['choke']), 0, 1);
    const idleScrew = clamp(num(params['idleScrew']), 0.5, 1.5);
    const chokeStuck = chokeStuckOf(faults['chokeStuck']);
    const chokeEff = chokeStuck === 'closed' ? 1 : chokeStuck === 'open' ? 0 : chokeParam;

    if (first) {
      prevThrottle = throttle;
      first = false;
    }

    // Aire y venturi (§5.1, §5.2): el nivel de la cuba es del paso anterior (§25).
    const airMass = bus.get('air.massFlow');
    const bowlLevel = clamp(ctx.read('bowlLevel'), 0, K.bowlCapacity);
    const dpv = venturiDp(airMass);
    const h = bowlHeight(bowlLevel);
    const phi = mainFraction(dpv, h);
    const mainJetClog = clamp(num(faults['mainJetClog']), 0, 1);
    const idleJetClog = clamp(num(faults['idleJetClog']), 0, 1);
    const r = mixtureRatio({
      phi,
      mainJetClog,
      idleJetClog,
      idleScrew,
      bowlLevel,
      chokeEf: chokeEff,
      tempC: engineTempC,
    });

    // Transitorio y bomba de aceleración (§5.3).
    const dThrottle = (throttle - prevThrottle) / dt;
    const accelPumpFailed = flag(faults['accelPumpFailed']);
    transient = stepTransient(transient, dt, { r, airMassFlow: airMass, dThrottle, accelPumpFailed });
    prevThrottle = throttle;

    // Disponible (§5.4): con la cuba casi vacía los surtidores no entregan
    // lo pedido y la mezcla cae sola; la proporción publicada usa lo
    // realmente entregado.
    const disponible = clamp(bowlLevel / K.bowlDisponibleRef, 0, 1);
    const delivered = transient.qReal * disponible; // kg/h de verdad entregados
    const mixture = mixtureOf(delivered, airMass, transient.accelBoost);
    const fuelDeliveredLh = (transient.qReal / K.fuelDensity) * disponible;

    const jets = ctx.elements['jets'];
    if (jets) jets.control['q'] = fuelDeliveredLh;

    // Aguja (§5.4): cierra con la cuba llena; la falla del flotador la deja
    // siempre abierta y la aguja pegada la deja siempre cerrada.
    // Nota de robustez (§6, anotada en la spec §14): `variableOrifice` con
    // `gOpen` tan alto (164) vuelve rígida la ecuación para una apertura
    // apenas mayor que 0 (bomba de desplazamiento + orificio casi cerrado en
    // serie no converge en 25 iteraciones bajo ~7 % de apertura, se probó
    // aislado; documentado en docs/core-requests.md). Con la cuba en su
    // nivel regulado la apertura real cae justo en esa franja, así que se
    // redondea a 0 (rama limpia del elemento) cuando quedaría por debajo del
    // piso seguro: el nivel oscila unas décimas de mL de más, invisible en
    // los rangos de la spec.
    const rawNeedleOpen = clamp((K.needleRef - bowlLevel) / K.needleSpan, 0, 1);
    const needleOpen = flag(faults['floatPunctured'])
      ? 1
      : flag(faults['needleStuck'])
        ? 0
        : rawNeedleOpen < K.needleSafeFloor
          ? 0
          : rawNeedleOpen;
    const needleValve = ctx.elements['needleValve'];
    if (needleValve) needleValve.control['open'] = needleOpen;

    // Bomba mecánica (§5.4): el diafragma roto reduce el caudal a la mitad
    // (se escala `n`, no `wear`, para no mezclarse con la falla de desgaste)
    // y abre una fuga a la atmósfera aparte.
    const pumpWear = clamp(num(faults['pumpWear']), 0, 1);
    const pumpDiaphragm = flag(faults['pumpDiaphragm']);
    const mechPump = ctx.elements['mechPump'];
    if (mechPump) {
      mechPump.control['n'] = (rpm / 2) * (pumpDiaphragm ? 0.5 : 1);
      mechPump.control['wear'] = pumpWear;
    }
    const pumpLeak = ctx.elements['pumpLeak'];
    if (pumpLeak) pumpLeak.control['severity'] = pumpDiaphragm ? 1 : 0;

    const filter = ctx.elements['fuelFilter'];
    if (filter) filter.control['clog'] = clamp(num(faults['filterClog']), 0, 1);

    // Estado publicado.
    state.airMass = airMass;
    state.venturiDp = dpv;
    state.mainFraction = phi;
    state.mixtureTarget = r;
    state.mixture = mixture;
    state.fuelDelivered = fuelDeliveredLh;
    state.accelBoost = transient.accelBoost;
    state.bowlLevel = bowlLevel;
    state.needleOpen = needleOpen;
    state.qPump = ctx.read('qPump');
    state.pPump = ctx.read('pPump');
    state.qFilter = ctx.read('qFilter');
    state.tankLevel = clamp(ctx.read('tankLevel'), 0, K.tankCapacity);
    state.flooding = bowlLevel >= K.bowlFloodLevel;
    state.vaporization = vaporization(engineTempC);
    state.chokeEff = chokeEff;

    bus.set('carburetor', 'fuel.mixture', mixture);
  }

  return {
    id,
    state: controllerState,
    update,
    carb: state,
  };
}
