// Contratos del circuito compilado (P23 §8.4). Puro (§1).
// La spec viva está en docs/modules/solver.md y CONTRATOS.md §4.10.

import type { Model, ModelActions, ParamRecord } from '../../core/types.ts';
import type { ControllerDef, ControllerFactory } from '../controllers/index.ts';
import type { ElementTypeInfo } from '../elements/index.ts';
import type { ElementDef, Fluid, Solver } from '../solver/types.ts';

export interface CircuitPartDef {
  id: string;
  type: string;
  /** Layout (D5): la misma instancia alimenta física, renderer y armado. */
  x: number;
  y: number;
  rot?: number;
  /** Tipo del drawer del renderer (A7); por defecto, `type`. */
  visual?: string;
  params?: Readonly<Record<string, number>>;
  /** Fluido propio; si no, el del circuito (§30). */
  fluid?: Fluid;
  label?: string;
}

/** Datos de trazo de una conexión (A7); el renderer sólo los lee. */
export interface CircuitLinkVisual {
  /** partId del trazo para clic/resaltado; sin él, el tubo no es clickeable. */
  owner?: string;
  /** Clase del tubo: `fluid-*`. */
  pipeClass?: string;
  /** Clase de las partículas: `p-*`. Sin esto el enlace no lleva partículas. */
  flowClass?: string;
  /** px/s por unidad de caudal; por defecto `PX_PER_LH` (CONTRATOS 4.6). */
  scale?: number;
  spacing?: number;
  radius?: number;
  width?: number;
  /** Opacidad fija del fluido cuando no hay `potential`. */
  opacity?: number;
  /**
   * Rango `[frío, caliente]` del `potential` para colorear el fluido (A13):
   * el renderer escribe `--t` (0..1) en el tubo y en las partículas.
   */
  potentialRange?: readonly [number, number];
}

export interface CircuitLinkDef {
  id: string;
  /** `'part.port'`. */
  from: string;
  to: string;
  /** Puntos para el renderer; opcional (A7 puede rutear sola). */
  route?: readonly (readonly [number, number])[];
  /** Trazo visible (A7): con `route` o `visual` el renderer dibuja el tubo. */
  visual?: CircuitLinkVisual;
}

export interface CircuitControllerDef {
  id: string;
  type: string;
  params?: Readonly<ParamRecord>;
}

export interface CircuitProbeDef {
  /** Puerto `'part.port'`: la sonda es el potencial de su nodo. */
  node?: string;
  /** Parte + nombre de la sonda del elemento. */
  element?: string;
  probe?: string;
}

export interface CircuitDef {
  id: string;
  title?: string;
  /** Fluido por defecto de los elementos hidráulicos (§30). */
  fluid?: Fluid;
  parts: readonly CircuitPartDef[];
  links: readonly CircuitLinkDef[];
  controllers?: readonly CircuitControllerDef[];
  probes?: Readonly<Record<string, CircuitProbeDef>>;
  /** Valores por defecto del modelo; el modo los escribe (§2). */
  params?: Readonly<ParamRecord>;
  /** Fallas por defecto, con claves planas del módulo. */
  faults?: Readonly<ParamRecord>;
  /** Puertos con potencial fijo: `'part.port'` → bar/V (atm, chasis, …). */
  fixed?: Readonly<Record<string, number>>;
  /** Potencial inicial de nodos libres: `'part.port'` → valor (A13). */
  initial?: Readonly<Record<string, number>>;
}

/** Enlaza un param/falla del modelo con el `control` de una parte. */
export interface CircuitBinding {
  source: 'params' | 'faults';
  /** Clave del modelo (p. ej. `fastConsumption` o `filterClog`). */
  key: string;
  part: string;
  /** Clave de `control` del elemento destino. */
  input: string;
}

export type CircuitStateValue = number | string | boolean | readonly unknown[];
export type CircuitState = Record<string, CircuitStateValue>;

export type CircuitIssueLevel = 'error' | 'warning';
export type CircuitIssueCode =
  | 'duplicate-part'
  | 'unknown-type'
  | 'duplicate-link'
  | 'unknown-port'
  | 'self-link'
  | 'domain-mismatch'
  | 'fluid-mismatch'
  | 'multiple-links'
  | 'unconnected-port'
  | 'duplicate-controller'
  | 'unknown-controller'
  | 'invalid-probe'
  | 'invalid-fixed';

export interface CircuitIssue {
  level: CircuitIssueLevel;
  code: CircuitIssueCode;
  message: string;
  part?: string;
  port?: string;
  link?: string;
  controller?: string;
  probe?: string;
}

export interface CircuitNodes {
  count: number;
  /** Puertos de cada nodo (`'part.port'`). */
  ports: readonly (readonly string[])[];
  /** Potencial fijo por nodo (NaN = libre), como va al solver (§8.1). */
  fixed: Float64Array;
}

export interface CompileOptions<S extends CircuitState = CircuitState> {
  def: CircuitDef;
  /** Tipos de elemento registrados (fábrica + capacidades del compilador). */
  types: Readonly<Record<string, ElementTypeInfo>>;
  /** Fábricas de controladores disponibles. */
  controllerTypes?: Readonly<Record<string, ControllerFactory>>;
  bindings?: readonly CircuitBinding[];
  /** Overrides de `init` de los elementos (p. ej. `tankLevel`). */
  init?: Readonly<Record<string, unknown>>;
  /** Estado del modelo; el compilador escribe sondas y estado de controladores. */
  state: S;
  params?: Readonly<ParamRecord>;
  faults?: Readonly<ParamRecord>;
  actions?: ModelActions;
  seed?: number;
}

export interface CompiledCircuit<S extends CircuitState = CircuitState> {
  readonly model: Model<ParamRecord, ParamRecord, S>;
  /** Solver actual (se recrea en `reset`). */
  readonly solver: Solver;
  readonly elements: Readonly<Record<string, ElementDef>>;
  readonly controllers: readonly ControllerDef[];
  readonly nodes: CircuitNodes;
  /** `'part.port'` → índice de nodo. */
  readonly portToNode: Readonly<Record<string, number>>;
  readonly linkToNodes: Readonly<Record<string, { from: number; to: number }>>;
  /** Diagnóstico de `validateCircuit` al compilar (errores y avisos). */
  readonly issues: readonly CircuitIssue[];
}
