// Contrato del solver nodal (§24) y de sus elementos (P23 §8.2). Puro (§1):
// sin DOM, sin azar, sin reloj. Los docs vivos están en docs/modules/solver.md.

import type { FaultSpec } from '../../core/types.ts';

/** Dominio de un puerto. El solver no convierte entre dominios (§8.1). */
export type Domain = 'hydraulic' | 'electric' | 'thermal';

/** Fluido de un puerto hidráulico; `air` es el vacío del múltiple (§30). */
export type Fluid = 'fuel' | 'coolant' | 'oil' | 'brake' | 'atf' | 'air';

export interface PortDef {
  id: string;
  domain: Domain;
  /** Obligatorio si `domain === 'hydraulic'` (§30); lo valida el circuito (A5). */
  fluid?: Fluid;
}

/** Falla declarada por un elemento: la clave del record es el `faultKey` (§26). */
export type ElementFault = Omit<FaultSpec, 'key'>;

/** Salida local de un elemento con k puertos; el solver la reusa entre llamadas. */
export interface EvalOut {
  /** `flow[p]` = flujo que sale del elemento hacia el puerto p (signo del elemento). */
  flow: Float64Array;
  /** `jac[p*k + q]` = ∂flow[p]/∂pot[q], fila-mayor. */
  jac: Float64Array;
}

/**
 * Elemento de red (§24): función pura de (potenciales de sus puertos, control,
 * estado interno) → flujos y jacobiano. No escribe en nodos.
 */
export interface ElementDef {
  readonly ports: readonly PortDef[];
  params: Record<string, number>;
  control: Record<string, number | boolean>;
  state: Record<string, number>;
  /**
   * Aporte al nodo de cada puerto, YA en unidades de flujo/(potencial·s):
   * hidráulico `C[L/bar]·3600`, eléctrico `C[F]` (§8.1). El solver lo suma por nodo.
   */
  capacitance?: Readonly<Record<string, number>>;
  /** Estado inicial (p. ej. `tank.level`). Lo llama el compilador al crear (A5). */
  init?(overrides: Readonly<Record<string, unknown>>): void;
  eval(pot: Float64Array, out: EvalOut, dt: number): void;
  /** Actualiza `state` tras converger. `reaction[p]` = reacción del nodo del puerto p. */
  commit(pot: Float64Array, dt: number, reaction: Float64Array): void;
  /** Valores medibles, p. ej. caudal o corriente (P23 §8.3). */
  probes?: Readonly<Record<string, (pot: Float64Array) => number>>;
  faults?: Readonly<Record<string, ElementFault>>;
  /**
   * Potencial fijo (Dirichlet) por puerto si el elemento fija su nodo, p. ej.
   * `pressureSource`. Se evalúa al inicio de cada paso: así una fuente sigue a
   * su `control` sin `setFixed`. NaN (o no llenar la entrada) = no fija.
   */
  fixed?(out: Float64Array): void;
}

/** Elemento ubicado en la red: `nodes[p]` es el nodo del puerto p (lo asigna A5). */
export interface SolverElement {
  readonly def: ElementDef;
  readonly nodes: readonly number[];
}

export interface SolverOptions {
  nodeCount: number;
  elements: readonly SolverElement[];
  /**
   * Potencial fijo por nodo (Dirichlet); NaN = nodo libre (§8.1).
   * `atm` = 0 bar, `chassis` = 0 V, `tank` = 0 bar (propio, ver `solver.md`).
   */
  ground?: ArrayLike<number>;
  /** Conductancia mínima a tierra que evita nodos flotantes singulares. */
  gmin?: number;
  maxIterations?: number;
  /** Amortiguación: |Δx| máximo por iteración (1 bar o 1 V, §8.1). */
  maxDelta?: number;
  /** Tolerancia de |Δx| para converger. */
  tolerance?: number;
}

export interface SolverStepResult {
  ok: boolean;
  iterations: number;
}

export interface SolverStats {
  /** Pasos que no convergieron (los tests del combustible exigen 0). */
  failures: number;
  /** Iteraciones del último paso. */
  iterations: number;
}

export interface Solver {
  step(dt: number): SolverStepResult;
  /** Potencial del último paso convergido (o del paso anterior si falló). */
  potential(node: number): number;
  /** Flujo neto que sale de un nodo fijo hacia los elementos (L/h o A). */
  reaction(node: number): number;
  /** Fija el potencial de un nodo a partir de este paso. */
  setFixed(node: number, value: number): void;
  /** Libera un nodo fijado con `setFixed` (vuelve a ser incógnita). */
  free(node: number): void;
  /**
   * Escrita directa del potencial de un nodo **libre** (no toca los fijos):
   * la usan `CircuitDef.initial` y las acciones de módulo (p. ej. la
   * temperatura inicial del térmico, A13).
   */
  setPotential(node: number, value: number): void;
  readonly stats: SolverStats;
}
