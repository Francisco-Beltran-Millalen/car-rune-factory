// Panel de fallas generado desde FaultSpec[] (§8). Escribe sólo en model.faults (§2).

import { h } from '../dom.js';
import { segmented } from './controls.js';

/** ¿La falla está activa (distinta de su valor sano por defecto)? */
export function isFaultActive(value, healthy) {
  if (typeof value === 'number') return value > 0.001 && value !== healthy;
  return value !== healthy;
}

function severity(spec, model) {
  const out = h('output', { class: 'ctl-value' });
  const input = h('input', {
    type: 'range',
    min: 0,
    max: 1,
    step: 0.05,
    oninput: () => {
      model.faults[spec.key] = Number(input.value);
      show();
    },
  });
  const show = () => (out.textContent = `${Math.round(model.faults[spec.key] * 100)} %`);
  return {
    body: [out, input],
    sync() {
      if (document.activeElement !== input) input.value = String(model.faults[spec.key]);
      show();
    },
  };
}

function toggle(spec, model) {
  const input = h('input', { type: 'checkbox', onchange: () => (model.faults[spec.key] = input.checked) });
  return { body: [input], sync: () => (input.checked = !!model.faults[spec.key]) };
}

function enumFault(spec, model) {
  const seg = segmented(
    spec.options,
    () => model.faults[spec.key],
    (v) => {
      model.faults[spec.key] = v;
      seg.sync();
    },
  );
  return { body: [seg.node], sync: seg.sync };
}

const BUILDERS = { severity, toggle, enum: enumFault };

/**
 * @param {HTMLElement} container
 * @param {import('../types.js').FaultSpec[]} specs
 * @param {import('../types.js').Model} model
 */
export function createFaultsPanel(container, specs, model) {
  const healthy = { ...model.faults };
  const items = [];
  for (const spec of specs) {
    const build = BUILDERS[spec.kind];
    if (!build) continue;
    const item = build(spec, model);
    const labelEl = h('span', { class: 'ctl-label' }, spec.label);
    const node =
      spec.kind === 'toggle'
        ? h('label', { class: 'fault ctl ctl-toggle', title: spec.description || '' }, ...item.body, labelEl)
        : h('label', { class: `fault ctl ctl-${spec.kind}`, title: spec.description || '' }, labelEl, ...item.body);
    container.append(node);
    items.push({ spec, node, sync: item.sync });
  }
  const repair = h(
    'button',
    {
      type: 'button',
      class: 'btn btn-small',
      onclick: () => {
        Object.assign(model.faults, healthy);
        api.sync();
      },
    },
    'Reparar todo',
  );
  container.append(h('div', { class: 'ctl ctl-button' }, repair));

  const api = {
    sync() {
      let any = false;
      for (const it of items) {
        it.sync();
        const active = isFaultActive(model.faults[it.spec.key], healthy[it.spec.key]);
        it.node.classList.toggle('active', active);
        any ||= active;
      }
      repair.disabled = !any;
    },
  };
  return api;
}
