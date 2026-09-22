// Mediciones: valor numérico + sparkline del historial + manómetro opcional.

import { h, fmt } from '../dom.js';
import { el, gaugeSvg } from '../svg.js';

const SPARK_W = 120;
const SPARK_H = 28;

/** Puntos de la polyline para una serie. Puro, testeable. */
export function sparklinePoints(values, w = SPARK_W, h = SPARK_H) {
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
    const y = h - 2 - ((values[i] - min) / (max - min)) * (h - 4);
    out += `${x.toFixed(1)},${y.toFixed(1)} `;
  }
  return out.trim();
}

/**
 * @param {HTMLElement} container
 * @param {import('../types.js').ReadoutSpec[]} specs
 * @param {ReturnType<import('../history.js').createRecorder>} recorder
 */
export function createReadoutsPanel(container, specs, recorder) {
  const rows = specs.map((spec) => {
    const value = h('span', { class: 'ro-value' });
    const unit = h('span', { class: 'ro-unit' }, spec.unit || '');
    let line = null;
    let spark = null;
    if (spec.history) {
      spark = el('svg', { class: 'sparkline', viewBox: `0 0 ${SPARK_W} ${SPARK_H}`, preserveAspectRatio: 'none' });
      line = el('polyline', { class: 'spark-line', fill: 'none' }, spark);
    }
    let gauge = null;
    let gaugeNode = null;
    if (spec.gauge) {
      gaugeNode = el('svg', { class: 'ro-gauge', viewBox: '0 0 100 100' });
      gauge = gaugeSvg(gaugeNode, { cx: 50, cy: 52, r: 44, ...spec.gauge, ticks: 4 });
    }
    const node = h(
      'div',
      { class: 'readout' },
      h('div', { class: 'ro-head' }, h('span', { class: 'ro-label' }, spec.label), h('span', {}, value, ' ', unit)),
      gaugeNode || spark ? h('div', { class: 'ro-body' }, gaugeNode, spark) : null,
    );
    container.append(node);
    return { spec, node, value, line, gauge, lastText: '' };
  });

  return {
    update(state) {
      for (const r of rows) {
        const v = Number(r.spec.get(state));
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
    /** Redibuja sparklines (más caro; llamar ~5 Hz). */
    updateSparks() {
      for (const r of rows) {
        if (!r.line) continue;
        const buf = recorder.series.get(r.spec.id);
        if (buf) r.line.setAttribute('points', sparklinePoints(buf.toArray()));
      }
    },
  };
}
