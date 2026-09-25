// Helpers SVG. Colores sólo vía clases/variables CSS (§9).

import { clamp, lerp } from './math.ts';

export const SVG_NS = 'http://www.w3.org/2000/svg';

export type SvgAttrs = Record<string, string | number | boolean | null | undefined>;
export type Point = readonly [number, number];

/** Crea un elemento SVG, le pone atributos y opcionalmente lo cuelga de `parent`. */
export function el<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: SvgAttrs = {},
  parent: SVGElement | null = null,
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'part') node.setAttribute('data-part', String(v));
    else if (k === 'text') node.textContent = String(v);
    else node.setAttribute(k, String(v));
  }
  if (parent) parent.appendChild(node);
  return node;
}

export const group = (parent: SVGElement, attrs: SvgAttrs = {}): SVGGElement =>
  el('g', attrs, parent);

/**
 * Path `d` de una polilínea con esquinas redondeadas (radio máx. `r`).
 */
export function roundedPathD(points: readonly Point[], r = 12): string {
  const first = points[0];
  if (points.length < 2 || !first) return '';
  let d = `M ${first[0]} ${first[1]}`;
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const cur = points[i];
    const next = points[i + 1];
    if (!prev || !cur || !next) continue;
    const lin = Math.hypot(cur[0] - prev[0], cur[1] - prev[1]);
    const lout = Math.hypot(next[0] - cur[0], next[1] - cur[1]);
    const rr = Math.min(r, lin / 2, lout / 2);
    const ax = cur[0] + ((prev[0] - cur[0]) / lin) * rr;
    const ay = cur[1] + ((prev[1] - cur[1]) / lin) * rr;
    const bx = cur[0] + ((next[0] - cur[0]) / lout) * rr;
    const by = cur[1] + ((next[1] - cur[1]) / lout) * rr;
    d += ` L ${ax} ${ay} Q ${cur[0]} ${cur[1]} ${bx} ${by}`;
  }
  const last = points[points.length - 1];
  if (!last) return d;
  return d + ` L ${last[0]} ${last[1]}`;
}

export interface PipeOptions {
  width?: number;
  radius?: number;
  className?: string;
  part?: string;
}

export interface PipeParts {
  g: SVGGElement;
  outer: SVGPathElement;
  inner: SVGPathElement;
  /** El interior: sirve para `createFlow`. */
  path: SVGPathElement;
}

/** Tubería: pared exterior + interior de fluido. */
export function pipe(
  parent: SVGElement,
  points: readonly Point[],
  { width = 10, radius = 14, className = 'fluid-fuel', part }: PipeOptions = {},
): PipeParts {
  const d = roundedPathD(points, radius);
  const g = group(parent, { class: 'pipe', part });
  const outer = el('path', { d, class: 'pipe-wall', 'stroke-width': width + 5, fill: 'none' }, g);
  const inner = el('path', { d, class: `pipe-fluid ${className}`, 'stroke-width': width, fill: 'none' }, g);
  return { g, outer, inner, path: inner };
}

export interface BoxOptions {
  x: number;
  y: number;
  w: number;
  h: number;
  r?: number;
  label?: string;
  part?: string;
  className?: string;
}

export interface BoxParts {
  g: SVGGElement;
  rect: SVGRectElement;
  label: SVGTextElement | null;
}

/**
 * Caja rotulada (pieza genérica).
 * @public — contrato 4.7 de CONTRATOS.md, para los drawers de A7.
 */
export function box(
  parent: SVGElement,
  { x, y, w, h, r = 8, label: text, part, className = 'part' }: BoxOptions,
): BoxParts {
  const g = group(parent, { class: className, part });
  const rect = el('rect', { x, y, width: w, height: h, rx: r, class: 'part-body' }, g);
  let lbl: SVGTextElement | null = null;
  if (text) lbl = label(g, x + w / 2, y + h / 2, text, { anchor: 'middle', baseline: 'central' });
  return { g, rect, label: lbl };
}

export interface LabelOptions {
  anchor?: string;
  baseline?: string;
  className?: string;
  size?: number | string;
}

export function label(
  parent: SVGElement,
  x: number,
  y: number,
  text: string,
  { anchor = 'start', baseline = 'auto', className = 'lbl', size }: LabelOptions = {},
): SVGTextElement {
  return el(
    'text',
    { x, y, 'text-anchor': anchor, 'dominant-baseline': baseline, class: className, 'font-size': size, text },
    parent,
  );
}

/** Define marcadores de flecha reutilizables: url(#arrow). */
export function arrowMarkers(svg: SVGSVGElement): SVGDefsElement {
  const defs = el('defs', {}, svg);
  const m = el(
    'marker',
    { id: 'arrow', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' },
    defs,
  );
  el('path', { d: 'M 0 0 L 10 5 L 0 10 z', class: 'arrow-head' }, m);
  return defs;
}

const GAUGE_SWEEP = 240; // grados de recorrido de la aguja

/** Ángulo de la aguja (grados, 0 = arriba) para un valor. Puro, testeable. */
export function gaugeAngle(v: number, min: number, max: number): number {
  return lerp(-GAUGE_SWEEP / 2, GAUGE_SWEEP / 2, clamp((v - min) / (max - min || 1), 0, 1));
}

function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const a = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

function arcD(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const [x0, y0] = polar(cx, cy, r, a0);
  const [x1, y1] = polar(cx, cy, r, a1);
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
  return `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`;
}

export interface GaugeOptions {
  cx: number;
  cy: number;
  r?: number;
  min?: number;
  max?: number;
  green?: readonly [number, number];
  unit?: string;
  ticks?: number;
  part?: string;
}

export interface Gauge {
  g: SVGGElement;
  setValue(v: number): void;
}

/** Manómetro circular con aguja. */
export function gaugeSvg(
  parent: SVGElement,
  { cx, cy, r = 40, min = 0, max = 10, green, unit = '', ticks = 5, part }: GaugeOptions,
): Gauge {
  const g = group(parent, { class: 'gauge', part });
  el('circle', { cx, cy, r, class: 'gauge-face' }, g);
  el('path', { d: arcD(cx, cy, r * 0.82, -GAUGE_SWEEP / 2, GAUGE_SWEEP / 2), class: 'gauge-track', fill: 'none' }, g);
  if (green) {
    const a0 = gaugeAngle(green[0], min, max);
    const a1 = gaugeAngle(green[1], min, max);
    el('path', { d: arcD(cx, cy, r * 0.82, a0, a1), class: 'gauge-green', fill: 'none' }, g);
  }
  for (let i = 0; i <= ticks; i++) {
    const v = min + ((max - min) * i) / ticks;
    const a = gaugeAngle(v, min, max);
    const [x0, y0] = polar(cx, cy, r * 0.7, a);
    const [x1, y1] = polar(cx, cy, r * 0.9, a);
    el('line', { x1: x0, y1: y0, x2: x1, y2: y1, class: 'gauge-tick' }, g);
    const [tx, ty] = polar(cx, cy, r * 0.52, a);
    label(g, tx, ty, String(Math.round(v * 10) / 10), { anchor: 'middle', baseline: 'central', className: 'gauge-num' });
  }
  if (unit) label(g, cx, cy + r * 0.55, unit, { anchor: 'middle', baseline: 'central', className: 'gauge-unit' });
  const needle = el('line', { x1: cx, y1: cy, x2: cx, y2: cy - r * 0.8, class: 'gauge-needle' }, g);
  el('circle', { cx, cy, r: r * 0.08, class: 'gauge-hub' }, g);
  let lastA: number | null = null;
  return {
    g,
    setValue(v): void {
      const a = gaugeAngle(v, min, max);
      if (lastA !== null && Math.abs(a - lastA) < 0.05) return;
      lastA = a;
      needle.setAttribute('transform', `rotate(${a} ${cx} ${cy})`);
    },
  };
}
