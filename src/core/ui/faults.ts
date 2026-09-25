// Panel de fallas generado desde FaultSpec[] (§8). Emite intents (§20).

import { intents, type Intent } from '../../game/intents.ts';
import { h } from '../dom.ts';
import type { FaultSpec, ParamRecord, ParamValue } from '../types.ts';
import { segmented } from './controls.ts';

type GetValue = (key: string) => ParamValue | undefined;
type Emit = (intent: Intent) => void;

interface FaultItemDraft {
  body: HTMLElement[];
  sync(): void;
}

interface FaultItem {
  spec: FaultSpec;
  node: HTMLElement;
  sync(): void;
}

export interface FaultsPanel {
  sync(): void;
  setVisible(visibleKeys: readonly string[] | 'all' | 'none'): void;
}

/** ¿La falla está activa (distinta de su valor sano por defecto)? */
export function isFaultActive(value: unknown, healthy: unknown): boolean {
  if (typeof value === 'number') return value > 0.001 && value !== healthy;
  return value !== healthy;
}

function severity(
  spec: FaultSpec,
  getValue: GetValue,
  emit: Emit,
): FaultItemDraft {
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
  const show = (): void => {
    out.textContent = `${Math.round(Number(getValue(spec.key)) * 100)} %`;
  };
  return {
    body: [out, input],
    sync(): void {
      if (document.activeElement !== input) input.value = String(getValue(spec.key));
      show();
    },
  };
}

function toggle(
  spec: FaultSpec,
  getValue: GetValue,
  emit: Emit,
): FaultItemDraft {
  const input = h('input', {
    type: 'checkbox',
    onchange: () => {
      emit(intents.setFault(spec.key, input.checked));
    },
  });
  return {
    body: [input],
    sync(): void {
      input.checked = !!getValue(spec.key);
    },
  };
}

function enumFault(
  spec: FaultSpec,
  getValue: GetValue,
  emit: Emit,
): FaultItemDraft {
  const seg = segmented(
    spec.options ?? [],
    () => getValue(spec.key),
    (v) => {
      emit(intents.setFault(spec.key, v));
      seg.sync();
    },
  );
  return {
    body: [seg.node],
    sync(): void {
      seg.sync();
    },
  };
}

type Builder = (spec: FaultSpec, getValue: GetValue, emit: Emit) => FaultItemDraft;

const BUILDERS: Partial<Record<FaultSpec['kind'], Builder>> = {
  severity,
  toggle,
  enum: enumFault,
};

export function createFaultsPanel(
  container: HTMLElement,
  specs: readonly FaultSpec[],
  getValue: GetValue,
  emit: Emit = () => {},
  defaultFaults: Readonly<ParamRecord> = {},
): FaultsPanel {
  const healthy: Record<string, ParamValue | undefined> = { ...defaultFaults };

  // Si healthy no tiene claves para algún spec, inicializarlo con el valor actual
  for (const spec of specs) {
    if (!(spec.key in healthy)) {
      healthy[spec.key] = getValue(spec.key);
    }
  }

  const items: FaultItem[] = [];
  for (const spec of specs) {
    const build = BUILDERS[spec.kind];
    if (!build) continue;
    const item = build(spec, getValue, emit);
    const labelEl = h('span', { class: 'ctl-label' }, spec.label);
    const node =
      spec.kind === 'toggle'
        ? h('label', { class: 'fault ctl ctl-toggle', title: spec.description ?? '' }, ...item.body, labelEl)
        : h('label', { class: `fault ctl ctl-${spec.kind}`, title: spec.description ?? '' }, labelEl, ...item.body);
    container.append(node);
    items.push({
      spec,
      node,
      sync: () => {
        item.sync();
      },
    });
  }

  const repairBtn = h(
    'button',
    {
      type: 'button',
      class: 'btn btn-small',
      onclick: () => {
        emit(intents.resetFaults());
      },
    },
    'Reparar todo',
  );
  const repairWrapper = h('div', { class: 'ctl ctl-button' }, repairBtn);
  container.append(repairWrapper);

  const api: FaultsPanel = {
    sync(): void {
      let any = false;
      for (const it of items) {
        it.sync();
        const active = isFaultActive(getValue(it.spec.key), healthy[it.spec.key]);
        it.node.classList.toggle('active', active);
        any ||= active;
      }
      repairBtn.disabled = !any;
    },
    setVisible(visibleKeys): void {
      const isNone =
        visibleKeys === 'none' || (Array.isArray(visibleKeys) && visibleKeys.length === 0);
      for (const it of items) {
        const isVis =
          !isNone &&
          (visibleKeys === 'all' ||
            (Array.isArray(visibleKeys) && visibleKeys.includes(it.spec.key)));
        it.node.hidden = !isVis;
      }
      repairWrapper.hidden = isNone;
    },
  };
  return api;
}
