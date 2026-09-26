// Layout de un circuito (plan V1): puntas de cada enlace desde la geometría
// de los drawers, chequeo de conexiones y hoja de layout. Puro (sin DOM): lo
// usan el renderer, `tests/render/layout.test.ts` y `npm run layout`.

import type { Point } from '../../core/svg.ts';
import type { CircuitDef, CircuitLinkDef, CircuitPartDef } from '../../sim/circuit/types.ts';
import { DRAWERS } from './drawers/index.ts';
import type { PartGeometry, Rect, SubGeometry } from './types.ts';

export type ViewBox = readonly [number, number, number, number];

export interface LayoutIssue {
  level: 'error' | 'warn';
  code: string;
  message: string;
  at?: Point;
}

export interface PlacedPart {
  part: CircuitPartDef;
  geo: PartGeometry;
}

export interface PlacedLink {
  link: CircuitLinkDef;
  /** `[puerto from, ...via, puerto to]`; `null` si una punta no se resolvió. */
  points: Point[] | null;
}

export interface Layout {
  parts: ReadonlyMap<string, PlacedPart>;
  /** Sub-piezas (dibujadas por otro drawer) → id de la pieza que las dibuja. */
  subOwner: ReadonlyMap<string, string>;
  links: readonly PlacedLink[];
  /** Nudos (`joint` + `multiple`) con la cantidad de enlaces dibujados. */
  nodes: ReadonlyMap<string, { at: Point; degree: number }>;
  issues: LayoutIssue[];
}

/** Tolerancia (px) para que dos cajas "se toquen" (`joinedBy`). */
const TOUCH = 10;

/** Tipos nudo (`joint` + `multiple` en `ELEMENT_TYPES`; el render no importa
 *  `sim/elements`, §22: un test fija que la lista coincida). */
export const NODE_TYPES: ReadonlySet<string> = new Set(['tee', 'junction', 'hydroNode', 'thermalNode']);

export function isNodeType(type: string): boolean {
  return NODE_TYPES.has(type);
}

/** Tramos consecutivos de una polilínea. */
function segments(points: readonly Point[]): [Point, Point][] {
  const out: [Point, Point][] = [];
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i];
    const b = points[i + 1];
    if (a && b) out.push([a, b]);
  }
  return out;
}

function splitEndpoint(endpoint: string): [string, string] {
  const dot = endpoint.indexOf('.');
  return dot < 0 ? [endpoint, ''] : [endpoint.slice(0, dot), endpoint.slice(dot + 1)];
}

function subOf(layout: { parts: ReadonlyMap<string, PlacedPart> }, owner: string, id: string): SubGeometry | undefined {
  return layout.parts.get(owner)?.geo.subparts?.[id];
}

/** Resuelve la geometría de cada pieza y las puntas de los enlaces dibujados. */
export function resolveLayout(def: CircuitDef): Layout {
  const issues: LayoutIssue[] = [];
  const parts = new Map<string, PlacedPart>();
  const subOwner = new Map<string, string>();
  const byId = new Map(def.parts.map((p) => [p.id, p]));

  for (const part of def.parts) {
    const entry = DRAWERS[part.visual ?? part.type];
    if (!entry) {
      if (part.visual !== undefined) {
        issues.push({ level: 'error', code: 'visual-sin-drawer', message: `${part.id}: el visual '${part.visual}' no está en el catálogo` });
      }
      continue;
    }
    const geo = entry.geometry(part, def);
    parts.set(part.id, { part, geo });
    for (const sub of Object.keys(geo.subparts ?? {})) subOwner.set(sub, part.id);
  }

  const nodes = new Map<string, { at: Point; degree: number }>();
  for (const part of def.parts) {
    if (isNodeType(part.type) && !parts.has(part.id)) nodes.set(part.id, { at: [part.x, part.y], degree: 0 });
  }

  function anchor(endpoint: string, linkId: string): Point | null {
    const [id, port] = splitEndpoint(endpoint);
    const placed = parts.get(id);
    if (placed) {
      const at = placed.geo.ports?.[port];
      if (!at) issues.push({ level: 'error', code: 'puerto-inexistente', message: `${linkId}: '${endpoint}' no está en la geometría de '${placed.part.visual ?? placed.part.type}'` });
      return at ?? null;
    }
    const owner = subOwner.get(id);
    if (owner !== undefined) {
      const at = subOf({ parts }, owner, id)?.ports?.[port];
      if (!at) issues.push({ level: 'error', code: 'puerto-inexistente', message: `${linkId}: '${endpoint}' no está en la sub-pieza de '${owner}'` });
      return at ?? null;
    }
    const node = nodes.get(id);
    if (node) return node.at;
    const known = byId.has(id) ? 'no se dibuja (ni sub-pieza ni nudo)' : 'no existe';
    issues.push({ level: 'error', code: 'extremo-sin-pieza', message: `${linkId}: la punta '${endpoint}' ${known}` });
    return null;
  }

  const links: PlacedLink[] = [];
  for (const link of def.links) {
    if (!link.visual) continue;
    const a = anchor(link.from, link.id);
    const b = anchor(link.to, link.id);
    for (const end of [link.from, link.to]) {
      const node = nodes.get(splitEndpoint(end)[0]);
      if (node) node.degree++;
    }
    links.push({ link, points: a && b ? [a, ...(link.via ?? []), b] : null });
  }
  return { parts, subOwner, links, nodes, issues };
}

// ---------------------------------------------------------------- geometría

const inside = (r: Rect, s: Rect): boolean =>
  s.x >= r.x - 0.5 && s.y >= r.y - 0.5 && s.x + s.w <= r.x + r.w + 0.5 && s.y + s.h <= r.y + r.h + 0.5;

const overlaps = (a: Rect, b: Rect, pad = 0): boolean =>
  a.x < b.x + b.w + pad && b.x < a.x + a.w + pad && a.y < b.y + b.h + pad && b.y < a.y + a.h + pad;

const hasArea = (r: Rect): boolean => r.w > 0.5 && r.h > 0.5;

/** ¿El tramo recto a→b entra al interior de `r` (encogido 1 px)? */
function segmentEnters(a: Point, b: Point, r: Rect): boolean {
  if (!hasArea(r)) return false;
  const x0 = r.x + 1;
  const y0 = r.y + 1;
  const x1 = r.x + r.w - 1;
  const y1 = r.y + r.h - 1;
  const [ax, ay] = a;
  const [bx, by] = b;
  if (Math.abs(ay - by) < 0.5) {
    return ay > y0 && ay < y1 && Math.max(Math.min(ax, bx), x0) < Math.min(Math.max(ax, bx), x1);
  }
  if (Math.abs(ax - bx) < 0.5) {
    return ax > x0 && ax < x1 && Math.max(Math.min(ay, by), y0) < Math.min(Math.max(ay, by), y1);
  }
  return false;
}

/** Largo de la parte común de dos tramos colineales (0 si no lo son). */
function collinearOverlap(a0: Point, a1: Point, b0: Point, b1: Point): number {
  const horizontal = (p: Point, q: Point): boolean => Math.abs(p[1] - q[1]) < 0.5;
  const vertical = (p: Point, q: Point): boolean => Math.abs(p[0] - q[0]) < 0.5;
  if (horizontal(a0, a1) && horizontal(b0, b1) && Math.abs(a0[1] - b0[1]) < 2) {
    return Math.min(Math.max(a0[0], a1[0]), Math.max(b0[0], b1[0])) - Math.max(Math.min(a0[0], a1[0]), Math.min(b0[0], b1[0]));
  }
  if (vertical(a0, a1) && vertical(b0, b1) && Math.abs(a0[0] - b0[0]) < 2) {
    return Math.min(Math.max(a0[1], a1[1]), Math.max(b0[1], b1[1])) - Math.max(Math.min(a0[1], a1[1]), Math.min(b0[1], b1[1]));
  }
  return 0;
}

// ---------------------------------------------------------------- chequeo

/** Todas las leyes de conexión del plan V1 §2.4 sobre un circuito. */
export function checkLayout(def: CircuitDef, viewBox: ViewBox): LayoutIssue[] {
  const layout = resolveLayout(def);
  const issues = [...layout.issues];
  const { parts, subOwner, links, nodes } = layout;
  const error = (code: string, message: string, at?: Point): void => {
    issues.push({ level: 'error', code, message, ...(at ? { at } : {}) });
  };

  const byId = new Map(def.parts.map((p) => [p.id, p]));
  const joined = (a: string, b: string): boolean =>
    byId.get(a)?.joinedBy === b || byId.get(b)?.joinedBy === a;

  // Caja de una pieza, sea propia o sub-pieza.
  const boxOf = (id: string): Rect | undefined => {
    const own = parts.get(id);
    if (own) return own.geo.box;
    const owner = subOwner.get(id);
    return owner === undefined ? undefined : subOf(layout, owner, id)?.box;
  };

  // Obstáculos: cajas propias (salvo inline) y de sub-piezas.
  interface Obstacle { id: string; box: Rect; owner?: string; container: boolean }
  const obstacles: Obstacle[] = [];
  for (const [id, placed] of parts) {
    if (!placed.geo.inline) obstacles.push({ id, box: placed.geo.box, container: placed.geo.container === true });
    for (const [sub, g] of Object.entries(placed.geo.subparts ?? {})) {
      obstacles.push({ id: sub, box: g.box, owner: id, container: false });
    }
  }

  // Lienzo.
  const [vx, vy, vw, vh] = viewBox;
  const canvas: Rect = { x: vx, y: vy, w: vw, h: vh };
  for (const o of obstacles) {
    if (hasArea(o.box) && !inside(canvas, o.box)) error('fuera-del-lienzo', `${o.id}: su caja sale del viewBox`, [o.box.x, o.box.y]);
  }

  for (const { link, points } of links) {
    if (!points) continue;
    const ends = [link.from, link.to].map((e) => splitEndpoint(e)[0]);
    const endBoxes = ends.map(boxOf).filter((b): b is Rect => b !== undefined);
    for (const p of points) {
      if (!inside(canvas, { x: p[0], y: p[1], w: 0, h: 0 })) error('fuera-del-lienzo', `${link.id}: un punto sale del viewBox`, p);
    }
    for (const [i, [a, b]] of segments(points).entries()) {
      if (Math.abs(a[0] - b[0]) >= 0.5 && Math.abs(a[1] - b[1]) >= 0.5) {
        error('tramo-diagonal', `${link.id}: el tramo ${i + 1} (${a.join(',')} → ${b.join(',')}) no es horizontal ni vertical`, a);
        continue;
      }
      for (const o of obstacles) {
        // Se puede andar dentro de la pieza que aloja a una punta (estanque,
        // ventilador con su relé) o que dibuja la sub-pieza de una punta.
        if (ends.some((id) => subOwner.get(id) === o.id)) continue;
        if (o.container && endBoxes.some((eb) => inside(o.box, eb) && eb !== o.box)) continue;
        if (segmentEnters(a, b, o.box)) {
          error('tubo-cruza-pieza', `${link.id}: el tramo ${a.join(',')} → ${b.join(',')} pasa por dentro de '${o.id}'`, a);
        }
      }
    }
  }

  // Tubos encimados: permitidos sólo si los dos enlaces llegan al mismo nudo.
  links.forEach((A, i) => {
    for (const B of links.slice(i + 1)) {
      if (!A.points || !B.points) continue;
      const nodesA = new Set([A.link.from, A.link.to].map((e) => splitEndpoint(e)[0]).filter((id) => nodes.has(id)));
      if ([B.link.from, B.link.to].some((e) => nodesA.has(splitEndpoint(e)[0]))) continue;
      const segsB = segments(B.points);
      const hit = segments(A.points).find(([a0, a1]) => segsB.some(([b0, b1]) => collinearOverlap(a0, a1, b0, b1) > 2));
      if (hit) error('tubos-encimados', `${A.link.id} y ${B.link.id} corren uno sobre otro`, hit[0]);
    }
  });

  // Nudos colgando.
  for (const [id, node] of nodes) {
    if (node.degree !== 1) continue;
    const target = byId.get(id)?.joinedBy;
    const box = target === undefined ? undefined : boxOf(target);
    const at: Rect = { x: node.at[0], y: node.at[1], w: 0, h: 0 };
    if (box && overlaps(box, at, TOUCH)) continue;
    error('nudo-colgando', `${id}: el nudo tiene un solo enlace dibujado (la manguera termina en el aire)`, node.at);
  }

  // Piezas aisladas: de red, dibujadas y sin ningún enlace dibujado.
  const touched = new Set<string>();
  for (const { link } of links) for (const e of [link.from, link.to]) touched.add(splitEndpoint(e)[0]);
  const joinTargets = new Set(def.parts.map((p) => p.joinedBy).filter((j): j is string => j !== undefined));
  const drawnIds = [...parts.keys(), ...subOwner.keys()];
  for (const id of drawnIds) {
    const part = byId.get(id);
    if (!part || part.type === 'visual' || isNodeType(part.type)) continue;
    if (touched.has(id) || part.joinedBy !== undefined || joinTargets.has(id)) continue;
    const box = boxOf(id);
    error('pieza-aislada', `${id}: se dibuja pero ningún tubo ni cable llega a ella`, box ? [box.x, box.y] : undefined);
  }

  // Cajas solapadas (piezas propias entre sí y sub-piezas contra otras).
  obstacles.forEach((a, i) => {
    for (const b of obstacles.slice(i + 1)) {
      if (a.container || b.container) continue;
      if (a.owner !== undefined && b.owner !== undefined) continue;
      if (a.owner === b.id || b.owner === a.id) continue;
      const ida = a.owner ?? a.id;
      const idb = b.owner ?? b.id;
      if (ida === idb || joined(ida, idb) || joined(a.id, b.id)) continue;
      if (hasArea(a.box) && hasArea(b.box) && overlaps(a.box, b.box, -1)) {
        error('piezas-solapadas', `'${a.id}' y '${b.id}' se pisan`, [Math.max(a.box.x, b.box.x), Math.max(a.box.y, b.box.y)]);
      }
    }
  });

  // joinedBy: las cajas tienen que tocarse.
  for (const part of def.parts) {
    if (part.joinedBy === undefined) continue;
    const box = isNodeType(part.type) ? { x: part.x, y: part.y, w: 0, h: 0 } : boxOf(part.id);
    const other = boxOf(part.joinedBy);
    if (!box || !other || !overlaps(box, other, TOUCH)) {
      error('union-lejana', `${part.id}: joinedBy '${part.joinedBy}' pero sus cajas no se tocan`, [part.x, part.y]);
    }
  }
  return issues;
}

// ---------------------------------------------------------------- hoja

const PIPE_COLOR: Readonly<Record<string, string>> = {
  'fluid-fuel': '#d97706',
  'fluid-coolant': '#14a39a',
  'fluid-oil': '#a16207',
  'fluid-electric': '#2563eb',
  'fluid-vacuum': '#7c3aed',
};

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Hoja de layout estática (plan V1 §2.5): cajas, puertos, tubos y problemas. */
export function renderLayoutSheet(def: CircuitDef, viewBox: ViewBox, issues: readonly LayoutIssue[]): string {
  const layout = resolveLayout(def);
  const [vx, vy, vw, vh] = viewBox;
  const listH = 18 * (issues.length + 2);
  const out: string[] = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx} ${vy} ${vw} ${vh + listH}" width="${vw}" height="${vh + listH}" font-family="monospace">`);
  out.push(`<rect x="${vx}" y="${vy}" width="${vw}" height="${vh + listH}" fill="#fff"/>`);
  for (let x = Math.ceil(vx / 50) * 50; x <= vx + vw; x += 50) {
    out.push(`<line x1="${x}" y1="${vy}" x2="${x}" y2="${vy + vh}" stroke="${x % 100 ? '#f3f3f3' : '#e2e2e2'}"/>`);
    if (x % 100 === 0) out.push(`<text x="${x + 2}" y="${vy + 10}" font-size="9" fill="#999">${x}</text>`);
  }
  for (let y = Math.ceil(vy / 50) * 50; y <= vy + vh; y += 50) {
    out.push(`<line x1="${vx}" y1="${y}" x2="${vx + vw}" y2="${y}" stroke="${y % 100 ? '#f3f3f3' : '#e2e2e2'}"/>`);
    if (y % 100 === 0) out.push(`<text x="${vx + 2}" y="${y - 2}" font-size="9" fill="#999">${y}</text>`);
  }
  out.push(`<rect x="${vx}" y="${vy}" width="${vw}" height="${vh}" fill="none" stroke="#999"/>`);
  const boxSvg = (r: Rect, style: string): string =>
    `<rect x="${r.x}" y="${r.y}" width="${Math.max(r.w, 1)}" height="${Math.max(r.h, 1)}" ${style}/>`;
  const portSvg = (name: string, p: Point): string =>
    `<circle cx="${p[0]}" cy="${p[1]}" r="3" fill="#111"/><text x="${p[0] + 4}" y="${p[1] - 4}" font-size="9" fill="#111">${esc(name)} ${Math.round(p[0])},${Math.round(p[1])}</text>`;
  for (const [id, { geo }] of layout.parts) {
    const style = geo.container ? 'fill="#f7f7f7" stroke="#888" stroke-dasharray="6 4"' : 'fill="#eef2f7" stroke="#445"';
    out.push(boxSvg(geo.box, style));
    out.push(`<text x="${geo.box.x + 3}" y="${geo.box.y + 12}" font-size="11" font-weight="bold" fill="#223">${esc(id)}</text>`);
    for (const [sub, g] of Object.entries(geo.subparts ?? {})) {
      out.push(boxSvg(g.box, 'fill="#fff7e0" stroke="#b08000" stroke-dasharray="3 2"'));
      out.push(`<text x="${g.box.x + 2}" y="${g.box.y + 10}" font-size="9" fill="#805000">${esc(sub)}</text>`);
      for (const [name, p] of Object.entries(g.ports ?? {})) out.push(portSvg(`${sub}.${name}`, p));
    }
    for (const [name, p] of Object.entries(geo.ports ?? {})) out.push(portSvg(name, p));
  }
  for (const { link, points } of layout.links) {
    if (!points) continue;
    const color = PIPE_COLOR[link.visual?.pipeClass ?? ''] ?? '#555';
    out.push(`<polyline points="${points.map((p) => p.join(',')).join(' ')}" fill="none" stroke="${color}" stroke-width="4" stroke-opacity="0.75"/>`);
  }
  for (const [id, node] of layout.nodes) {
    if (node.degree === 0) continue;
    out.push(`<circle cx="${node.at[0]}" cy="${node.at[1]}" r="4" fill="${node.degree >= 3 ? '#000' : '#fff'}" stroke="#000"/>`);
    out.push(`<text x="${node.at[0] + 5}" y="${node.at[1] + 12}" font-size="9" fill="#555">${esc(id)}</text>`);
  }
  for (const issue of issues) {
    if (issue.at) out.push(`<circle cx="${issue.at[0]}" cy="${issue.at[1]}" r="9" fill="none" stroke="#dc2626" stroke-width="2.5"/>`);
  }
  out.push(`<text x="${vx + 8}" y="${vy + vh + 16}" font-size="12" font-weight="bold">${esc(def.id)} — ${issues.length} problema(s)</text>`);
  issues.forEach((issue, i) => {
    out.push(`<text x="${vx + 8}" y="${vy + vh + 34 + i * 18}" font-size="11" fill="${issue.level === 'error' ? '#dc2626' : '#b45309'}">[${issue.code}] ${esc(issue.message)}</text>`);
  });
  out.push('</svg>');
  return out.join('\n');
}
