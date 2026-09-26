// Esquema de canales de la refrigeración (A13, spec §8). Datos puros (§1).

import type { PresentFn, PresentScheme } from '../../core/types.ts';

function number(source: Readonly<Record<string, unknown>>, key: string, fallback = 0): number {
  const value = source[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

const stateNumber =
  (key: string): PresentFn =>
  (ctx) =>
    number(ctx.state, key);

const coolantFlow: PresentFn = stateNumber('qPump');
const engineTemp: PresentFn = stateNumber('engineTemp');
const radiatorTemp: PresentFn = stateNumber('radiatorTemp');
const heaterTemp: PresentFn = stateNumber('heaterTemp');

function coolantLink(potential: PresentFn): { flow: PresentFn; potential: PresentFn } {
  return { flow: coolantFlow, potential };
}

export const COOLING_PRESENT: PresentScheme = {
  parts: {
    engineBlock: {
      temp: engineTemp,
      boiling: (ctx) => (ctx.state['boiling'] === true ? 1 : 0),
    },
    waterPump: {
      flow: coolantFlow,
      leak: (ctx) => number(ctx.state, 'level') < 6.99 ? 1 : 0,
    },
    pumpBelt: { flow: coolantFlow },
    thermostat: { open: stateNumber('thermostatOpen') },
    radiator: {
      temp: radiatorTemp,
      dirt: (ctx) => Math.max(number(ctx.faults, 'finsClog'), number(ctx.faults, 'tubesClog')),
    },
    radiatorCap: { failed: (ctx) => (ctx.faults['capFailed'] === true ? 1 : 0) },
    expansionTank: { level: stateNumber('level'), pressure: stateNumber('pSystem') },
    heaterCore: {
      temp: heaterTemp,
      on: (ctx) => (ctx.params['heaterOn'] === true ? 1 : 0),
    },
    tempGauge: { reading: stateNumber('gaugeTemp'), real: engineTemp },
    tempSensor: { reading: stateNumber('gaugeTemp') },
    fan: {
      speed: stateNumber('fanAir'),
      dead: (ctx) => (ctx.faults['fanDead'] === true ? 1 : 0),
    },
    fanClutch: { speed: stateNumber('fanAir') },
    fanMotor: { current: stateNumber('fanCurrent') },
    fanSwitch: { closed: stateNumber('fanOn') },
    fanRelay: { closed: stateNumber('fanOn') },
    battery: { v: (ctx) => number(ctx.params, 'batteryV', 13.8) },
    fuse: { ok: (): number => 1 },
  },
  links: {
    'h-pump-node1': coolantLink(engineTemp),
    'h-node1-jacket': coolantLink(engineTemp),
    'h-jacket-node2': coolantLink(engineTemp),
    'h-node2-thermostat': coolantLink(engineTemp),
    'h-node2-bypass': coolantLink(engineTemp),
    'h-node2-heater': coolantLink(engineTemp),
    'h-thermostat-node3': coolantLink(engineTemp),
    'h-node3-radiator': coolantLink(engineTemp),
    'h-radiator-node4': coolantLink(radiatorTemp),
    'h-node4-pump': coolantLink(radiatorTemp),
    'h-bypass-node4': coolantLink(engineTemp),
    'h-core-node4': coolantLink(heaterTemp),
    'h-heater-core': coolantLink(heaterTemp),
    'h-tank-node4': coolantLink(radiatorTemp),
    'e-bat-fuse': { flow: stateNumber('fanCurrent') },
    'e-fuse-relay': { flow: stateNumber('fanCurrent') },
    'e-relay-motor': { flow: stateNumber('fanCurrent') },
  },
};
