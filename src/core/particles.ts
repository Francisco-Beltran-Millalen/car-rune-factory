// Partículas que recorren un path SVG. Velocidad ∝ caudal (CONTRATOS.md 4.6).

import { wrap } from './math.ts';
import { el } from './svg.ts';

/**
 * Escala visual por defecto: 100 L/h → 250 px/s.
 * @public — convención de CONTRATOS.md 4.6; cada módulo puede cambiarla.
 */
export const PX_PER_LH = 2.5;

/** Hash determinista de un índice a [0, 1): decide qué partículas se ocultan o son aire. */
export function hash01(i: number): number {
  let x = (i + 1) * 2654435761;
  x = (x ^ (x >>> 16)) >>> 0;
  x = Math.imul(x, 0x45d9f3b) >>> 0;
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

/** Distancias a lo largo del path de cada partícula. Puro, testeable. */
export function particleOffsets(count: number, spacing: number, phase: number): number[] {
  const out = new Array<number>(count);
  for (let i = 0; i < count; i++) out[i] = i * spacing + phase;
  return out;
}

interface PathTable {
  len: number;
  step: number;
  xs: Float32Array;
  ys: Float32Array;
  n: number;
}

/** Tabla de puntos del path cada `step` px, para no llamar getPointAtLength por frame. */
function samplePath(path: SVGPathElement, step = 2): PathTable {
  const len = path.getTotalLength();
  const n = Math.max(2, Math.ceil(len / step) + 1);
  const xs = new Float32Array(n);
  const ys = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const p = path.getPointAtLength(Math.min(len, i * step));
    xs[i] = p.x;
    ys[i] = p.y;
  }
  return { len, step, xs, ys, n };
}

function pointAt(t: PathTable, s: number): [number, number] {
  const f = Math.min(s / t.step, t.n - 1.001);
  const i = Math.floor(f);
  const k = f - i;
  const x0 = t.xs[i] ?? 0;
  const y0 = t.ys[i] ?? 0;
  const x1 = t.xs[i + 1] ?? x0;
  const y1 = t.ys[i + 1] ?? y0;
  return [x0 + (x1 - x0) * k, y0 + (y1 - y0) * k];
}

export interface FlowOptions {
  path: SVGPathElement;
  layer: SVGGElement;
  spacing?: number;
  radius?: number;
  className?: string;
}

export interface Flow {
  setSpeed(pxPerSec: number): void;
  setStyle(className: string): void;
  setDensity(d: number): void;
  /** Fracción 0..1 de partículas dibujadas como burbujas de aire. */
  setAir(f: number): void;
  update(dt: number): void;
  destroy(): void;
}

export function createFlow({
  path,
  layer,
  spacing = 14,
  radius = 3,
  className = 'p-fuel',
}: FlowOptions): Flow {
  const table = samplePath(path);
  const count = Math.max(1, Math.floor(table.len / spacing));
  const dots: SVGCircleElement[] = [];
  for (let i = 0; i < count; i++) {
    dots.push(el('circle', { r: radius, class: `particle ${className}` }, layer));
  }
  let speed = 0;
  let phase = hash01(count) * spacing;
  let density = 1;
  let airFraction = 0;
  let baseClass = className;
  let dirty = true;

  function restyle(): void {
    for (let i = 0; i < count; i++) {
      const dot = dots[i];
      if (!dot) continue;
      const h = hash01(i);
      const visible = h < density;
      const air = hash01(i + 7919) < airFraction;
      dot.setAttribute('class', `particle ${air ? 'p-air' : baseClass}`);
      dot.style.display = visible ? '' : 'none';
    }
    dirty = false;
  }

  return {
    setSpeed(pxPerSec): void {
      speed = Number.isFinite(pxPerSec) ? pxPerSec : 0;
    },
    setStyle(cls): void {
      if (cls !== baseClass) {
        baseClass = cls;
        dirty = true;
      }
    },
    setDensity(d): void {
      const v = Math.round(Math.max(0, Math.min(1, d)) * 20) / 20;
      if (v !== density) {
        density = v;
        dirty = true;
      }
    },
    setAir(f): void {
      const v = Math.round(Math.max(0, Math.min(1, f)) * 20) / 20;
      if (v !== airFraction) {
        airFraction = v;
        dirty = true;
      }
    },
    update(dt): void {
      if (dirty) restyle();
      phase = wrap(phase + speed * dt, spacing);
      const offs = particleOffsets(count, spacing, phase);
      for (let i = 0; i < count; i++) {
        const dot = dots[i];
        if (!dot) continue;
        const s = offs[i] ?? 0;
        const [x, y] = pointAt(table, Math.min(s, table.len));
        dot.setAttribute('cx', x.toFixed(1));
        dot.setAttribute('cy', y.toFixed(1));
      }
    },
    destroy(): void {
      for (const d of dots) d.remove();
      dots.length = 0;
    },
  };
}
