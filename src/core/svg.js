// Helpers SVG. Colores sólo vía clases/variables CSS (§9).

import { clamp, lerp } from './math.js';

export const SVG_NS = 'http://www.w3.org/2000/svg';

/** Crea un elemento SVG, le pone atributos y opcionalmente lo cuelga de `parent`. */
export function el(tag, attrs = {}, parent = null) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'part') node.setAttribute('data-part', v);
    else if (k === 'text') node.textContent = String(v);
    else node.setAttribute(k, String(v));
  }
  if (parent) parent.appendChild(node);
  return node;
}

export const group = (parent, attrs = {}) => el('g', attrs, parent);

/**
 * Path `d` de una polilínea con esquinas redondeadas (radio máx. `r`).
 * @param {[number,number][]} points
 */
export function roundedPathD(points, r = 12) {
  if (points.length < 2) return '';
  let d = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 1; i < points.length - 1; i++) {
    const [px, py] = points[i - 1];
    const [cx, cy] = points[i];
    const [nx, ny] = points[i + 1];
    const lin = Math.hypot(cx - px, cy - py);
    const lout = Math.hypot(nx - cx, ny - cy);
    const rr = Math.min(r, lin / 2, lout / 2);
    const ax = cx + ((px - cx) / lin) * rr;
    const ay = cy + ((py - cy) / lin) * rr;
    const bx = cx + ((nx - cx) / lout) * rr;
    const by = cy + ((ny - cy) / lout) * rr;
    d += ` L ${ax} ${ay} Q ${cx} ${cy} ${bx} ${by}`;
  }
  const [lx, ly] = points[points.length - 1];
  return d + ` L ${lx} ${ly}`;
}

/**
 * Tubería: pared exterior + interior de fluido. `path` (el interior) sirve para createFlow.
 * @returns {{ g: SVGGElement, outer: SVGPathElement, inner: SVGPathElement, path: SVGPathElement }}
 */
export function pipe(parent, points, { width = 10, radius = 14, className = 'fluid-fuel', part } = {}) {
  const d = roundedPathD(points, radius);
  const g = group(parent, { class: 'pipe', part });
  const outer = el('path', { d, class: 'pipe-wall', 'stroke-width': width + 5, fill: 'none' }, g);
  const inner = el('path', { d, class: `pipe-fluid ${className}`, 'stroke-width': width, fill: 'none' }, g);
  return { g, outer, inner, path: inner };
}

/** Caja rotulada (pieza genérica). */
export function box(parent, { x, y, w, h, r = 8, label: text, part, className = 'part' }) {
  const g = group(parent, { class: className, part });
  const rect = el('rect', { x, y, width: w, height: h, rx: r, class: 'part-body' }, g);
  let lbl = null;
  if (text) lbl = label(g, x + w / 2, y + h / 2, text, { anchor: 'middle', baseline: 'central' });
  return { g, rect, label: lbl };
}

export function label(parent, x, y, text, { anchor = 'start', baseline = 'auto', className = 'lbl', size } = {}) {
  return el(
    'text',
    { x, y, 'text-anchor': anchor, 'dominant-baseline': baseline, class: className, 'font-size': size, text },
    parent,
  );
}

/** Define marcadores de flecha reutilizables: url(#arrow). */
export function arrowMarkers(svg) {
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
export function gaugeAngle(v, min, max) {
  return lerp(-GAUGE_SWEEP / 2, GAUGE_SWEEP / 2, clamp((v - min) / (max - min || 1), 0, 1));
}

function polar(cx, cy, r, deg) {
  const a = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

function arcD(cx, cy, r, a0, a1) {
  const [x0, y0] = polar(cx, cy, r, a0);
  const [x1, y1] = polar(cx, cy, r, a1);
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
  return `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`;
}

/**
 * Manómetro circular con aguja.
 * @returns {{ g: SVGGElement, setValue: (v:number)=>void }}
 */
export function gaugeSvg(parent, { cx, cy, r = 40, min = 0, max = 10, green, unit = '', ticks = 5, part }) {
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
  let lastA = null;
  return {
    g,
    setValue(v) {
      const a = gaugeAngle(v, min, max);
      if (lastA !== null && Math.abs(a - lastA) < 0.05) return;
      lastA = a;
      needle.setAttribute('transform', `rotate(${a} ${cx} ${cy})`);
    },
  };
}
