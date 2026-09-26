// A7: presenter genérico (canales, flujos e indicios) y esquema del
// combustible sobre un estado conocido.
import { describe, expect, it } from 'vitest';
import type { FaultCatalogEntry, PresentScheme } from '../../src/core/types.ts';
import { createCompiledFuelModel } from '../../src/modules/fuel/circuit.ts';
import { FUEL_FAULTS } from '../../src/modules/fuel/faults.ts';
import { FUEL_PRESENT } from '../../src/modules/fuel/present.ts';
import { presentCircuit, presentModel, visibleFaultSet } from '../../src/presenter/present.ts';

const DT = 0.001;
function startEngine(m: ReturnType<typeof createCompiledFuelModel>): void {
  const run = (s: number): void => {
    for (let i = 0; i < Math.round(s / DT); i++) m.step(DT);
  };
  m.params.ignitionKey = 'on';
  run(2.5);
  m.params.ignitionKey = 'start';
  run(1.5);
  m.params.ignitionKey = 'run';
  run(2);
}

const CATALOG: readonly FaultCatalogEntry[] = [
  { id: 'x.always', modelKey: 'a', part: 'p', kind: 'severity', healthy: 0, visibility: 'always' },
  { id: 'x.inspect', modelKey: 'b', part: 'p', kind: 'severity', healthy: 0, visibility: 'inspect' },
  { id: 'x.never', modelKey: 'c', part: 'p', kind: 'severity', healthy: 0, visibility: 'never' },
];

describe('presenter genérico (A7)', () => {
  it('evalúa canales, flujos y globales desde el estado', () => {
    const scheme: PresentScheme = {
      parts: {
        pump: {
          flow: (c) => Number(c.state['q']),
          broken: (c) => c.visibleFaults.has('x.always'),
        },
      },
      links: { l1: { flow: (c) => Number(c.state['q']), air: (c) => Number(c.state['air']) } },
      global: { speed: (c) => Number(c.params['rpm']) },
    };
    const visual = presentCircuit({
      scheme,
      catalog: CATALOG,
      state: { q: 12.5, air: 0.5 },
      params: { rpm: 800 },
      faults: { a: 1 },
      revealedFaults: [],
    });
    expect(visual.parts['pump']).toEqual({ flow: 12.5, broken: true });
    expect(visual.links['l1']).toEqual({ flow: 12.5, potential: 0, air: 0.5 });
    expect(visual.global['speed']).toBe(800);
    expect(visual.faultCues).toEqual(['x.always']);
  });

  it('un canal sin fuente o con NaN vale 0 y no rompe el VisualState', () => {
    const scheme: PresentScheme = { parts: { p: { a: () => Number.NaN, b: () => 3 } } };
    const visual = presentCircuit({
      scheme,
      state: {},
      params: {},
      faults: {},
      revealedFaults: [],
    });
    expect(visual.parts['p']).toEqual({ a: 0, b: 3 });
  });

  it('visibleFaultSet filtra por actividad y visibilidad', () => {
    expect(
      visibleFaultSet(CATALOG, { a: 1, b: 0, c: 0 }, []),
    ).toEqual(new Set(['x.always']));
    expect(
      visibleFaultSet(CATALOG, { a: 1, b: 1, c: 0 }, ['x.inspect']),
    ).toEqual(new Set(['x.always', 'x.inspect']));
    // 'never' se ve sólo si una herramienta la revela (A3).
    expect(visibleFaultSet(CATALOG, { a: 0, b: 0, c: 1 }, ['x.never'])).toEqual(new Set(['x.never']));
    // Una falla sana no es indicio aunque esté revelada.
    expect(visibleFaultSet(CATALOG, { a: 0, b: 0, c: 0 }, ['x.always', 'x.never'])).toEqual(new Set());
    // Transición de A3: también se acepta la clave plana del modelo.
    expect(visibleFaultSet(CATALOG, { a: 0, b: 1, c: 0 }, ['b'])).toEqual(new Set(['x.inspect']));
  });
});

describe('presenter del combustible sobre un estado conocido', () => {
  it('publica los canales y flujos del compilado', () => {
    const m = createCompiledFuelModel();
    startEngine(m);
    const visual = presentModel({ scheme: FUEL_PRESENT, catalog: FUEL_FAULTS, model: m, revealedFaults: [] });
    expect(visual.parts['pump']?.['flow']).toBe(m.state.qPump);
    expect(visual.parts['tank']?.['level']).toBe(m.state.tankLevel);
    expect(visual.parts['rail']?.['pressure']).toBe(m.state.pRail);
    expect(visual.parts['injector1']?.['open']).toBe(m.state.injectors[0]?.open);
    expect(visual.links['h-reg-ret']?.flow).toBe(m.state.qReturn);
    expect(visual.links['h-pump-line']?.potential).toBe(m.state.pPumpOut);
  });

  it('la suciedad y el goteo quedan tapados sin revelar la falla', () => {
    const m = createCompiledFuelModel({ faults: { filterClog: 1, injectorLeak: 1, lineLeak: 1 } });
    startEngine(m);
    const hidden = presentModel({ scheme: FUEL_PRESENT, catalog: FUEL_FAULTS, model: m, revealedFaults: [] });
    expect(hidden.parts['filter']?.['dirt']).toBe(0);
    expect(hidden.parts['injector2']?.['leak']).toBe(0);
    // La fuga de la línea es 'always': su indicio se ve (y ventea de verdad).
    expect(hidden.parts['feedLine']?.['leak']).toBe(m.state.qLeakLine);
    expect(hidden.faultCues).toEqual(['feedLine.leak']);

    const revealed = presentModel({
      scheme: FUEL_PRESENT,
      catalog: FUEL_FAULTS,
      model: m,
      revealedFaults: ['filter.clog', 'injector2.leak'],
    });
    expect(revealed.parts['filter']?.['dirt']).toBe(1);
    expect(revealed.parts['injector2']?.['leak']).toBe(m.state.qLeakInj);
    expect(revealed.faultCues).toEqual(
      expect.arrayContaining(['filter.clog', 'injector2.leak', 'feedLine.leak']),
    );
  });
});
