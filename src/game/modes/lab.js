// Modo laboratorio: reproduce el comportamiento actual (CONTRATOS.md §6.3).
// Puro (§1), sin DOM.

import { INTENT_TYPES } from '../intents.js';

/**
 * @param {import('../types.js').ModeContext} ctx
 * @returns {import('../types.js').GameMode}
 */
export function createLabMode(ctx) {
  const { session, module } = ctx;
  const model = session.model;
  let activePreset = null;

  const ui = {
    controls: 'all',
    faults: 'all',
    readouts: 'all',
    narration: 'full',
    labels: true,
    tooltips: true,
    infoPanel: true,
    presets: true,
    timebar: { maxScale: 4 },
    edit: { draggable: false, connectable: false, palette: [] },
    revealedFaults: (module.faults || []).map((f) => f.key),
  };

  return {
    id: 'lab',
    get ui() {
      return ui;
    },
    get status() {
      return 'free';
    },
    get activePreset() {
      return activePreset;
    },
    handle(intent) {
      if (!intent) return [];
      switch (intent.type) {
        case INTENT_TYPES.setParam:
          if (model.params && intent.key in model.params) {
            model.params[intent.key] = intent.value;
          }
          return [];

        case INTENT_TYPES.setFault:
          if (model.faults && intent.key in model.faults) {
            model.faults[intent.key] = intent.value;
          }
          return [];

        case INTENT_TYPES.resetFaults: {
          const defaults = module.defaultFaults || {};
          Object.assign(model.faults, defaults);
          return [];
        }

        case INTENT_TYPES.applyPreset: {
          const p = (module.presets || []).find((pr) => pr.id === intent.presetId);
          if (p) {
            session.reset();
            Object.assign(model.params, p.params || {});
            Object.assign(model.faults, p.faults || {});
            if (p.setup) {
              for (const [name, args] of Object.entries(p.setup)) {
                model.actions?.[name]?.(...(args || []));
              }
            }
            activePreset = p;
            return [{ type: 'feedback', level: 'info', text: p.note || '', data: { preset: p } }];
          }
          return [];
        }

        case INTENT_TYPES.action:
          if (model.actions && typeof model.actions[intent.name] === 'function') {
            model.actions[intent.name](...(intent.args || []));
          }
          return [];

        default:
          return [];
      }
    },
    update(simDt) {
      return [];
    },
    hud() {
      return null;
    },
    destroy() {
      activePreset = null;
    },
  };
}
