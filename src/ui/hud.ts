// HUD de etapas (CONTRATOS.md §6.7): pinta un HudModel y emite intents (§20).

import { clear, h } from '../core/dom.ts';
import { intents, type Intent } from '../game/intents.ts';
import type { HudModel } from '../game/types.ts';

export interface Hud {
  update(model: HudModel | null): void;
}

export function createHud(container: HTMLElement, emit: (intent: Intent) => void): Hud {
  let lastKey = '';

  function render(model: HudModel | null): void {
    clear(container);
    if (!model) return;

    if (model.title) container.append(h('h3', { class: 'hud-title' }, model.title));
    if (model.brief) container.append(h('p', { class: 'hud-brief' }, model.brief));

    if (model.stats.length) {
      container.append(
        h(
          'div',
          { class: 'hud-stats' },
          model.stats.map((s) =>
            h('span', { class: 'hud-stat' }, h('span', { class: 'hud-stat-label' }, `${s.label}: `), h('strong', {}, String(s.value))),
          ),
        ),
      );
    }

    const prompt = model.prompt;
    if (prompt) {
      const block = h('div', { class: 'hud-prompt' }, h('p', { class: 'hud-prompt-text' }, prompt.text));
      if (prompt.choices?.length) {
        block.append(
          h(
            'div',
            { class: 'hud-choices' },
            prompt.choices.map((c) =>
              h(
                'button',
                {
                  type: 'button',
                  class: 'btn hud-choice',
                  onclick: () => {
                    emit(intents.answer(c.id));
                  },
                },
                c.label,
              ),
            ),
          ),
        );
      }
      container.append(block);
    }

    if (model.tools?.length) {
      container.append(
        h(
          'div',
          { class: 'hud-tools' },
          model.tools.map((t) =>
            h(
              'button',
              {
                type: 'button',
                class: `btn hud-tool${t.active ? ' active' : ''}`,
                onclick: () => {
                  emit(t.active ? intents.removeTool(t.id) : intents.useTool(t.id));
                },
              },
              `${t.label}${t.cost ? ` (${t.cost} min)` : ''}`,
            ),
          ),
        ),
      );
    }

    if (model.actions?.length) {
      container.append(
        h(
          'div',
          { class: 'hud-actions' },
          model.actions.map((a) =>
            h(
              'button',
              {
                type: 'button',
                class: 'btn',
                disabled: a.disabled,
                onclick: () => {
                  emit(a.intent);
                },
              },
              a.label,
            ),
          ),
        ),
      );
    }

    if (model.suspects?.length) {
      container.append(
        h(
          'div',
          { class: 'hud-suspects' },
          model.suspects.map((s) =>
            h(
              'button',
              {
                type: 'button',
                class: `btn hud-suspect mark-${s.mark ?? 'none'}`,
                onclick: () => {
                  emit(intents.markSuspect(s.partId, s.mark === 'suspect' ? 'cleared' : s.mark === 'cleared' ? null : 'suspect'));
                },
              },
              s.label,
            ),
          ),
        ),
      );
    }

    if (model.log.length) {
      container.append(
        h(
          'div',
          { class: 'hud-log' },
          model.log.map((l) => h('div', { class: `hud-log-line level-${l.level}` }, l.text)),
        ),
      );
    }
  }

  return {
    update(model): void {
      const key = model ? JSON.stringify(model) : '';
      if (key === lastKey) return;
      lastKey = key;
      render(model);
    },
  };
}
