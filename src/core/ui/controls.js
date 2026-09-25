// Panel de controles generado desde ControlSpec[] (§8). Emite intents (§20).

import { h } from '../dom.js';
import { fmt } from '../format.js';
import { intents } from '../../game/intents.js';

/** Grupo de botones excluyentes (para selects cortos, p. ej. la llave). */
export function segmented(options, getValue, setValue) {
  const buttons = options.map((o) =>
    h('button', { type: 'button', class: 'seg-btn', onclick: () => setValue(o.value) }, o.label),
  );
  const node = h('div', { class: 'segmented', role: 'group' }, buttons);
  return {
    node,
    sync() {
      const v = getValue();
      options.forEach((o, i) => buttons[i].classList.toggle('active', o.value === v));
    },
  };
}

function decimalsFor(step) {
  if (!step || step >= 1) return 0;
  return Math.min(3, Math.ceil(-Math.log10(step)));
}

function slider(spec, getValue, emit) {
  const out = h('output', { class: 'ctl-value' });
  const input = h('input', {
    type: 'range',
    min: spec.min ?? 0,
    max: spec.max ?? 1,
    step: spec.step ?? 0.01,
    oninput: () => {
      emit(intents.setParam(spec.key, Number(input.value)));
      show();
    },
  });
  const dec = decimalsFor(spec.step ?? 0.01);
  const show = () => {
    const v = getValue(spec.key);
    out.textContent = `${fmt(v, dec)}${spec.unit ? ' ' + spec.unit : ''}`;
  };
  const node = h('label', { class: 'ctl ctl-slider' }, h('span', { class: 'ctl-label' }, spec.label), out, input);
  return {
    node,
    input,
    sync() {
      if (document.activeElement !== input) input.value = String(getValue(spec.key));
      show();
    },
  };
}

function toggle(spec, getValue, emit) {
  const input = h('input', {
    type: 'checkbox',
    onchange: () => emit(intents.setParam(spec.key, input.checked)),
  });
  const node = h('label', { class: 'ctl ctl-toggle' }, input, h('span', { class: 'ctl-label' }, spec.label));
  return { node, input, sync: () => (input.checked = !!getValue(spec.key)) };
}

function select(spec, getValue, emit) {
  const seg = segmented(
    spec.options,
    () => getValue(spec.key),
    (v) => {
      emit(intents.setParam(spec.key, v));
      seg.sync();
    },
  );
  const node = h('div', { class: 'ctl ctl-select' }, h('span', { class: 'ctl-label' }, spec.label), seg.node);
  return { node, input: seg.node, sync: seg.sync };
}

function button(spec, getValue, emit) {
  const input = h(
    'button',
    { type: 'button', class: 'btn', onclick: () => emit(intents.action(spec.action)) },
    spec.label,
  );
  return { node: h('div', { class: 'ctl ctl-button' }, input), input, sync() {} };
}

const BUILDERS = { slider, toggle, select, button };

/**
 * @param {HTMLElement} container
 * @param {import('../types.js').ControlSpec[]} specs
 * @param {(key: string) => any} getValue
 * @param {(intent: import('../../game/types.js').Intent) => void} emit
 * @param {import('../types.js').Model} [modelContext]
 */
export function createControlsPanel(container, specs, getValue, emit = () => {}, modelContext) {
  const items = [];
  const groups = new Map();
  for (const spec of specs) {
    const build = BUILDERS[spec.type];
    if (!build) continue;
    const item = build(spec, getValue, emit);
    item.spec = spec;
    const gname = spec.group || '';
    if (!groups.has(gname)) {
      const fs = h('fieldset', { class: 'ctl-group' }, gname ? h('legend', {}, gname) : null);
      groups.set(gname, fs);
      container.append(fs);
    }
    groups.get(gname).append(item.node);
    items.push(item);
  }

  const evalModel = modelContext || {
    get params() {
      return new Proxy({}, { get: (_, k) => getValue(String(k)) });
    },
  };

  return {
    /** Refleja params en los inputs y evalúa disabledWhen. Barato: llamar ~10 Hz. */
    sync() {
      for (const it of items) {
        it.sync();
        if (it.spec.disabledWhen) {
          const dis = !!it.spec.disabledWhen(evalModel);
          it.node.classList.toggle('disabled', dis);
          if ('disabled' in it.input) it.input.disabled = dis;
        }
      }
    },
    /** Muestra u oculta controles según la política del modo activo. */
    setVisible(visibleKeys) {
      for (const it of items) {
        const isVis = visibleKeys === 'all' || (Array.isArray(visibleKeys) && visibleKeys.includes(it.spec.key));
        it.node.hidden = !isVis;
      }
      for (const fs of groups.values()) {
        const hasVisibleChild = Array.from(fs.children).some((c) => c.tagName !== 'LEGEND' && !c.hidden);
        fs.hidden = !hasVisibleChild;
      }
    },
  };
}
