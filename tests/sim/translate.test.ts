// A15, plan del vehículo §4 paso 2: `translateCircuit` desplaza el layout y
// prefija ids (`sistema:pieza`, el `.` sigue separando `part.port`, §3.1).
import { describe, expect, it } from 'vitest';
import { translateCircuit } from '../../src/sim/circuit/translate.ts';
import type { CircuitDef } from '../../src/sim/circuit/types.ts';

const DEF: CircuitDef = {
  id: 'toy',
  fluid: 'fuel',
  parts: [
    { id: 'tank', type: 'tank', x: 10, y: 20 },
    { id: 'valve', type: 'restrictor', x: 30, y: 40, joinedBy: 'tank' },
  ],
  links: [
    {
      id: 'h1',
      from: 'tank.out',
      to: 'valve.a',
      via: [[15, 25]],
      visual: { owner: 'tank', pipeClass: 'fluid-fuel' },
    },
  ],
  controllers: [{ id: 'core', type: 'toy' }],
  probes: { level: { node: 'tank.out' }, q: { element: 'valve', probe: 'q' } },
  fixed: { 'tank.ret': 0 },
  initial: { 'valve.a': 3 },
  buses: { '12v': { ports: ['tank.out'], source: 'tank' } },
};

describe('translateCircuit (A15 §4.2)', () => {
  it('desplaza x/y y los `via` en `at`', () => {
    const out = translateCircuit(DEF, [100, 200], 'sys');
    expect(out.parts[0]).toMatchObject({ x: 110, y: 220 });
    expect(out.parts[1]).toMatchObject({ x: 130, y: 240 });
    expect(out.links[0]?.via).toEqual([[115, 225]]);
  });

  it('prefija ids con `:` (nunca `.`, §3.1)', () => {
    const out = translateCircuit(DEF, [0, 0], 'sys');
    expect(out.parts.map((p) => p.id)).toEqual(['sys:tank', 'sys:valve']);
    expect(out.parts[1]?.joinedBy).toBe('sys:tank');
    expect(out.links[0]?.id).toBe('sys:h1');
    expect(out.links[0]?.from).toBe('sys:tank.out');
    expect(out.links[0]?.to).toBe('sys:valve.a');
    expect(out.links[0]?.visual?.owner).toBe('sys:tank');
    expect(out.controllers?.[0]?.id).toBe('sys:core');
  });

  it('prefija las sondas (nombre y `node`/`element`)', () => {
    const out = translateCircuit(DEF, [0, 0], 'sys');
    expect(out.probes?.['sys:level']).toEqual({ node: 'sys:tank.out' });
    expect(out.probes?.['sys:q']).toEqual({ element: 'sys:valve', probe: 'q' });
  });

  it('prefija `fixed`, `initial` y `buses` (`ports` y `source`)', () => {
    const out = translateCircuit(DEF, [0, 0], 'sys');
    expect(out.fixed).toEqual({ 'sys:tank.ret': 0 });
    expect(out.initial).toEqual({ 'sys:valve.a': 3 });
    expect(out.buses).toEqual({ '12v': { ports: ['sys:tank.out'], source: 'sys:tank' } });
  });

  it('no toca `params`/`faults` (los arma `compileVehicle`)', () => {
    const withParams: CircuitDef = { ...DEF, params: { level: 40 }, faults: { clog: 0 } };
    const out = translateCircuit(withParams, [0, 0], 'sys');
    expect(out.params).toEqual({ level: 40 });
    expect(out.faults).toEqual({ clog: 0 });
  });
});
