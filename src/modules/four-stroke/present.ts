// Esquema de canales del ciclo de 4 tiempos (A11; spec §8). Datos puros (§1).

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

/** Canal gobernado por una falla: si no está visible, vale 0. */
function gated(id: string, fn: PresentFn): PresentFn {
  return (ctx) => (ctx.visibleFaults.has(id) ? fn(ctx) : 0);
}

const stateNumber =
  (key: string): PresentFn =>
  (ctx) =>
    number(ctx.state, key);

export const FOUR_STROKE_PRESENT: PresentScheme = {
  parts: {
    cylinder: {
      crank: stateNumber('crankAngle'),
      stroke: (ctx) => text(ctx.state, 'stroke', 'admisión'),
      pressure: stateNumber('pressure'),
      volume: stateNumber('volume'),
      intakeLift: stateNumber('intakeLift'),
      exhaustLift: stateNumber('exhaustLift'),
      burn: stateNumber('burnFraction'),
      spark: (ctx) => (ctx.params['spark'] === true ? 1 : 0),
      hit: stateNumber('valveHit'),
      view: (ctx) => number(ctx.params, 'viewCylinder', 1),
      overlap: (ctx) => (ctx.params['showOverlap'] === true ? 1 : 0),
    },
    timing: {
      crank: stateNumber('crankAngle'),
      cam: stateNumber('camAngle'),
      offset: stateNumber('camOffset'),
      slack: stateNumber('slack'),
      play: gated('crankKey.keywayWorn', stateNumber('keywayPlay')),
      damage: gated('crankBolt.loose', stateNumber('keywayDamage')),
      knock: stateNumber('knock'),
      rattle: stateNumber('rattle'),
      teeth: stateNumber('teethJumped'),
      guideBroken: (ctx) => (ctx.faults['guideBroken'] === true ? 1 : 0),
      drive: (ctx) => text(ctx.params, 'drive', 'chain'),
      sheared: (ctx) =>
        ctx.state['keyShearedState'] === true || ctx.faults['keySheared'] === true ? 1 : 0,
    },
    pv: {
      pressure: stateNumber('pressure'),
      volume: stateNumber('volume'),
      cycle: stateNumber('cycleCount'),
    },
    compression: {
      c1: (ctx) => arrayNumber(ctx.state, 'compression', 0),
      c2: (ctx) => arrayNumber(ctx.state, 'compression', 1),
      c3: (ctx) => arrayNumber(ctx.state, 'compression', 2),
      c4: (ctx) => arrayNumber(ctx.state, 'compression', 3),
      testing: (ctx) => (ctx.state['testing'] === true ? 1 : 0),
    },
  },
};
