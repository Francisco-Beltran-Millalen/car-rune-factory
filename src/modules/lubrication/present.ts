// Esquema de canales de la lubricación (A14, spec §8). Datos puros (§1).

import type { PresentFn, PresentScheme } from '../../core/types.ts';
import { K } from './constants.ts';

function number(source: Readonly<Record<string, unknown>>, key: string, fallback = 0): number {
  const value = source[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

const stateNumber =
  (key: string): PresentFn =>
  (ctx) =>
    number(ctx.state, key);

const pressure: PresentFn = stateNumber('pGallery');
const flow: PresentFn = stateNumber('qPump');
const filtered: PresentFn = stateNumber('qFilter');
const wearEf: PresentFn = (ctx) =>
  Math.max(number(ctx.faults, 'bearingWear'), number(ctx.state, 'bearingDamage'));
/** El interruptor cierra bajo 0,5 bar (o miente con la falla), con o sin llave. */
const switchClosed: PresentFn = (ctx) => {
  const stuck = ctx.faults['switchStuck'];
  if (stuck === 'alwaysOn') return 1;
  if (stuck === 'neverOn') return 0;
  return number(ctx.state, 'pGallery') < K.switchBar ? 1 : 0;
};

export const LUBRICATION_PRESENT: PresentScheme = {
  parts: {
    // El chupador y el tapón los dibuja el drawer del cárter: sus canales van acá.
    sump: {
      level: stateNumber('level'),
      tilt: (ctx) => number(ctx.params, 'lateralG'),
      air: stateNumber('pumpAir'),
      pickupDirt: (ctx) => number(ctx.faults, 'pickupClog'),
      drip: (ctx) => number(ctx.faults, 'panDrip'),
    },
    oilPump: {
      flow,
      rpm: (ctx) =>
        ctx.state['seized'] !== true && ctx.params['ignitionKey'] === 'run' ? number(ctx.params, 'rpm') : 0,
      air: stateNumber('pumpAir'),
      wear: (ctx) => number(ctx.faults, 'pumpWear'),
    },
    reliefValve: { open: stateNumber('qRelief'), pressure: stateNumber('pPumpOut') },
    oilFilter: {
      dirt: (ctx) => number(ctx.faults, 'filterClog'),
      dp: stateNumber('dpFilter'),
      bypass: (ctx) => (ctx.state['bypassOpen'] === true ? 1 : 0),
      leak: (ctx) => number(ctx.faults, 'filterGasketLeak'),
      antiDrainbackFailed: (ctx) => (ctx.faults['antiDrainbackFailed'] === true ? 1 : 0),
    },
    mainGallery: { pressure, flow: stateNumber('qBearings') },
    mainBearings: { wear: wearEf, knock: stateNumber('knock') },
    rodBearings: { wear: wearEf, knock: stateNumber('knock') },
    camBearings: { wear: wearEf, knock: stateNumber('knock') },
    warningLamp: {
      on: (ctx) => (ctx.state['lampOn'] === true ? 1 : 0),
      current: stateNumber('lampI'),
      closed: switchClosed,
    },
    battery: { v: (ctx) => (ctx.params['ignitionKey'] === 'run' ? K.vBusRun : K.vBusOff) },
    key: { position: (ctx) => (typeof ctx.params['ignitionKey'] === 'string' ? ctx.params['ignitionKey'] : 'off') },
    oilGauge: { pressure: stateNumber('gauge'), real: pressure },
  },
  links: {
    'h-pickup-pump': { flow },
    'h-pump-node': { flow, potential: stateNumber('pPumpOut') },
    'h-node-relief': { flow: stateNumber('qRelief'), potential: stateNumber('pPumpOut') },
    'h-node-filter': { flow: filtered, potential: stateNumber('pPumpOut') },
    'h-filter-gallery': { flow: filtered, potential: pressure },
    'h-gallery-volume': { flow: stateNumber('qBearings'), potential: pressure },
    'h-gallery-main': { flow: stateNumber('qMain'), potential: pressure },
    'h-gallery-rod': { flow: stateNumber('qRod'), potential: pressure },
    'h-gallery-cam': { flow: stateNumber('qCam'), potential: pressure },
    'h-return-relief': { flow: stateNumber('qRelief') },
    'h-return-main': { flow: stateNumber('qMain') },
    'h-return-rod': { flow: stateNumber('qRod') },
    'h-return-cam': { flow: stateNumber('qCam') },
  },
};
