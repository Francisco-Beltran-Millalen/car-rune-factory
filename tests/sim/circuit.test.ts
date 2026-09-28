// A5: `validate` por tipo de problema, juguetes que compilan con valor
// analítico, bindings params/faults, controladores (retraso de un paso),
// nodos `joint` y reset. Referencias: P23 §8.4 y solver.md §7.
import { describe, expect, it } from 'vitest';
import { compileCircuit } from '../../src/sim/circuit/compile.ts';
import type { CircuitDef, CircuitIssue, CircuitState, CompiledCircuit } from '../../src/sim/circuit/types.ts';
import { validateCircuit } from '../../src/sim/circuit/validate.ts';
import type { ControllerFactory } from '../../src/sim/controllers/index.ts';
import { ELEMENT_TYPES } from '../../src/sim/elements/index.ts';

const DT = 0.001;

const TOY_ELECTRIC: CircuitDef = {
  id: 'toy-electric',
  parts: [
    { id: 'bat', type: 'battery', x: 0, y: 0, params: { r: 0.02 } },
    { id: 'sw', type: 'switch', x: 0, y: 0, params: { rOn: 0.01, rOff: 1e7 } },
    { id: 'load', type: 'resistor', x: 0, y: 0, params: { r: 10 } },
  ],
  links: [
    { id: 'l1', from: 'bat.+', to: 'sw.a' },
    { id: 'l2', from: 'sw.b', to: 'load.a' },
    { id: 'l3', from: 'load.b', to: 'bat.-' },
  ],
  probes: {
    i: { element: 'load', probe: 'q' },
    vPlus: { node: 'bat.+' },
  },
  params: { batteryV: 12.6, ignition: true },
  fixed: { 'bat.-': 0 },
};

const TOY_ELECTRIC_BINDINGS = [
  { source: 'params' as const, key: 'batteryV', part: 'bat', input: 'v' },
  { source: 'params' as const, key: 'ignition', part: 'sw', input: 'closed' },
];

const TOY_PUMP: CircuitDef = {
  id: 'toy-pump',
  fluid: 'fuel',
  parts: [
    { id: 'bat', type: 'battery', x: 0, y: 0, params: { r: 0.02 } },
    { id: 'pump', type: 'electricPump', x: 0, y: 0 },
    { id: 'valve', type: 'restrictor', x: 0, y: 0, params: { k: 1e-3, clogFactor: 1000 } },
    { id: 'tank', type: 'tank', x: 0, y: 0, params: { capacity: 50, pickupLow: 1 } },
  ],
  links: [
    { id: 'e1', from: 'bat.+', to: 'pump.e+' },
    { id: 'e2', from: 'pump.e-', to: 'bat.-' },
    { id: 'h1', from: 'tank.out', to: 'pump.in' },
    { id: 'h2', from: 'pump.out', to: 'valve.a' },
    { id: 'h3', from: 'valve.b', to: 'tank.ret' },
  ],
  probes: {
    q: { element: 'pump', probe: 'q' },
    i: { element: 'pump', probe: 'i' },
    pOut: { node: 'pump.out' },
    level: { element: 'tank', probe: 'level' },
  },
  params: { batteryV: 13.5 },
  faults: { filterClog: 0 },
  fixed: { 'bat.-': 0 },
};

const TOY_PUMP_BINDINGS = [
  { source: 'params' as const, key: 'batteryV', part: 'bat', input: 'v' },
  { source: 'faults' as const, key: 'filterClog', part: 'valve', input: 'clog' },
];

function compileElectric(): CompiledCircuit {
  const state: CircuitState = {};
  return compileCircuit({
    def: TOY_ELECTRIC,
    types: ELEMENT_TYPES,
    bindings: TOY_ELECTRIC_BINDINGS,
    state,
  });
}

function compilePump(init: Readonly<Record<string, unknown>> = {}): CompiledCircuit {
  const state: CircuitState = {};
  return compileCircuit({
    def: TOY_PUMP,
    types: ELEMENT_TYPES,
    bindings: TOY_PUMP_BINDINGS,
    state,
    init,
  });
}

function run(circuit: CompiledCircuit, seconds: number): void {
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps; i++) circuit.model.step(DT);
}

function issueCodes(issues: readonly CircuitIssue[]): string[] {
  return issues.map((issue) => issue.code);
}

describe('circuit — juguetes analíticos (§8.4)', () => {
  it('batería-switch-resistencia da el valor analítico', () => {
    const circuit = compileElectric();
    expect(circuit.issues).toHaveLength(0);
    run(circuit, 0.05);

    const i = 12.6 / (0.02 + 0.01 + 10);
    expect(circuit.model.state['i']).toBeCloseTo(i, 6);
    expect(circuit.model.state['vPlus']).toBeCloseTo(12.6 - 0.02 * i, 6);
    expect(circuit.solver.potential(circuit.portToNode['load.a'] ?? -1)).toBeCloseTo(
      12.6 - 0.02 * i - 0.01 * i,
      6,
    );
    // En una serie la reacción de cada nodo es 0 (KCL): entra y sale lo mismo.
    expect(circuit.solver.reaction(circuit.portToNode['bat.-'] ?? -1)).toBeCloseTo(0, 9);
  });

  it('los params llegan al circuito por bindings y el switch abre', () => {
    const circuit = compileElectric();
    circuit.model.params['batteryV'] = 6.3;
    run(circuit, 0.05);
    expect(circuit.model.state['i']).toBeCloseTo(6.3 / 10.03, 6);

    circuit.model.params['ignition'] = false;
    run(circuit, 0.05);
    expect(circuit.model.state['i'] as number).toBeLessThan(1e-5);
  });

  it('bomba-restrictor-tanque contra el punto fijo analítico', () => {
    const circuit = compilePump();
    expect(circuit.issues).toHaveLength(0);
    run(circuit, 0.5);

    const root = pumpLoopRoot(0);
    expect(circuit.model.state['q']).toBeCloseTo(root.q, 1);
    expect(circuit.model.state['pOut']).toBeCloseTo(root.dp, 2);
    // El lazo cerrado devuelve todo al estanque: el nivel no cambia.
    expect(circuit.model.state['level']).toBeCloseTo(40, 6);
    expect(circuit.model.state['i']).toBeCloseTo(root.i, 3);
    expect(circuit.solver.stats.failures).toBe(0);
  });

  it('el estanque es un solo nodo (`joint`) y su commit integra el neto', () => {
    const circuit = compilePump({ tankLevel: 20 });
    expect(circuit.portToNode['tank.out']).toBe(circuit.portToNode['tank.ret']);
    expect(circuit.model.state['level']).toBe(20);

    // El retorno cierra el lazo: el nivel se mantiene.
    run(circuit, 0.2);
    expect(circuit.model.state['level']).toBeCloseTo(20, 6);
  });

  it('la falla `filterClog` (binding de faults) estrangula el caudal', () => {
    const circuit = compilePump();
    run(circuit, 0.2);
    const healthy = circuit.model.state['q'] as number;

    circuit.model.faults['filterClog'] = 1;
    run(circuit, 0.5);
    const root = pumpLoopRoot(1);
    const clogged = circuit.model.state['q'] as number;
    expect(clogged).toBeLessThan(healthy);
    expect(clogged).toBeCloseTo(root.q, 1);
    expect(circuit.model.state['pOut']).toBeCloseTo(root.dp, 2);
  });

  it('reset restaura params, fallas, tiempo y estado de los elementos', () => {
    const circuit = compilePump({ tankLevel: 20 });
    run(circuit, 0.1);
    circuit.model.params['batteryV'] = 5;
    circuit.model.faults['filterClog'] = 1;
    const tank = circuit.elements['tank'];
    if (tank) tank.state['level'] = 3;

    circuit.model.reset();
    expect(circuit.model.time).toBe(0);
    expect(circuit.model.params['batteryV']).toBe(13.5);
    expect(circuit.model.faults['filterClog']).toBe(0);
    expect(circuit.model.state['level']).toBe(20);
  });

  it('los controladores corren antes del solver y leen el paso anterior', () => {
    const seen: number[] = [];
    const fake: ControllerFactory = (id) => {
      const state = { read: -1, calls: 0 };
      return {
        id,
        probes: ['i'],
        state,
        update(ctx) {
          state.read = ctx.read('i');
          state.calls += 1;
          const bat = ctx.elements['bat'];
          const voltage = ctx.params['batteryV'];
          if (bat) bat.control['v'] = typeof voltage === 'number' ? voltage : 0;
          seen.push(state.read);
        },
      };
    };
    const state: CircuitState = {};
    const circuit = compileCircuit({
      def: { ...TOY_ELECTRIC, controllers: [{ id: 'fake', type: 'fakeController' }] },
      types: ELEMENT_TYPES,
      controllerTypes: { fakeController: fake },
      // Sólo el switch va por binding: la tensión la escribe el controlador.
      bindings: [{ source: 'params', key: 'ignition', part: 'sw', input: 'closed' }],
      state,
    });
    expect(circuit.issues).toHaveLength(0);

    circuit.model.step(DT);
    expect(seen[0]).toBe(0); // todavía no hay muestra
    const i = circuit.model.state['i'] as number;
    expect(i).toBeCloseTo(12.6 / 10.03, 6);
    circuit.model.step(DT);
    expect(seen[1]).toBeCloseTo(i, 9); // muestreo del paso anterior
    expect(circuit.model.state['calls']).toBe(2);
  });
});

/** Punto fijo del lazo bomba → restrictor → estanque (mismas leyes del solver). */
function pumpLoopRoot(clog: number): { q: number; dp: number; v: number; i: number } {
  const kEff = 1e-3 * (1 + 1000 * clog);
  let v = 13.5;
  let q = 0;
  let dp = 0;
  let i = 0;
  for (let n = 0; n < 200; n++) {
    const vf = v / 13.5;
    const qm = 120 * vf;
    const pm = 6.5 * vf;
    const epsP = 0.01;
    // q = qm·(1 − dp/(pm+ε)) y dp = kEff·q² → A·q² + q − qm = 0.
    const a = (qm * kEff) / (pm + epsP);
    q = (-1 + Math.sqrt(1 + 4 * a * qm)) / (2 * a);
    dp = kEff * q * q;
    i = (1.5 + (5.5 * Math.max(dp, 0)) / (pm + epsP)) * vf;
    v = 13.5 - 0.02 * i;
  }
  return { q, dp, v, i };
}

describe('circuit — validate (§8.4)', () => {
  it('detecta tipo desconocido, puerto inexistente, dominio, fluido y self-link', () => {
    const def: CircuitDef = {
      id: 'bad',
      parts: [
        { id: 'r', type: 'nope', x: 0, y: 0 },
        { id: 'a', type: 'restrictor', x: 0, y: 0, params: { k: 1 } },
        { id: 'b', type: 'restrictor', x: 0, y: 0, params: { k: 1 }, fluid: 'coolant' },
        { id: 'bat', type: 'battery', x: 0, y: 0 },
      ],
      links: [
        { id: 'x', from: 'a.zzz', to: 'bat.+' },
        { id: 'y', from: 'a.a', to: 'bat.+' },
        { id: 'z', from: 'a.b', to: 'b.a' },
        { id: 'same', from: 'bat.-', to: 'bat.-' },
      ],
    };
    const codes = issueCodes(validateCircuit(def, ELEMENT_TYPES));
    expect(codes).toContain('unknown-type');
    expect(codes).toContain('unknown-port');
    expect(codes).toContain('domain-mismatch');
    expect(codes).toContain('fluid-mismatch');
    expect(codes).toContain('self-link');
  });

  it('detecta puerto con más de una conexión salvo en un `tee`', () => {
    const overloaded: CircuitDef = {
      id: 'over',
      fluid: 'fuel',
      parts: [
        { id: 'a', type: 'restrictor', x: 0, y: 0, params: { k: 1 } },
        { id: 'b', type: 'restrictor', x: 0, y: 0, params: { k: 1 } },
        { id: 'c', type: 'restrictor', x: 0, y: 0, params: { k: 1 } },
      ],
      links: [
        { id: 'l1', from: 'a.a', to: 'b.a' },
        { id: 'l2', from: 'a.b', to: 'c.a' },
        { id: 'l3', from: 'b.b', to: 'c.b' },
        { id: 'extra', from: 'a.a', to: 'b.b' },
      ],
    };
    expect(issueCodes(validateCircuit(overloaded, ELEMENT_TYPES))).toContain('multiple-links');

    const tee: CircuitDef = {
      id: 'tee',
      fluid: 'fuel',
      parts: [
        { id: 't', type: 'tee', x: 0, y: 0 },
        { id: 'a', type: 'restrictor', x: 0, y: 0, params: { k: 1 } },
        { id: 'b', type: 'restrictor', x: 0, y: 0, params: { k: 1 } },
        { id: 'c', type: 'restrictor', x: 0, y: 0, params: { k: 1 } },
      ],
      links: [
        { id: 'l1', from: 't.a', to: 'a.a' },
        { id: 'l2', from: 't.b', to: 'b.a' },
        { id: 'l3', from: 't.c', to: 'c.a' },
      ],
    };
    expect(issueCodes(validateCircuit(tee, ELEMENT_TYPES))).not.toContain('multiple-links');
  });

  it('avisa puertos sin conectar y detecta repetidos, sondas y fijos', () => {
    const def: CircuitDef = {
      id: 'warns',
      parts: [
        { id: 'a', type: 'resistor', x: 0, y: 0, params: { r: 1 } },
        { id: 'a', type: 'resistor', x: 0, y: 0, params: { r: 1 } },
        { id: 'b', type: 'resistor', x: 0, y: 0, params: { r: 1 } },
      ],
      links: [
        { id: 'l', from: 'a.a', to: 'a.b' },
        { id: 'l', from: 'a.a', to: 'a.b' },
      ],
      controllers: [
        { id: 'c', type: 'nope' },
        { id: 'c', type: 'nope' },
      ],
      probes: {
        badNode: { node: 'a.zzz' },
        badElement: { element: 'a', probe: 'nope' },
      },
      fixed: { 'a.zzz': 0 },
    };
    const codes = issueCodes(validateCircuit(def, ELEMENT_TYPES, {}));
    expect(codes).toContain('duplicate-part');
    expect(codes).toContain('duplicate-link');
    expect(codes).toContain('duplicate-controller');
    expect(codes).toContain('unknown-controller');
    expect(codes).toContain('invalid-probe');
    expect(codes).toContain('invalid-fixed');
    expect(codes).toContain('unconnected-port');
  });

  it('`fluid2` en un tipo que no es `crossFluid` es un error (A15 §10.4)', () => {
    const def: CircuitDef = {
      id: 'cross',
      fluid: 'coolant',
      parts: [
        { id: 'a', type: 'restrictor', x: 0, y: 0, params: { k: 1 }, fluid2: 'oil' },
        { id: 'b', type: 'restrictor', x: 0, y: 0, params: { k: 1 } },
      ],
      links: [{ id: 'l', from: 'a.a', to: 'b.a' }],
    };
    expect(issueCodes(validateCircuit(def, ELEMENT_TYPES))).toContain('invalid-cross-fluid');

    const ok: CircuitDef = {
      ...def,
      parts: [{ id: 'br', type: 'breach', x: 0, y: 0, params: { k: 1e-3 }, fluid2: 'oil' }, def.parts[1]!],
      links: [{ id: 'l', from: 'br.a', to: 'b.a' }],
    };
    expect(issueCodes(validateCircuit(ok, ELEMENT_TYPES))).not.toContain('invalid-cross-fluid');
  });

  it('un puerto thermal con uno hydraulic es domain-mismatch (A13)', () => {
    const def: CircuitDef = {
      id: 'mixed',
      fluid: 'coolant',
      parts: [
        { id: 'heat', type: 'heatSource', x: 0, y: 0 },
        { id: 'hose', type: 'restrictor', x: 0, y: 0, params: { k: 1 } },
      ],
      links: [{ id: 'l', from: 'heat.a', to: 'hose.a' }],
    };
    expect(issueCodes(validateCircuit(def, ELEMENT_TYPES))).toContain('domain-mismatch');
  });

  it('CircuitDef.initial arranca los nodos libres y reset lo repite', () => {
    const def: CircuitDef = {
      id: 'initial',
      fluid: 'fuel',
      parts: [
        { id: 'c', type: 'volume', x: 0, y: 0, params: { c: 0.01 } },
        { id: 'drain', type: 'leak', x: 0, y: 0, params: { k: 100 } },
      ],
      links: [{ id: 'l', from: 'c.a', to: 'drain.a' }],
      faults: { sev: 1 },
      initial: { 'c.a': 3 },
    };
    const circuit = compileCircuit({
      def,
      types: ELEMENT_TYPES,
      state: {},
      bindings: [{ source: 'faults', key: 'sev', part: 'drain', input: 'severity' }],
    });
    const node = circuit.portToNode['c.a'] ?? 0;
    expect(circuit.solver.potential(node)).toBeCloseTo(3, 6);
    for (let i = 0; i < 500; i++) circuit.model.step(DT);
    expect(circuit.solver.potential(node)).toBeLessThan(2.9);
    circuit.model.reset();
    expect(circuit.solver.potential(node)).toBeCloseTo(3, 6);
  });
});
