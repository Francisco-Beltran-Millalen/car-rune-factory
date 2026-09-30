// Panel de controles generado desde ControlSpec[] (§8). Emite intents (§20).

import { intents, type Intent } from '../../game/intents.ts';
import { h } from '../dom.ts';
import { fmt } from '../format.ts';
import type {
  AnyModel,
  ControlOption,
  ControlSpec,
  ParamRecord,
  ParamValue,
} from '../types.ts';

type GetValue = (key: string) => ParamValue | undefined;
type Emit = (intent: Intent) => void;

interface ControlItemDraft {
  node: HTMLElement;
  input: HTMLElement;
  sync(): void;
}

interface ControlItem extends ControlItemDraft {
  spec: ControlSpec;
}

export interface ControlsPanel {
  /** Refleja params en los inputs y evalúa disabledWhen. Barato: llamar ~10 Hz. */
  sync(): void;
  /** Muestra u oculta controles según la política del modo activo. */
  setVisible(visibleKeys: readonly string[] | 'all'): void;
}

/** Grupo de botones excluyentes (para selects cortos, p. ej. la llave). */
export function segmented(
  options: readonly ControlOption[],
  getValue: () => ParamValue | undefined,
  setValue: (v: ParamValue) => void,
): { node: HTMLDivElement; sync(): void } {
  const buttons = options.map((o) =>
    h(
      'button',
      {
        type: 'button',
        class: 'seg-btn',
        onclick: () => {
          setValue(o.value);
        },
      },
      o.label,
    ),
  );
  const node = h('div', { class: 'segmented', role: 'group' }, buttons);
  return {
    node,
    sync(): void {
      const v = getValue();
      options.forEach((o, i) => {
        buttons[i]?.classList.toggle('active', o.value === v);
      });
    },
  };
}

function decimalsFor(step: number): number {
  if (!step || step >= 1) return 0;
  return Math.min(3, Math.ceil(-Math.log10(step)));
}

function slider(
  spec: ControlSpec,
  getValue: GetValue,
  emit: Emit,
): ControlItemDraft {
  const out = h('output', { class: 'ctl-value' });
  const input = h('input', {
    type: 'range',
    min: spec.min ?? 0,
    max: spec.max ?? 1,
    step: spec.step ?? 0.01,
    oninput: () => {
      emit(intents.setParam(spec.key ?? '', Number(input.value)));
      show();
    },
  });
  const dec = decimalsFor(spec.step ?? 0.01);
  const show = (): void => {
    const v = Number(getValue(spec.key ?? ''));
    out.textContent = `${fmt(v, dec)}${spec.unit ? ' ' + spec.unit : ''}`;
  };
  const node = h('label', { class: 'ctl ctl-slider' }, h('span', { class: 'ctl-label' }, spec.label), out, input);
  return {
    node,
    input,
    sync(): void {
      if (document.activeElement !== input) input.value = String(getValue(spec.key ?? ''));
      show();
    },
  };
}

function toggle(
  spec: ControlSpec,
  getValue: GetValue,
  emit: Emit,
): ControlItemDraft {
  const input = h('input', {
    type: 'checkbox',
    onchange: () => {
      emit(intents.setParam(spec.key ?? '', input.checked));
    },
  });
  const node = h('label', { class: 'ctl ctl-toggle' }, input, h('span', { class: 'ctl-label' }, spec.label));
  return {
    node,
    input,
    sync(): void {
      input.checked = !!getValue(spec.key ?? '');
    },
  };
}

function select(
  spec: ControlSpec,
  getValue: GetValue,
  emit: Emit,
): ControlItemDraft {
  const seg = segmented(
    spec.options ?? [],
    () => getValue(spec.key ?? ''),
    (v) => {
      emit(intents.setParam(spec.key ?? '', v));
      seg.sync();
    },
  );
  const node = h('div', { class: 'ctl ctl-select' }, h('span', { class: 'ctl-label' }, spec.label), seg.node);
  return {
    node,
    input: seg.node,
    sync(): void {
      seg.sync();
    },
  };
}

function button(
  spec: ControlSpec,
  _getValue: GetValue,
  emit: Emit,
): ControlItemDraft {
  const input = h(
    'button',
    {
      type: 'button',
      class: 'btn',
      onclick: () => {
        emit(intents.action(spec.action ?? ''));
      },
    },
    spec.label,
  );
  return { node: h('div', { class: 'ctl ctl-button' }, input), input, sync() {} };
}

type Builder = (spec: ControlSpec, getValue: GetValue, emit: Emit) => ControlItemDraft;

const BUILDERS: Partial<Record<ControlSpec['type'], Builder>> = {
  slider,
  toggle,
  select,
  button,
};

export function createControlsPanel(
  container: HTMLElement,
  specs: readonly ControlSpec[],
  getValue: GetValue,
  emit: Emit = () => {},
  modelContext?: AnyModel,
): ControlsPanel {
  const items: ControlItem[] = [];
  const groups = new Map<string, HTMLFieldSetElement>();
  for (const spec of specs) {
    const build = BUILDERS[spec.type];
    if (!build) continue;
    const item: ControlItem = { ...build(spec, getValue, emit), spec };
    const gname = spec.group ?? '';
    let fs = groups.get(gname);
    if (!fs) {
      fs = h('fieldset', { class: 'ctl-group' }, gname ? h('legend', {}, gname) : null);
      groups.set(gname, fs);
      container.append(fs);
    }
    fs.append(item.node);
    items.push(item);
  }

  const partialModel = {
    get params(): ParamRecord {
      return new Proxy<ParamRecord>({}, { get: (_, k) => getValue(String(k)) });
    },
  };
  // Frontera: el fallback sólo expone `params`, lo único que usa disabledWhen.
  const evalModel = modelContext ?? (partialModel as AnyModel);

  return {
    sync(): void {
      for (const it of items) {
        it.sync();
        if (it.spec.disabledWhen) {
          const dis = it.spec.disabledWhen(evalModel);
          it.node.classList.toggle('disabled', dis);
          if ('disabled' in it.input) it.input.disabled = dis;
        }
      }
    },
    setVisible(visibleKeys): void {
      for (const it of items) {
        const isVis =
          visibleKeys === 'all' ||
          (Array.isArray(visibleKeys) && visibleKeys.includes(it.spec.key ?? ''));
        it.node.hidden = !isVis;
      }
      for (const fs of groups.values()) {
        const hasVisibleChild = Array.from(fs.children).some(
          (c) => c.tagName !== 'LEGEND' && c instanceof HTMLElement && !c.hidden,
        );
        fs.hidden = !hasVisibleChild;
      }
    },
  };
}
