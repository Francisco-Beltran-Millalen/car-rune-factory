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
const radiatorFlow: PresentFn = stateNumber('qRadiator');
const bypassFlow: PresentFn = stateNumber('qBypass');
const heaterFlow: PresentFn = stateNumber('qHeater');
const engineTemp: PresentFn = stateNumber('engineTemp');
const radiatorTemp: PresentFn = stateNumber('radiatorTemp');
const heaterTemp: PresentFn = stateNumber('heaterTemp');
const fanOn: PresentFn = (ctx) => (ctx.state['fanOn'] === true ? 1 : 0);

function coolantLink(flow: PresentFn, potential: PresentFn): { flow: PresentFn; potential: PresentFn } {
  return { flow, potential };
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
    thermostat: { open: stateNumber('thermostatOpen') },
    radiator: {
      temp: radiatorTemp,
      dirt: (ctx) => Math.max(number(ctx.faults, 'finsClog'), number(ctx.faults, 'tubesClog')),
    },
    expansionTank: { level: stateNumber('level'), pressure: stateNumber('pSystem') },
    heaterCore: {
      temp: heaterTemp,
      on: (ctx) => (ctx.params['heaterOn'] === true ? 1 : 0),
    },
    tempGauge: { reading: stateNumber('gaugeTemp'), real: engineTemp },
    // Relé, termocontacto, motor y embrague los dibuja el ventilador (plan V1).
    fan: {
      speed: stateNumber('fanAir'),
      dead: (ctx) => (ctx.faults['fanDead'] === true ? 1 : 0),
      relay: fanOn,
      switch: fanOn,
    },
    battery: { v: (ctx) => number(ctx.params, 'batteryV', 13.8) },
  },
  links: {
    // Lazo principal (bomba → culata): pasa todo el caudal.
    'h-pump-node1': coolantLink(coolantFlow, engineTemp),
    'h-node1-jacket': coolantLink(coolantFlow, engineTemp),
    'h-jacket-node2': coolantLink(coolantFlow, engineTemp),
    // Rama del radiador: sólo lo que de verdad pasa por el termostato abierto.
    'h-node2-thermostat': coolantLink(radiatorFlow, engineTemp),
    'h-thermostat-node3': coolantLink(radiatorFlow, engineTemp),
    'h-node3-radiator': coolantLink(radiatorFlow, engineTemp),
    'h-radiator-node4': coolantLink(radiatorFlow, radiatorTemp),
    // Rama del bypass: sólo mientras el termostato está cerrado.
    'h-node2-bypass': coolantLink(bypassFlow, engineTemp),
    'h-bypass-node4': coolantLink(bypassFlow, engineTemp),
    // Rama del calefactor: sólo con la llave de calefacción abierta.
    'h-node2-heater': coolantLink(heaterFlow, engineTemp),
    'h-heater-core': coolantLink(heaterFlow, heaterTemp),
    'h-core-node4': coolantLink(heaterFlow, heaterTemp),
    // Retorno a la bomba: se juntan las tres ramas, vuelve a ser el caudal total.
    'h-node4-pump': coolantLink(coolantFlow, radiatorTemp),
    // El depósito de expansión no tiene caudal continuo, sólo nivela presión.
    'h-tank-node4': { flow: (): number => 0, potential: stateNumber('pSystem') },
    'e-bat-fuse': { flow: stateNumber('fanCurrent') },
    'e-fuse-relay': { flow: stateNumber('fanCurrent') },
    'e-relay-motor': { flow: stateNumber('fanCurrent') },
  },
};
