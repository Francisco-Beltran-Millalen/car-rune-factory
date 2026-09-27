// Esquema de canales del carburador (spec §8). Datos puros (§1).

import type { PresentFn, PresentScheme } from '../../core/types.ts';

function number(source: Readonly<Record<string, unknown>>, key: string, fallback = 0): number {
  const value = source[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

const stateNumber =
  (key: string): PresentFn =>
  (ctx) =>
    number(ctx.state, key);

export const CARBURETOR_PRESENT: PresentScheme = {
  parts: {
    tank: { level: stateNumber('tankLevel') },
    fuelLine: {},
    mechPump: {
      rpm: (ctx) => number(ctx.params, 'rpm') / 2,
      wear: (ctx) => number(ctx.faults, 'pumpWear'),
      leak: (ctx) => (ctx.faults['pumpDiaphragm'] === true ? 1 : 0),
    },
    fuelFilter: { dirt: (ctx) => number(ctx.faults, 'filterClog') },
    floatBowl: {
      level: stateNumber('bowlLevel'),
      needleOpen: stateNumber('needleOpen'),
      flooding: (ctx) => (ctx.state['flooding'] === true ? 1 : 0),
    },
    carbBody: {
      airMass: stateNumber('airMass'),
      throttle: (ctx) => number(ctx.params, 'throttle'),
      mainFraction: stateNumber('mainFraction'),
      fuelDelivered: stateNumber('fuelDelivered'),
      accelBoost: stateNumber('accelBoost'),
    },
    choke: { chokeEff: stateNumber('chokeEff') },
  },
  links: {
    'h-tank-line': { flow: stateNumber('qPump'), potential: stateNumber('pPump') },
    'h-line-pump': { flow: stateNumber('qPump'), potential: stateNumber('pPump') },
    'h-pump-node': { flow: stateNumber('qPump'), potential: stateNumber('pPump') },
    'h-node-filter': { flow: stateNumber('qFilter'), potential: stateNumber('pPump') },
    'h-filter-needle': { flow: stateNumber('qFilter'), potential: stateNumber('pPump') },
  },
};
