// Criterios de A4 (P23 §9): divisor de tensión, RC, RL, dos restrictores en
// serie vs. fórmula cerrada, nodo flotante sin NaN, nodo fijo por elemento,
// fallos de convergencia y benchmark. Los elementos se definen acá mismo con
// el contrato de P23 §8.2 (A5 los mueve a src/sim/elements/).
import { describe, expect, it } from 'vitest';
import { createSolver } from '../../src/sim/solver/nodal.ts';
import type { ElementDef, PortDef, Solver, SolverElement } from '../../src/sim/solver/types.ts';

const DT = 0.001;
/** Regularización del restrictor (§8.2). */
const EPS = 1e-4;

const ELEC: readonly PortDef[] = [
  { id: 'a', domain: 'electric' },
  { id: 'b', domain: 'electric' },
];
const HYD: readonly PortDef[] = [
  { id: 'a', domain: 'hydraulic', fluid: 'fuel' },
  { id: 'b', domain: 'hydraulic', fluid: 'fuel' },
];

function el(def: ElementDef, ...nodes: number[]): SolverElement {
  return { def, nodes };
}

function resistor(r: number): ElementDef {
  const g = 1 / r;
  return {
    ports: ELEC,
    params: { r },
    control: {},
    state: {},
    eval(pot, out) {
      const q = g * ((pot[0] ?? 0) - (pot[1] ?? 0));
      out.flow[0] = -q;
      out.flow[1] = q;
      out.jac[0] = -g;
      out.jac[1] = g;
      out.jac[2] = g;
      out.jac[3] = -g;
    },
    commit() {},
  };
}

function restrictor(k: number): ElementDef {
  return {
    ports: HYD,
    params: { k },
    control: {},
    state: {},
    eval(pot, out) {
      const dp = (pot[0] ?? 0) - (pot[1] ?? 0);
      const s = Math.abs(dp) + EPS;
      // q = dp/√(k·s) y dq/ddp = (|dp|/2 + ε)/(√k·s^1.5).
      const q = dp / Math.sqrt(k * s);
      const dq = (Math.abs(dp) / 2 + EPS) / (Math.sqrt(k) * Math.pow(s, 1.5));
      out.flow[0] = -q;
      out.flow[1] = q;
      out.jac[0] = -dq;
      out.jac[1] = dq;
      out.jac[2] = dq;
      out.jac[3] = -dq;
    },
    commit() {},
  };
}

/** Sólo compliancia hacia el nodo del puerto `a` (§8.1: ya en flujo/(pot·s)). */
function capacitor(c: number): ElementDef {
  return {
    ports: ELEC,
    params: { c },
    control: {},
    state: {},
    capacitance: { a: c },
    eval() {},
    commit() {},
  };
}

/** Backward Euler: i = i_prev + (dt/L)·v, con la corriente en `state.i`. */
function inductor(l: number): ElementDef {
  const def: ElementDef = {
    ports: ELEC,
    params: { l },
    control: {},
    state: { i: 0 },
    eval(pot, out, dt) {
      const g = dt / l;
      const i = (def.state['i'] ?? 0) + g * ((pot[0] ?? 0) - (pot[1] ?? 0));
      out.flow[0] = -i;
      out.flow[1] = i;
      out.jac[0] = -g;
      out.jac[1] = g;
      out.jac[2] = g;
      out.jac[3] = -g;
    },
    commit(pot, dt) {
      def.state['i'] =
        (def.state['i'] ?? 0) + (dt / l) * ((pot[0] ?? 0) - (pot[1] ?? 0));
    },
  };
  return def;
}

function voltageSource(v: number): { def: ElementDef; set(value: number): void } {
  const def: ElementDef = {
    ports: [{ id: 'a', domain: 'electric' }],
    params: {},
    control: {},
    state: {},
    fixed(out) {
      out[0] = v;
    },
    eval(_pot, out) {
      out.flow[0] = 0;
      out.jac[0] = 0;
    },
    commit() {},
  };
  return {
    def,
    set(value: number): void {
      v = value;
    },
  };
}

function run(s: Solver, seconds: number): void {
  const n = Math.round(seconds / DT);
  for (let i = 0; i < n; i++) s.step(DT);
}

describe('nodal — createSolver (§8.1)', () => {
  it('red vacía (0 nodos) converge en 1 iteración', () => {
    const solver = createSolver({ nodeCount: 0, elements: [] });
    const res = solver.step(DT);
    expect(res.ok).toBe(true);
    expect(res.iterations).toBe(1);
    expect(solver.stats.failures).toBe(0);
  });

  it('divisor de tensión: fuente por elemento y tierra por ground', () => {
    const source = voltageSource(10);
    const solver = createSolver({
      nodeCount: 3,
      elements: [el(source.def, 0), el(resistor(10), 0, 1), el(resistor(10), 1, 2)],
      ground: new Float64Array([NaN, NaN, 0]),
    });
    run(solver, 0.01);
    expect(solver.stats.failures).toBe(0);
    expect(solver.potential(1)).toBeCloseTo(5, 9);
  });

  it('la fuente fija sigue a su control entre pasos', () => {
    const source = voltageSource(10);
    const solver = createSolver({
      nodeCount: 2,
      elements: [el(source.def, 0), el(resistor(10), 0, 1)],
      ground: new Float64Array([NaN, 0]),
    });
    run(solver, 0.01);
    expect(solver.potential(0)).toBeCloseTo(10, 9);
    source.set(20);
    run(solver, 0.01);
    expect(solver.potential(0)).toBeCloseTo(20, 9);
  });

  it('reacciones de los nodos fijos: flujo neto que sale hacia los elementos', () => {
    const solver = createSolver({
      nodeCount: 2,
      elements: [el(resistor(20), 0, 1)],
      ground: new Float64Array([10, 0]),
    });
    run(solver, 0.01);
    expect(solver.reaction(0)).toBeCloseTo(0.5, 9);
    expect(solver.reaction(1)).toBeCloseTo(-0.5, 9);
  });

  it('RC: carga al 63,2 % en τ', () => {
    const r = 1000;
    const c = 1e-3;
    const solver = createSolver({
      nodeCount: 3,
      elements: [el(resistor(r), 0, 1), el(capacitor(c), 1, 2)],
      ground: new Float64Array([5, NaN, 0]),
    });
    run(solver, r * c);
    expect(solver.stats.failures).toBe(0);
    expect(solver.potential(1)).toBeCloseTo(5 * (1 - Math.exp(-1)), 1);
  });

  it('RL: corriente al 63 % en τ = L/R', () => {
    const r = 10;
    const l = 0.5;
    const inductance = inductor(l);
    const solver = createSolver({
      nodeCount: 3,
      elements: [el(resistor(r), 0, 1), el(inductance, 1, 2)],
      ground: new Float64Array([5, NaN, 0]),
    });
    run(solver, l / r);
    const i = inductance.state['i'] ?? 0;
    expect(i).toBeGreaterThan((5 / r) * 0.6);
    expect(i).toBeLessThan((5 / r) * 0.66);
  });

  it('dos restrictores en serie contra la fórmula cerrada', () => {
    const k1 = 1e-3;
    const k2 = 2e-3;
    const pIn = 6;
    const solver = createSolver({
      nodeCount: 3,
      elements: [el(restrictor(k1), 0, 1), el(restrictor(k2), 1, 2)],
      ground: new Float64Array([pIn, NaN, 0]),
    });
    run(solver, 0.1);
    expect(solver.stats.failures).toBe(0);
    const p1 = solver.potential(1);
    const qSolver = p1 / Math.sqrt(k2 * (p1 + EPS));
    const qClosed = Math.sqrt(pIn / (k1 + k2));
    expect(p1).toBeCloseTo(4, 2);
    expect(Math.abs(qSolver - qClosed) / qClosed).toBeLessThan(0.01);
  });

  it('nodo flotante: gmin evita NaN', () => {
    const solver = createSolver({
      nodeCount: 3,
      elements: [el(resistor(10), 0, 1)],
    });
    const res = solver.step(DT);
    expect(res.ok).toBe(true);
    for (let node = 0; node < 3; node++) {
      expect(Number.isFinite(solver.potential(node))).toBe(true);
    }
    expect(solver.potential(2)).toBe(0);
  });

  it('setPotential arranca un nodo libre y no toca los fijos', () => {
    const solver = createSolver({ nodeCount: 2, elements: [] });
    solver.setPotential(0, 42);
    solver.setFixed(1, 7);
    solver.setPotential(1, 99);
    const res = solver.step(DT);
    expect(res.ok).toBe(true);
    expect(solver.potential(0)).toBeCloseTo(42, 9);
    expect(solver.potential(1)).toBeCloseTo(7, 9);
  });

  it('setFixed/free cambian la incógnita sin NaN', () => {
    const solver = createSolver({ nodeCount: 2, elements: [el(resistor(10), 0, 1)] });
    run(solver, 0.01);
    solver.setFixed(0, 5);
    run(solver, 0.01);
    expect(solver.potential(0)).toBeCloseTo(5, 9);
    solver.free(0);
    run(solver, 0.01);
    expect(Number.isFinite(solver.potential(0))).toBe(true);
    expect(solver.stats.failures).toBe(0);
  });

  it('un paso que no converge revierte y cuenta la falla', () => {
    const bad: ElementDef = {
      ports: ELEC,
      params: {},
      control: {},
      state: {},
      eval(_pot, out) {
        out.flow[0] = 1;
        out.flow[1] = -1;
      },
      commit() {},
    };
    const solver = createSolver({ nodeCount: 2, elements: [el(bad, 0, 1)] });
    const res = solver.step(DT);
    expect(res.ok).toBe(false);
    expect(solver.stats.failures).toBe(1);
    expect(solver.potential(0)).toBe(0);
    expect(solver.potential(1)).toBe(0);
  });

  it('un eval con NaN no contamina el estado', () => {
    const bad: ElementDef = {
      ports: [{ id: 'a', domain: 'electric' }],
      params: {},
      control: {},
      state: {},
      eval(_pot, out) {
        out.flow[0] = NaN;
      },
      commit() {},
    };
    const solver = createSolver({ nodeCount: 1, elements: [el(bad, 0)] });
    expect(solver.step(DT).ok).toBe(false);
    expect(Number.isFinite(solver.potential(0))).toBe(true);
  });

  it('benchmark: 20 nodos × 1000 pasos (medido, sin umbral)', () => {
    const network: SolverElement[] = [];
    for (let i = 0; i < 19; i++) network.push(el(resistor(1), i, i + 1));
    for (let i = 1; i < 19; i++) network.push(el(capacitor(1e-6), i, 19));
    const ground = new Float64Array(20).fill(NaN);
    ground[0] = 10;
    ground[19] = 0;
    const solver = createSolver({ nodeCount: 20, elements: network, ground });

    const t0 = performance.now();
    for (let i = 0; i < 1000; i++) solver.step(DT);
    const ms = performance.now() - t0;
    expect(solver.stats.failures).toBe(0);
    const stepsPerSecond = 1000 / (ms / 1000);
    process.stdout.write(
      `\n[solver] benchmark 20 nodos × 1000 pasos: ${ms.toFixed(1)} ms ` +
        `(${(ms / 1000).toFixed(4)} ms/paso, ${stepsPerSecond.toFixed(0)} pasos/s)\n`,
    );
  });
});
