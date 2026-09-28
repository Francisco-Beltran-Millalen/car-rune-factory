// Traduce el `PresentScheme` de un sistema (claves sin prefijo, como las usa
// su propio laboratorio) al del vehículo (A15, plan §4 paso 6 y §9): mismas
// funciones, pero evaluadas contra una vista de `state`/`params`/`faults`
// sin el prefijo de este sistema, y publicadas bajo claves `sistema:pieza`.

import type { PresentContext, PresentFn, PresentScheme, VisualValue } from '../../core/types.ts';

function scopedRecord(all: Readonly<Record<string, unknown>>, prefix: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const withColon = `${prefix}:`;
  for (const [key, value] of Object.entries(all)) {
    if (key.startsWith(withColon)) out[key.slice(withColon.length)] = value;
  }
  return out;
}

function scopedVisibleFaults(all: ReadonlySet<string>, prefix: string): Set<string> {
  const out = new Set<string>();
  const withColon = `${prefix}:`;
  for (const id of all) if (id.startsWith(withColon)) out.add(id.slice(withColon.length));
  return out;
}

function wrap(fn: PresentFn, prefix: string): PresentFn {
  return (ctx: PresentContext): VisualValue =>
    fn({
      state: scopedRecord(ctx.state, prefix),
      params: scopedRecord(ctx.params, prefix),
      faults: scopedRecord(ctx.faults, prefix),
      visibleFaults: scopedVisibleFaults(ctx.visibleFaults, prefix),
    });
}

export function scopePresentScheme(scheme: PresentScheme, prefix: string): PresentScheme {
  const parts: Record<string, Record<string, PresentFn>> = {};
  for (const [partId, channels] of Object.entries(scheme.parts)) {
    const wrapped: Record<string, PresentFn> = {};
    for (const [channel, fn] of Object.entries(channels)) wrapped[channel] = wrap(fn, prefix);
    parts[`${prefix}:${partId}`] = wrapped;
  }
  const links: Record<string, { flow?: PresentFn; potential?: PresentFn; air?: PresentFn }> = {};
  for (const [linkId, channels] of Object.entries(scheme.links ?? {})) {
    links[`${prefix}:${linkId}`] = {
      ...(channels.flow ? { flow: wrap(channels.flow, prefix) } : {}),
      ...(channels.potential ? { potential: wrap(channels.potential, prefix) } : {}),
      ...(channels.air ? { air: wrap(channels.air, prefix) } : {}),
    };
  }
  const global: Record<string, PresentFn> = {};
  for (const [key, fn] of Object.entries(scheme.global ?? {})) global[`${prefix}:${key}`] = wrap(fn, prefix);
  return { parts, links, global };
}

export function mergePresentSchemes(schemes: readonly PresentScheme[]): PresentScheme {
  const parts: PresentScheme['parts'] = {};
  const links: NonNullable<PresentScheme['links']> = {};
  const global: NonNullable<PresentScheme['global']> = {};
  for (const scheme of schemes) {
    Object.assign(parts, scheme.parts);
    Object.assign(links, scheme.links ?? {});
    Object.assign(global, scheme.global ?? {});
  }
  return { parts, links, global };
}
