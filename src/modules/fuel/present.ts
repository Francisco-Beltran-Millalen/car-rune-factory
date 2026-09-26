// Esquema de canales del combustible (A7): qué valor del modelo anima cada
// drawer y cada flujo. Datos puros (§1); los evalúa `src/presenter/`.

import type { PresentContext, PresentFn, PresentScheme } from '../../core/types.ts';

function number(source: Readonly<Record<string, unknown>>, key: string): number {
  const value = source[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function text(source: Readonly<Record<string, unknown>>, key: string, fallback = ''): string {
  const value = source[key];
  return typeof value === 'string' ? value : fallback;
}

function visible(ctx: PresentContext, id: string): boolean {
  return ctx.visibleFaults.has(id);
}

/** Canal gobernado por una falla: si no está visible, vale 0/false/''. */
function gated(id: string, fn: PresentFn): PresentFn {
  return (ctx) => {
    const value = fn(ctx);
    if (visible(ctx, id)) return value;
    return typeof value === 'boolean' ? false : typeof value === 'string' ? '' : 0;
  };
}

/** `state.injectors[n].open` con guard (el estado llega como `unknown`). */
function injectorOpen(ctx: PresentContext, index: number): boolean {
  const list = ctx.state['injectors'];
  if (!Array.isArray(list)) return false;
  const entry: unknown = list[index];
  // Frontera de tipos (§31): la lista viene del modelo como `unknown`.
  return typeof entry === 'object' && entry !== null && (entry as { open?: unknown }).open === true;
}

const stateNumber =
  (key: string): PresentFn =>
  (ctx) =>
    number(ctx.state, key);

const wireLive: PresentFn = (ctx) => (ctx.params['ignitionKey'] !== 'off' ? 1 : 0);
const pumpFlow = stateNumber('qPump');
const pumpAir: PresentFn = (ctx) => number(ctx.state, 'pickupAir');

function injectorChannels(index: number): Readonly<Record<string, PresentFn>> {
  return {
    open: (ctx) => injectorOpen(ctx, index - 1),
    crank: stateNumber('crankAngle'),
    rpm: stateNumber('rpmEff'),
    mixture: stateNumber('mixtureRatio'),
    leak: index === 2 ? gated('injector2.leak', (ctx) => number(ctx.state, 'qLeakInj')) : (): number => 0,
  };
}

/** Canales y flujos del combustible, con sus fallas ya filtradas por visibilidad. */
export const FUEL_PRESENT: PresentScheme = {
  parts: {
    battery: { v: (ctx) => number(ctx.state, 'pumpV') || number(ctx.params, 'batteryV') },
    key: { position: (ctx) => text(ctx.params, 'ignitionKey', 'off') },
    relay: { closed: (ctx) => ctx.state['relayOn'] === true },
    ecu: { rpm: stateNumber('rpmEff') },
    tank: { level: stateNumber('tankLevel') },
    pump: { flow: pumpFlow },
    checkValve: { flow: pumpFlow },
    filter: { dirt: gated('filter.clog', (ctx) => number(ctx.faults, 'filterClog')) },
    rail: {
      pressure: stateNumber('pRail'),
      flow: (ctx) =>
        Math.max(
          0,
          (number(ctx.state, 'qPump') - number(ctx.state, 'qLeakLine') + number(ctx.state, 'qReturn')) / 2,
        ),
    },
    injector1: injectorChannels(1),
    injector2: injectorChannels(2),
    injector3: injectorChannels(3),
    injector4: injectorChannels(4),
    wires: {
      crank: stateNumber('crankAngle'),
      rpm: stateNumber('rpmEff'),
      mixture: stateNumber('mixtureRatio'),
    },
    manifold: { engineState: (ctx) => text(ctx.state, 'engineState', 'off') },
    regulator: { open: stateNumber('regOpen') },
    vacuumHose: {
      off: gated('vacuumHose.off', (ctx) => ctx.faults['vacuumHoseOff'] === true),
    },
    feedLine: { leak: gated('feedLine.leak', stateNumber('qLeakLine')) },
  },
  links: {
    'e-bat-key': { flow: wireLive },
    'e-key-relay': { flow: wireLive },
    'e-relay-pump': {
      flow: (ctx) => (ctx.state['relayOn'] === true ? number(ctx.state, 'pumpCurrent') : 0),
    },
    'h-strainer-pump': { flow: pumpFlow, air: pumpAir },
    'h-pump-line': {
      flow: pumpFlow,
      air: pumpAir,
      potential: stateNumber('pPumpOut'),
    },
    'h-line-filter': {
      flow: (ctx) => Math.max(0, number(ctx.state, 'qPump') - number(ctx.state, 'qLeakLine')),
      air: pumpAir,
      potential: stateNumber('pPumpOut'),
    },
    'h-filter-rail': {
      flow: (ctx) => Math.max(0, number(ctx.state, 'qPump') - number(ctx.state, 'qLeakLine')),
      air: pumpAir,
      potential: stateNumber('pRail'),
    },
    'h-reg-ret': { flow: stateNumber('qReturn') },
  },
};
