// Presenter genérico (A7): esquema del módulo + estado → VisualState
// (CONTRATOS 6.5). Puro (§1). Las funciones del esquema las define el módulo.

import type {
  FaultCatalogEntry,
  Model,
  PresentContext,
  PresentScheme,
  VisualState,
  VisualValue,
} from '../core/types.ts';

export interface PresentOptions {
  scheme: PresentScheme;
  catalog?: readonly FaultCatalogEntry[] | undefined;
  state: Readonly<Record<string, unknown>>;
  params: Readonly<Record<string, unknown>>;
  faults: Readonly<Record<string, unknown>>;
  /** Ids §26 (o claves planas, transición de A3) revelados por la `ModeUi`. */
  revealedFaults: readonly string[];
}

export interface PresentModelOptions {
  scheme: PresentScheme;
  catalog?: readonly FaultCatalogEntry[] | undefined;
  model: Model;
  revealedFaults: readonly string[];
}

/**
 * Fallas activas (distintas de la sana del catálogo) y visibles para la UI:
 * `visibility === 'always'` o reveladas por id §26 o por clave del modelo.
 */
export function visibleFaultSet(
  catalog: readonly FaultCatalogEntry[],
  faults: Readonly<Record<string, unknown>>,
  revealedFaults: readonly string[],
): Set<string> {
  const revealed = new Set(revealedFaults);
  const out = new Set<string>();
  for (const entry of catalog) {
    const value = faults[entry.modelKey];
    const active = value !== undefined && value !== entry.healthy;
    if (!active) continue;
    if (entry.visibility === 'always' || revealed.has(entry.id) || revealed.has(entry.modelKey)) {
      out.add(entry.id);
    }
  }
  return out;
}

function evaluate(
  fn: ((ctx: PresentContext) => VisualValue) | undefined,
  ctx: PresentContext,
): VisualValue {
  if (!fn) return 0;
  const value = fn(ctx);
  return typeof value === 'number' && !Number.isFinite(value) ? 0 : value;
}

/** Evalúa el esquema contra el estado actual y produce el VisualState. */
export function presentCircuit({
  scheme,
  catalog = [],
  state,
  params,
  faults,
  revealedFaults,
}: PresentOptions): VisualState {
  const visibleFaults = visibleFaultSet(catalog, faults, revealedFaults);
  const ctx: PresentContext = { state, params, faults, visibleFaults };

  const parts: Record<string, Record<string, VisualValue>> = {};
  for (const [partId, channels] of Object.entries(scheme.parts)) {
    const values: Record<string, VisualValue> = {};
    for (const [channel, fn] of Object.entries(channels)) values[channel] = evaluate(fn, ctx);
    parts[partId] = values;
  }

  const links: VisualState['links'] = {};
  for (const [linkId, channels] of Object.entries(scheme.links ?? {})) {
    links[linkId] = {
      flow: Number(evaluate(channels.flow, ctx)) || 0,
      potential: Number(evaluate(channels.potential, ctx)) || 0,
      air: Number(evaluate(channels.air, ctx)) || 0,
    };
  }

  const global: Record<string, VisualValue> = {};
  for (const [name, fn] of Object.entries(scheme.global ?? {})) global[name] = evaluate(fn, ctx);

  return { parts, links, global, faultCues: [...visibleFaults] };
}

/** Igual que `presentCircuit` pero partiendo de un `Model` (shell y tests). */
export function presentModel({
  scheme,
  catalog,
  model,
  revealedFaults,
}: PresentModelOptions): VisualState {
  return presentCircuit({
    scheme,
    catalog,
    state: widened(model.state),
    params: widened(model.params),
    faults: widened(model.faults),
    revealedFaults,
  });
}

/** El descriptor genérico borra el tipo del estado a `object` (§31, frontera). */
function widened(value: object): Readonly<Record<string, unknown>> {
  return value as Readonly<Record<string, unknown>>;
}
