// Esquema de canales del encendido (A12, spec §8). Datos puros (§1).

import type { PresentFn, PresentScheme } from '../../core/types.ts';

function number(source: Readonly<Record<string, unknown>>, key: string, fallback = 0): number {
  const value = source[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function text(source: Readonly<Record<string, unknown>>, key: string, fallback = ''): string {
  const value = source[key];
  return typeof value === 'string' ? value : fallback;
}

function arrayNumber(
  source: Readonly<Record<string, unknown>>,
  key: string,
  index: number,
): number {
  const list = source[key];
  if (!Array.isArray(list)) return 0;
  const value: unknown = list[index];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

const stateNumber =
  (key: string): PresentFn =>
  (ctx) =>
    number(ctx.state, key);

/** Derivación de la bujía engrasada (sólo la 2). */
const fouled2: PresentFn = (ctx) => number(ctx.faults, 'plugFouled2');
const gap: PresentFn = (ctx) => 0.7 + 0.9 * number(ctx.faults, 'plugGapWear');

function plugChannels(index: number): Readonly<Record<string, PresentFn>> {
  return {
    spark: (ctx) => arrayNumber(ctx.state, 'sparks', index - 1),
    flash: (ctx) => arrayNumber(ctx.state, 'pulses', index - 1),
    gap,
    fouled: index === 2 ? fouled2 : (): number => 0,
  };
}

function copCoil(index: number): Readonly<Record<string, PresentFn>> {
  return {
    current: stateNumber('busCurrent'),
    energy: stateNumber('energy'),
    dead: index === 2 ? (ctx) => (ctx.faults['coil2Dead'] === true ? 1 : 0) : (): number => 0,
  };
}

export const IGNITION_PRESENT: PresentScheme = {
  parts: {
    battery: { v: (ctx) => number(ctx.params, 'batteryV', 12.6) },
    key: { position: (ctx) => text(ctx.params, 'ignitionKey', 'off') },
    ballast: { open: (ctx) => (ctx.faults['ballastOpen'] === true ? 1 : 0) },
    coil: {
      current: stateNumber('busCurrent'),
      energy: stateNumber('energy'),
      dead: (ctx) => (ctx.faults['igniterDead'] === true ? 1 : 0),
    },
    coil1: copCoil(1),
    coil2: copCoil(2),
    coil3: copCoil(3),
    coil4: copCoil(4),
    distributor: {
      cam: stateNumber('camAngle'),
      weights: (ctx) => number(ctx.params, 'rpm'),
      vacuum: (ctx) => number(ctx.params, 'throttle'),
      advance: stateNumber('advance'),
      target: stateNumber('lastCylinder'),
      pointsOpen: (ctx) => (ctx.state['pointsOpen'] === true ? 1 : 0),
      pitting: stateNumber('pitting'),
      capCracked: (ctx) => number(ctx.faults, 'capCracked'),
    },
    sparkPlug1: plugChannels(1),
    sparkPlug2: plugChannels(2),
    sparkPlug3: plugChannels(3),
    sparkPlug4: plugChannels(4),
    scope: {
      i: stateNumber('iBreak'),
      v: stateNumber('vAvail'),
      req: stateNumber('vReq'),
      arc: stateNumber('arcMs'),
      cyl: stateNumber('lastCylinder'),
      ok: (ctx) => (ctx.state['sparkOk'] === true ? 1 : 0),
    },
    toothWheel: {
      angle: stateNumber('crankAngle'),
      sync: (ctx) => (ctx.state['sync'] === true ? 1 : 0),
      gap: (ctx) => number(ctx.faults, 'crankSensorGap'),
    },
    ecu: {
      rpm: (ctx) => number(ctx.params, 'rpm'),
      codes: (ctx) => {
        const codes = ctx.state['codes'];
        return Array.isArray(codes) ? codes.filter((c): c is string => typeof c === 'string').join(' ') : '';
      },
    },
  },
};
