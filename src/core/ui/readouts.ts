// Mediciones: valor numérico + sparkline del historial + manómetro opcional.

import type { Recorder } from '../history.ts';
import { h } from '../dom.ts';
import { fmt } from '../format.ts';
import { el, gaugeSvg } from '../svg.ts';
import type { ReadoutSpec } from '../types.ts';

const SPARK_W = 120;
const SPARK_H = 28;

/** Puntos de la polyline para una serie. Puro, testeable. */
export function sparklinePoints(values: readonly number[], w = SPARK_W, h = SPARK_H): string {
  if (values.length < 2) return '';
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (max - min < 1e-6) {
    max += 0.5;
    min -= 0.5;
  }
  const n = values.length;
  let out = '';
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * w;
    const v = values[i] ?? min;
    const y = h - 2 - ((v - min) / (max - min)) * (h - 4);
    out += `${x.toFixed(1)},${y.toFixed(1)} `;
  }
  return out.trim();
}

interface GaugeLike {
  setValue(v: number): void;
}

interface ReadoutRow {
  spec: ReadoutSpec;
  node: HTMLElement;
  value: HTMLElement;
  line: SVGPolylineElement | null;
  gauge: GaugeLike | null;
  lastText: string;
}

export interface ReadoutsPanel {
  update(state: Readonly<object>): void;
  /** Redibuja sparklines (más caro; llamar ~5 Hz). */
  updateSparks(): void;
  /** Muestra u oculta lecturas según la política del modo activo. */
  setVisible(visibleIds: readonly string[] | 'all'): void;
}

export function createReadoutsPanel(
  container: HTMLElement,
  specs: readonly ReadoutSpec[],
  recorder: Recorder,
): ReadoutsPanel {
  const rows: ReadoutRow[] = specs.map((spec) => {
    const value = h('span', { class: 'ro-value' });
    const unit = h('span', { class: 'ro-unit' }, spec.unit || '');
    let line: SVGPolylineElement | null = null;
    let spark: SVGSVGElement | null = null;
    if (spec.history) {
      spark = el('svg', { class: 'sparkline', viewBox: `0 0 ${SPARK_W} ${SPARK_H}`, preserveAspectRatio: 'none' });
      line = el('polyline', { class: 'spark-line', fill: 'none' }, spark);
    }
    let gauge: GaugeLike | null = null;
    let gaugeNode: SVGSVGElement | null = null;
    if (spec.gauge) {
      gaugeNode = el('svg', { class: 'ro-gauge', viewBox: '0 0 100 100' });
      gauge = gaugeSvg(gaugeNode, { cx: 50, cy: 52, r: 44, ...spec.gauge, ticks: 4 });
    }
    const node = h(
      'div',
      { class: 'readout' },
      h('div', { class: 'ro-head' }, h('span', { class: 'ro-label' }, spec.label), h('span', {}, value, ' ', unit)),
      gaugeNode ?? spark ? h('div', { class: 'ro-body' }, gaugeNode, spark) : null,
    );
    container.append(node);
    return { spec, node, value, line, gauge, lastText: '' };
  });

  return {
    update(state): void {
      for (const r of rows) {
        const v = r.spec.get(state);
        const text = fmt(v, r.spec.decimals ?? 1);
        if (text !== r.lastText) {
          r.value.textContent = text;
          r.lastText = text;
        }
        if (r.gauge) r.gauge.setValue(v);
        const green = r.spec.gauge?.green;
        if (green) r.node.classList.toggle('out-of-range', v < green[0] || v > green[1]);
      }
    },
    updateSparks(): void {
      for (const r of rows) {
        if (!r.line) continue;
        const buf = recorder.series.get(r.spec.id);
        if (buf) r.line.setAttribute('points', sparklinePoints(buf.toArray()));
      }
    },
    setVisible(visibleIds): void {
      for (const r of rows) {
        const isVis =
          visibleIds === 'all' ||
          (Array.isArray(visibleIds) && visibleIds.includes(r.spec.id));
        r.node.hidden = !isVis;
      }
    },
  };
}
