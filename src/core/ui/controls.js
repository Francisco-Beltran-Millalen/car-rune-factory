// Panel de controles generado desde ControlSpec[] (§8). Escribe sólo en model.params (§2).

import { h, fmt } from '../dom.js';

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

function slider(spec, model) {
  const out = h('output', { class: 'ctl-value' });
  const input = h('input', {
    type: 'range',
    min: spec.min ?? 0,
    max: spec.max ?? 1,
    step: spec.step ?? 0.01,
    oninput: () => {
      model.params[spec.key] = Number(input.value);
      show();
    },
  });
  const dec = decimalsFor(spec.step ?? 0.01);
  const show = () => {
    const v = model.params[spec.key];
    out.textContent = `${fmt(v, dec)}${spec.unit ? ' ' + spec.unit : ''}`;
  };
  const node = h('label', { class: 'ctl ctl-slider' }, h('span', { class: 'ctl-label' }, spec.label), out, input);
  return {
    node,
    input,
    sync() {
      if (document.activeElement !== input) input.value = String(model.params[spec.key]);
      show();
    },
  };
}

function toggle(spec, model) {
  const input = h('input', {
    type: 'checkbox',
    onchange: () => (model.params[spec.key] = input.checked),
  });
  const node = h('label', { class: 'ctl ctl-toggle' }, input, h('span', { class: 'ctl-label' }, spec.label));
  return { node, input, sync: () => (input.checked = !!model.params[spec.key]) };
}

function select(spec, model) {
  const seg = segmented(
    spec.options,
    () => model.params[spec.key],
    (v) => {
      model.params[spec.key] = v;
      seg.sync();
    },
  );
  const node = h('div', { class: 'ctl ctl-select' }, h('span', { class: 'ctl-label' }, spec.label), seg.node);
  return { node, input: seg.node, sync: seg.sync };
}

function button(spec, model) {
  const input = h(
    'button',
    { type: 'button', class: 'btn', onclick: () => model.actions?.[spec.action]?.() },
    spec.label,
  );
  return { node: h('div', { class: 'ctl ctl-button' }, input), input, sync() {} };
}

const BUILDERS = { slider, toggle, select, button };

/**
 * @param {HTMLElement} container
 * @param {import('../types.js').ControlSpec[]} specs
 * @param {import('../types.js').Model} model
 */
export function createControlsPanel(container, specs, model) {
  const items = [];
  const groups = new Map();
  for (const spec of specs) {
    const build = BUILDERS[spec.type];
    if (!build) continue;
    const item = build(spec, model);
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
  return {
    /** Refleja params en los inputs y evalúa disabledWhen. Barato: llamar ~10 Hz. */
    sync() {
      for (const it of items) {
        it.sync();
        if (it.spec.disabledWhen) {
          const dis = !!it.spec.disabledWhen(model);
          it.node.classList.toggle('disabled', dis);
          if ('disabled' in it.input) it.input.disabled = dis;
        }
      }
    },
  };
}
