// Contratos del core en TypeScript (§31). Fuente de verdad de las firmas;
// docs/CONTRATOS.md las explica.

import type { CircuitDef } from '../sim/circuit/types.ts';

export type ParamValue = number | boolean | string;
export type ParamRecord = Record<string, ParamValue>;

/** Las acciones reciben args de la UI/presets: cada modelo los valida en runtime (§6). */
export type ModelActions = Readonly<Record<string, (...args: unknown[]) => void>>;

export interface Model<
  P extends ParamRecord = ParamRecord,
  F extends ParamRecord = ParamRecord,
  S extends object = object,
> {
  readonly params: P; // escriben sólo modos y tests (§2, §20)
  readonly faults: F;
  readonly state: Readonly<S>; // §2: afuera es de sólo lectura
  readonly actions: ModelActions;
  readonly time: number;
  step(dt: number): void;
  reset(): void;
}

export type AnyModel = Model;

export interface ViewContext<M extends AnyModel = AnyModel> {
  svg: SVGSVGElement;
  model: M;
  /** La propia vista la llama cuando se hace clic en una pieza (CONTRATOS 4.3). */
  selectPart(partId: string): void;
}

export interface View {
  /** dt = segundos reales × timeScale. */
  update(dt: number): void;
  /** Opcional: efectos extra de resaltado (CONTRATOS 4.3). */
  highlight?(partId: string | null): void;
  destroy(): void;
}

/** Canales del presenter (A7): valores planos que animan los drawers. */
export type VisualValue = number | string | boolean;

export interface VisualLink {
  /** Caudal con signo (L/h o A). */
  flow: number;
  /** Presión/tensión media del tramo (bar o V); 0 si no aplica. */
  potential: number;
  /** Fracción 0..1 de partículas dibujadas como aire. */
  air: number;
}

/**
 * Lo único que el renderer lee además del `CircuitDef` (CONTRATOS 6.5).
 * Lo produce `src/presenter/`; los ids de `faultCues` son §26.
 */
export interface VisualState {
  parts: Record<string, Record<string, VisualValue>>;
  links: Record<string, VisualLink>;
  global: Record<string, VisualValue>;
  faultCues: readonly string[];
}

/** Contexto de un `PresentFn`: modelo de sólo lectura + fallas visibles. */
export interface PresentContext {
  readonly state: Readonly<Record<string, unknown>>;
  readonly params: Readonly<Record<string, unknown>>;
  readonly faults: Readonly<Record<string, unknown>>;
  /** Ids §26 de fallas visibles con la `ModeUi` actual (CONTRATOS 6.6). */
  readonly visibleFaults: ReadonlySet<string>;
}

export type PresentFn = (ctx: PresentContext) => VisualValue;

/** Canales por pieza y por enlace; datos del módulo, los evalúa el presenter. */
export interface PresentScheme {
  parts: Readonly<Record<string, Readonly<Record<string, PresentFn>>>>;
  links?: Readonly<
    Record<string, { flow?: PresentFn; potential?: PresentFn; air?: PresentFn }>
  >;
  global?: Readonly<Record<string, PresentFn>>;
}

export interface ControlOption {
  value: ParamValue;
  label: string;
}

export interface ControlSpec<M extends AnyModel = AnyModel> {
  type: 'slider' | 'toggle' | 'select' | 'button';
  key?: string;
  action?: string;
  label: string;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  group?: string;
  options?: readonly ControlOption[];
  disabledWhen?(model: M): boolean;
}

export interface FaultSpec {
  key: string;
  label: string;
  kind: 'severity' | 'toggle' | 'enum';
  description?: string;
  options?: readonly ControlOption[];
}

export interface FaultRepair {
  action: string;
  cost: number;
  minutes: number;
}

/**
 * Falla del catálogo del módulo (§26, P23 §4.6): id estable `<parte>.<falla>`
 * y la clave plana del modelo. `visibility`, `repair` y `symptoms` son datos
 * de juego (A3); el catálogo de A6 sólo trae lo que la física necesita.
 */
export interface FaultCatalogEntry {
  id: string;
  modelKey: string;
  part: string;
  kind: FaultSpec['kind'];
  healthy: ParamValue;
  label?: string;
  visibility?: 'always' | 'inspect' | 'never';
  repair?: FaultRepair;
  symptoms?: readonly string[];
}

export interface ReadoutSpec<S extends object = object> {
  id: string;
  label: string;
  unit: string;
  decimals?: number;
  get(state: Readonly<S>): number;
  gauge?: { min: number; max: number; green?: readonly [number, number] };
  history?: boolean;
}

export interface PartInfo {
  name: string;
  what: string;
  why: string;
  how: string;
  failures: readonly string[];
}

export interface Narration {
  level: 'info' | 'warn' | 'bad';
  text: string;
}

export interface Preset<M extends AnyModel = AnyModel> {
  id: string;
  label: string;
  params?: Partial<M['params']>;
  faults?: Partial<M['faults']>;
  /** Acciones a invocar: { actionName: args[] }. */
  setup?: Record<string, readonly unknown[]>;
  note?: string;
}

export interface ModuleDescriptor<M extends AnyModel = AnyModel> {
  id: string;
  title: string;
  summary: string;
  order: number;
  viewBox: readonly [number, number, number, number];
  createModel(): M;
  /** Legado (hasta A7); el renderer genérico no lo llama. */
  createView?(ctx: ViewContext<M>): View;
  /** (A7) Circuito que dibuja el renderer: layout, conexiones y topología. */
  circuit?: CircuitDef;
  /** (A7) Esquema de canales del presenter (lo evalúa `src/presenter/`). */
  present?: PresentScheme;
  defaultParams: Readonly<M['params']>;
  defaultFaults: Readonly<M['faults']>;
  controls: readonly ControlSpec<M>[];
  faults: readonly FaultSpec[];
  /** Catálogo §26 de fallas con su clave plana (lo usa el juego, A3). */
  faultCatalog?: readonly FaultCatalogEntry[];
  readouts: readonly ReadoutSpec<M['state']>[];
  parts: Readonly<Record<string, PartInfo>>;
  narrate(model: M): Narration[];
  presets?: readonly Preset<M>[];
}

/**
 * Único punto donde un descriptor concreto pasa a la lista genérica del registry.
 * @public — contrato de CONTRATOS.md 4.1, lo usa `modules/registry.ts` (TS4).
 */
export function defineModule<M extends AnyModel>(
  d: ModuleDescriptor<M>,
): ModuleDescriptor {
  return d;
}
