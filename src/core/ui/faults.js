// Panel de fallas generado desde FaultSpec[] (§8). Emite intents (§20).

import { h } from '../dom.js';
import { segmented } from './controls.js';
import { intents } from '../../game/intents.js';

/** ¿La falla está activa (distinta de su valor sano por defecto)? */
export function isFaultActive(value, healthy) {
  if (typeof value === 'number') return value > 0.001 && value !== healthy;
  return value !== healthy;
}

function severity(spec, getValue, emit) {
  const out = h('output', { class: 'ctl-value' });
  const input = h('input', {
    type: 'range',
    min: 0,
    max: 1,
    step: 0.05,
    oninput: () => {
      emit(intents.setFault(spec.key, Number(input.value)));
      show();
    },
  });
  const show = () => (out.textContent = `${Math.round(Number(getValue(spec.key)) * 100)} %`);
  return {
    body: [out, input],
    sync() {
      if (document.activeElement !== input) input.value = String(getValue(spec.key));
      show();
    },
  };
}

function toggle(spec, getValue, emit) {
  const input = h('input', {
    type: 'checkbox',
    onchange: () => emit(intents.setFault(spec.key, input.checked)),
  });
  return { body: [input], sync: () => (input.checked = !!getValue(spec.key)) };
}

function enumFault(spec, getValue, emit) {
  const seg = segmented(
    spec.options,
    () => getValue(spec.key),
    (v) => {
      emit(intents.setFault(spec.key, v));
      seg.sync();
    },
  );
  return { body: [seg.node], sync: seg.sync };
}

const BUILDERS = { severity, toggle, enum: enumFault };

/**
 * @param {HTMLElement} container
 * @param {import('../types.ts').FaultSpec[]} specs
 * @param {(key: string) => any} getValue
 * @param {(intent: import('../../game/types.js').Intent) => void} emit
 * @param {Record<string, any>} [defaultFaults]
 */
export function createFaultsPanel(container, specs, getValue, emit = () => {}, defaultFaults = {}) {
  const healthy = { ...defaultFaults };

  // Si healthy no tiene claves para algún spec, inicializarlo con el valor actual
  for (const spec of specs) {
    if (!(spec.key in healthy)) {
      healthy[spec.key] = getValue(spec.key);
    }
  }

  const items = [];
  for (const spec of specs) {
    const build = BUILDERS[spec.kind];
    if (!build) continue;
    const item = build(spec, getValue, emit);
    const labelEl = h('span', { class: 'ctl-label' }, spec.label);
    const node =
      spec.kind === 'toggle'
        ? h('label', { class: 'fault ctl ctl-toggle', title: spec.description || '' }, ...item.body, labelEl)
        : h('label', { class: `fault ctl ctl-${spec.kind}`, title: spec.description || '' }, labelEl, ...item.body);
    container.append(node);
    items.push({ spec, node, sync: item.sync });
  }

  const repairBtn = h(
    'button',
    {
      type: 'button',
      class: 'btn btn-small',
      onclick: () => emit(intents.resetFaults()),
    },
    'Reparar todo',
  );
  const repairWrapper = h('div', { class: 'ctl ctl-button' }, repairBtn);
  container.append(repairWrapper);

  const api = {
    sync() {
      let any = false;
      for (const it of items) {
        it.sync();
        const active = isFaultActive(getValue(it.spec.key), healthy[it.spec.key]);
        it.node.classList.toggle('active', active);
        any ||= active;
      }
      repairBtn.disabled = !any;
    },
    setVisible(visibleKeys) {
      const isNone = visibleKeys === 'none' || (Array.isArray(visibleKeys) && visibleKeys.length === 0);
      for (const it of items) {
        const isVis = !isNone && (visibleKeys === 'all' || (Array.isArray(visibleKeys) && visibleKeys.includes(it.spec.key)));
        it.node.hidden = !isVis;
      }
      repairWrapper.hidden = isNone;
    },
  };
  return api;
}
