// Modo laboratorio: reproduce el comportamiento actual (CONTRATOS.md §6.3).
// Puro (§1), sin DOM.

import type { Preset } from '../../core/types.ts';
import { INTENT_TYPES } from '../intents.ts';
import type { LabMode, ModeContext, ModeEvent, ModeUi } from '../types.ts';

// Un intent sólo escribe un valor del mismo tipo que el actual, y los números deben ser finitos (§6).
function accepts(current: unknown, value: unknown): boolean {
  if (typeof value !== typeof current) return false;
  return typeof value !== 'number' || Number.isFinite(value);
}

export function createLabMode(ctx: ModeContext): LabMode {
  const { session, module } = ctx;
  const model = session.model;
  let activePreset: Preset | null = null;

  const ui: ModeUi = {
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
    revealedFaults: (module.faults ?? []).map((f) => f.key),
  };

  return {
    id: 'lab',
    get ui(): ModeUi {
      return ui;
    },
    get status(): 'free' {
      return 'free';
    },
    get activePreset(): Preset | null {
      return activePreset;
    },
    handle(intent): ModeEvent[] {
      if (!intent) return [];
      switch (intent.type) {
        case INTENT_TYPES.setParam:
          if (intent.key in model.params && accepts(model.params[intent.key], intent.value)) {
            model.params[intent.key] = intent.value;
          }
          return [];

        case INTENT_TYPES.setFault:
          if (intent.key in model.faults && accepts(model.faults[intent.key], intent.value)) {
            model.faults[intent.key] = intent.value;
          }
          return [];

        case INTENT_TYPES.resetFaults: {
          Object.assign(model.faults, module.defaultFaults ?? {});
          return [];
        }

        case INTENT_TYPES.applyPreset: {
          const p = (module.presets ?? []).find((pr) => pr.id === intent.presetId);
          if (p) {
            session.reset();
            Object.assign(model.params, p.params ?? {});
            Object.assign(model.faults, p.faults ?? {});
            if (p.setup) {
              for (const [name, args] of Object.entries(p.setup)) {
                const action = model.actions[name];
                if (typeof action === 'function') action(...args);
              }
            }
            activePreset = p;
            return [{ type: 'feedback', level: 'info', text: p.note ?? '', data: { preset: p } }];
          }
          return [];
        }

        case INTENT_TYPES.action: {
          const action = model.actions[intent.name];
          if (typeof action === 'function') action(...intent.args);
          return [];
        }

        case INTENT_TYPES.selectPart:
        case INTENT_TYPES.hoverPart:
        case INTENT_TYPES.answer:
        case INTENT_TYPES.useTool:
        case INTENT_TYPES.removeTool:
        case INTENT_TYPES.replacePart:
        case INTENT_TYPES.deliver:
        case INTENT_TYPES.markSuspect:
        case INTENT_TYPES.placePart:
        case INTENT_TYPES.movePart:
        case INTENT_TYPES.rotatePart:
        case INTENT_TYPES.deletePart:
        case INTENT_TYPES.connect:
        case INTENT_TYPES.disconnect:
        case INTENT_TYPES.runTest:
        case INTENT_TYPES.nextStage:
        case INTENT_TYPES.retry:
        case INTENT_TYPES.quit:
          return [];

        // Runtime: un intent desconocido puede llegar desde JS (D9).
        default:
          return [];
      }
    },
    onReset(): void {
      activePreset = null;
      session.reset();
    },
    update(_simDt): ModeEvent[] {
      return [];
    },
    hud() {
      return null;
    },
    destroy(): void {
      activePreset = null;
    },
  };
}
