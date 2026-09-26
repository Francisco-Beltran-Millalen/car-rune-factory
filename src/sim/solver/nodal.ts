// Solver nodal implícito con Newton-Raphson por paso (§24, P23 §8.1). Puro (§1).
// Unidades de los elementos y criterios de convergencia: docs/modules/solver.md.

import { solveDense } from './linalg.ts';
import type {
  EvalOut,
  Solver,
  SolverOptions,
  SolverStats,
  SolverStepResult,
} from './types.ts';

const DEFAULT_GMIN = 1e-9;
const DEFAULT_MAX_ITERATIONS = 25;
const DEFAULT_MAX_DELTA = 1;
const DEFAULT_TOLERANCE = 1e-7;
const RESIDUAL_ABS = 1e-6;
const RESIDUAL_REL = 1e-6;
// Relajación por nodo: si el paso de Newton cambia de signo entre iteraciones,
// ese nodo está oscilando (típico de dos nodos sin capacitancia unidos por un
// restrictor saturando); se le media el paso y al resto no se lo frena.
const RELAX_MIN = 1 / 1024;

export function createSolver(options: SolverOptions): Solver {
  const { nodeCount, elements } = options;
  const gmin = options.gmin ?? DEFAULT_GMIN;
  const maxIterations = options.maxIterations ?? DEFAULT_MAX_ITERATIONS;
  const maxDelta = options.maxDelta ?? DEFAULT_MAX_DELTA;
  const tolerance = options.tolerance ?? DEFAULT_TOLERANCE;

  const x = new Float64Array(nodeCount); // potencial en evaluación
  const xStart = new Float64Array(nodeCount); // potencial del último paso convergido
  const relax = new Float64Array(nodeCount).fill(1); // amortiguación por nodo
  const dxPrev = new Float64Array(nodeCount); // paso anterior por nodo
  const baseFixed = new Float64Array(nodeCount).fill(NaN); // Dirichlet explícito
  const fixed = new Float64Array(nodeCount).fill(NaN); // fijos efectivos del paso
  const reactions = new Float64Array(nodeCount); // flujo neto que sale de nodos fijos
  const nodeCap = new Float64Array(nodeCount); // Σ Ĉ de los elementos por nodo
  const unknownOf = new Int32Array(nodeCount).fill(-1); // nodo → incógnita (o -1)
  const freeNodes = new Int32Array(nodeCount); // incógnita → nodo
  const stats: SolverStats = { failures: 0, iterations: 0 };

  let freeCount = 0;
  let J = new Float64Array(0);
  let F = new Float64Array(0);
  let rhs = new Float64Array(0);
  let absFlow = new Float64Array(0);

  let maxPorts = 1;
  for (const el of elements) {
    const def = el.def;
    const k = def.ports.length;
    if (k > maxPorts) maxPorts = k;
    if (!def.capacitance) continue;
    for (let p = 0; p < k; p++) {
      const port = def.ports[p];
      const cap = port ? def.capacitance[port.id] : undefined;
      const node = el.nodes[p] ?? 0;
      if (cap) nodeCap[node] = (nodeCap[node] ?? 0) + cap;
    }
  }

  const pot = new Float64Array(maxPorts);
  const reactionLocal = new Float64Array(maxPorts);
  const fixedOut = new Float64Array(maxPorts);
  const out: EvalOut = {
    flow: new Float64Array(maxPorts),
    jac: new Float64Array(maxPorts * maxPorts),
  };

  if (options.ground) baseFixed.set(options.ground);

  function rebuildUnknowns(): void {
    freeCount = 0;
    for (let node = 0; node < nodeCount; node++) {
      if (Number.isFinite(fixed[node] ?? NaN)) {
        unknownOf[node] = -1;
      } else {
        unknownOf[node] = freeCount;
        freeNodes[freeCount] = node;
        freeCount++;
      }
    }
    J = new Float64Array(freeCount * freeCount);
    F = new Float64Array(freeCount);
    rhs = new Float64Array(freeCount);
    absFlow = new Float64Array(freeCount);
  }

  function mapChanged(): boolean {
    for (let node = 0; node < nodeCount; node++) {
      const isFixed = Number.isFinite(fixed[node] ?? NaN);
      const wasFixed = (unknownOf[node] ?? -1) < 0;
      if (isFixed !== wasFixed) return true;
    }
    return false;
  }

  /** Dirichlet del paso: el `ground` base más lo que declaren los elementos. */
  function applyFixed(): void {
    fixed.set(baseFixed);
    for (const el of elements) {
      const def = el.def;
      if (!def.fixed) continue;
      const k = def.ports.length;
      fixedOut.fill(NaN);
      def.fixed(fixedOut);
      for (let p = 0; p < k; p++) {
        const v = fixedOut[p];
        if (v === undefined || !Number.isFinite(v)) continue;
        fixed[el.nodes[p] ?? 0] = v;
      }
    }
    if (mapChanged()) rebuildUnknowns();
  }

  function assemble(dt: number): void {
    F.fill(0);
    J.fill(0);
    absFlow.fill(0);
    reactions.fill(0);
    for (const el of elements) {
      const def = el.def;
      const k = def.ports.length;
      const nodes = el.nodes;
      for (let p = 0; p < k; p++) pot[p] = x[nodes[p] ?? 0] ?? 0;
      out.flow.fill(0);
      out.jac.fill(0);
      def.eval(pot, out, dt);
      for (let p = 0; p < k; p++) {
        const node = nodes[p] ?? 0;
        const u = unknownOf[node] ?? -1;
        const flow = out.flow[p] ?? 0;
        if (u >= 0) {
          // F = flujos que salen del nodo hacia los elementos + término capacitivo.
          F[u] = (F[u] ?? 0) - flow;
          absFlow[u] = (absFlow[u] ?? 0) + Math.abs(flow);
        } else {
          // En un nodo fijo el flujo no es incógnita: es la reacción del nodo.
          reactions[node] = (reactions[node] ?? 0) - flow;
        }
        if (u < 0) continue;
        for (let q = 0; q < k; q++) {
          const v = unknownOf[nodes[q] ?? 0] ?? -1;
          if (v < 0) continue;
          const idx = u * freeCount + v;
          J[idx] = (J[idx] ?? 0) - (out.jac[p * k + q] ?? 0);
        }
      }
    }
    for (let node = 0; node < nodeCount; node++) {
      const cap = nodeCap[node] ?? 0;
      const u = unknownOf[node] ?? -1;
      if (cap !== 0) {
        const term = (cap * ((x[node] ?? 0) - (xStart[node] ?? 0))) / dt;
        if (u >= 0) F[u] = (F[u] ?? 0) + term;
        else reactions[node] = (reactions[node] ?? 0) + term;
      }
      if (u >= 0) {
        const idx = u * freeCount + u;
        J[idx] = (J[idx] ?? 0) + cap / dt + gmin;
      }
    }
  }

  /** |F_i| < abs + rel·Σ|flujos| en todos los nodos libres (P23 §8.1). */
  function residualOk(): boolean {
    for (let u = 0; u < freeCount; u++) {
      const f = F[u] ?? 0;
      if (!Number.isFinite(f)) return false;
      if (Math.abs(f) > RESIDUAL_ABS + RESIDUAL_REL * (absFlow[u] ?? 0)) {
        return false;
      }
    }
    return true;
  }

  /** Aplica Δx con relajación por nodo, tope ±maxDelta y sin cruzar el 0;
   *  devuelve max|Δx| o NaN si no es finito. */
  function applyDelta(): number {
    let maxAbs = 0;
    for (let u = 0; u < freeCount; u++) {
      const node = freeNodes[u] ?? 0;
      let d = rhs[u] ?? 0;
      if (!Number.isFinite(d)) return NaN;
      const prev = dxPrev[node] ?? 0;
      if (prev * d < 0) relax[node] = Math.max((relax[node] ?? 1) * 0.5, RELAX_MIN);
      else relax[node] = Math.min(1, (relax[node] ?? 1) * 2);
      d *= relax[node] ?? 1;
      if (d > maxDelta) d = maxDelta;
      else if (d < -maxDelta) d = -maxDelta;
      const current = x[node] ?? 0;
      // El paso no cruza el 0 del nodo (ciclo p → −p de un restrictor muerto).
      if (current * (current + d) < 0) d = -current;
      x[node] = current + d;
      dxPrev[node] = rhs[u] ?? 0;
      const a = Math.abs(d);
      if (a > maxAbs) maxAbs = a;
    }
    return maxAbs;
  }

  function step(dt: number): SolverStepResult {
    applyFixed();
    x.set(xStart);
    for (let node = 0; node < nodeCount; node++) {
      const v = fixed[node] ?? NaN;
      if (Number.isFinite(v)) x[node] = v;
    }

    let ok = false;
    let iterations = 0;
    let deltaMax = 0;
    for (let iter = 1; iter <= maxIterations; iter++) {
      iterations = iter;
      assemble(dt);
      if (deltaMax < tolerance && residualOk()) {
        ok = true;
        break;
      }
      for (let u = 0; u < freeCount; u++) rhs[u] = -(F[u] ?? 0);
      if (!solveDense(J, rhs, freeCount)) break;
      deltaMax = applyDelta();
      if (!Number.isFinite(deltaMax)) break;
    }

    if (!ok) {
      x.set(xStart);
      stats.failures++;
      stats.iterations = iterations;
      return { ok: false, iterations };
    }

    for (const el of elements) {
      const def = el.def;
      const k = def.ports.length;
      const nodes = el.nodes;
      for (let p = 0; p < k; p++) {
        const node = nodes[p] ?? 0;
        pot[p] = x[node] ?? 0;
        reactionLocal[p] = reactions[node] ?? 0;
      }
      def.commit(pot, dt, reactionLocal);
    }
    xStart.set(x);
    stats.iterations = iterations;
    return { ok: true, iterations };
  }

  function setFixed(node: number, value: number): void {
    if (node < 0 || node >= nodeCount) return;
    baseFixed[node] = value;
    fixed[node] = value;
    if (mapChanged()) rebuildUnknowns();
  }

  function free(node: number): void {
    setFixed(node, NaN);
  }

  rebuildUnknowns();

  return {
    step,
    potential: (node: number): number => x[node] ?? 0,
    reaction: (node: number): number => reactions[node] ?? 0,
    setFixed,
    free,
    stats,
  };
}
