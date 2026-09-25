// Partículas que recorren un path SVG. Velocidad ∝ caudal (CONTRATOS.md 4.6).

import { el } from './svg.js';
import { wrap } from './math.js';

/**
 * Escala visual por defecto: 100 L/h → 250 px/s.
 * @public — convención de CONTRATOS.md 4.6; cada módulo puede cambiarla.
 */
export const PX_PER_LH = 2.5;

/** Hash determinista de un índice a [0, 1): decide qué partículas se ocultan o son aire. */
export function hash01(i) {
  let x = (i + 1) * 2654435761;
  x = (x ^ (x >>> 16)) >>> 0;
  x = Math.imul(x, 0x45d9f3b) >>> 0;
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

/** Distancias a lo largo del path de cada partícula. Puro, testeable. */
export function particleOffsets(count, spacing, phase) {
  const out = new Array(count);
  for (let i = 0; i < count; i++) out[i] = i * spacing + phase;
  return out;
}

/** Tabla de puntos del path cada `step` px, para no llamar getPointAtLength por frame. */
function samplePath(path, step = 2) {
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

function pointAt(t, s) {
  const f = Math.min(s / t.step, t.n - 1.001);
  const i = Math.floor(f);
  const k = f - i;
  return [t.xs[i] + (t.xs[i + 1] - t.xs[i]) * k, t.ys[i] + (t.ys[i + 1] - t.ys[i]) * k];
}

/**
 * @param {Object} o
 * @param {SVGPathElement} o.path
 * @param {SVGGElement} o.layer
 * @param {number} [o.spacing]
 * @param {number} [o.radius]
 * @param {string} [o.className]
 */
export function createFlow({ path, layer, spacing = 14, radius = 3, className = 'p-fuel' }) {
  const table = samplePath(path);
  const count = Math.max(1, Math.floor(table.len / spacing));
  const dots = [];
  for (let i = 0; i < count; i++) {
    dots.push(el('circle', { r: radius, class: `particle ${className}` }, layer));
  }
  let speed = 0;
  let phase = hash01(count) * spacing;
  let density = 1;
  let airFraction = 0;
  let baseClass = className;
  let dirty = true;

  function restyle() {
    for (let i = 0; i < count; i++) {
      const h = hash01(i);
      const visible = h < density;
      const air = hash01(i + 7919) < airFraction;
      dots[i].setAttribute('class', `particle ${air ? 'p-air' : baseClass}`);
      dots[i].style.display = visible ? '' : 'none';
    }
    dirty = false;
  }

  return {
    setSpeed(pxPerSec) {
      speed = Number.isFinite(pxPerSec) ? pxPerSec : 0;
    },
    setStyle(cls) {
      if (cls !== baseClass) {
        baseClass = cls;
        dirty = true;
      }
    },
    setDensity(d) {
      const v = Math.round(Math.max(0, Math.min(1, d)) * 20) / 20;
      if (v !== density) {
        density = v;
        dirty = true;
      }
    },
    /** Fracción 0..1 de partículas dibujadas como burbujas de aire. */
    setAir(f) {
      const v = Math.round(Math.max(0, Math.min(1, f)) * 20) / 20;
      if (v !== airFraction) {
        airFraction = v;
        dirty = true;
      }
    },
    update(dt) {
      if (dirty) restyle();
      phase = wrap(phase + speed * dt, spacing);
      const offs = particleOffsets(count, spacing, phase);
      for (let i = 0; i < count; i++) {
        const s = offs[i];
        const [x, y] = pointAt(table, Math.min(s, table.len));
        dots[i].setAttribute('cx', x.toFixed(1));
        dots[i].setAttribute('cy', y.toFixed(1));
      }
    },
    destroy() {
      for (const d of dots) d.remove();
      dots.length = 0;
    },
  };
}
