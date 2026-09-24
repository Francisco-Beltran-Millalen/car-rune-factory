import { describe, it, expect, vi } from 'vitest';
import { createLabMode } from '../../src/game/modes/lab.js';
import { createSession } from '../../src/game/session.js';
import { intents } from '../../src/game/intents.js';

function createMockModule() {
  const DEFAULT_PARAMS = { rpm: 800, throttle: 0 };
  const DEFAULT_FAULTS = { filterClog: 0, relayDead: false };

  return {
    id: 'test-mod',
    title: 'Test Module',
    defaultParams: DEFAULT_PARAMS,
    defaultFaults: DEFAULT_FAULTS,
    createModel: () => {
      const params = { ...DEFAULT_PARAMS };
      const faults = { ...DEFAULT_FAULTS };
      const state = { pRail: 3.0 };
      const actions = {
        refill: vi.fn(),
      };
      return {
        params,
        faults,
        state,
        time: 0,
        step: vi.fn(),
        reset() {
          Object.assign(params, DEFAULT_PARAMS);
          Object.assign(faults, DEFAULT_FAULTS);
          this.time = 0;
        },
        actions,
      };
    },
    presets: [
      {
        id: 'case-clogged',
        label: 'Filtro tapado',
        params: { rpm: 2500 },
        faults: { filterClog: 0.9 },
        setup: { refill: [100] },
        note: 'Nota sobre el filtro tapado',
      },
    ],
    faults: [{ key: 'filterClog' }, { key: 'relayDead' }],
    controls: [{ key: 'rpm' }, { key: 'throttle' }],
    readouts: [{ id: 'pRail' }],
  };
}

describe('labMode', () => {
  it('inicializa con ui completa y status free', () => {
    const mod = createMockModule();
    const session = createSession({ createModel: mod.createModel, driver: 'external' });
    const mode = createLabMode({ session, module: mod, stage: null });

    expect(mode.id).toBe('lab');
    expect(mode.status).toBe('free');
    expect(mode.hud()).toBe(null);
    expect(mode.ui.controls).toBe('all');
    expect(mode.ui.faults).toBe('all');
    expect(mode.ui.readouts).toBe('all');
    expect(mode.ui.narration).toBe('full');
    expect(mode.ui.labels).toBe(true);
    expect(mode.ui.tooltips).toBe(true);
    expect(mode.ui.infoPanel).toBe(true);
    expect(mode.ui.presets).toBe(true);
    expect(mode.ui.revealedFaults).toEqual(['filterClog', 'relayDead']);
  });

  it('handle setParam modifica model.params', () => {
    const mod = createMockModule();
    const session = createSession({ createModel: mod.createModel, driver: 'external' });
    const mode = createLabMode({ session, module: mod, stage: null });

    const events = mode.handle(intents.setParam('rpm', 3000));
    expect(events).toEqual([]);
    expect(session.model.params.rpm).toBe(3000);
  });

  it('handle setFault modifica model.faults', () => {
    const mod = createMockModule();
    const session = createSession({ createModel: mod.createModel, driver: 'external' });
    const mode = createLabMode({ session, module: mod, stage: null });

    const events = mode.handle(intents.setFault('filterClog', 0.85));
    expect(events).toEqual([]);
    expect(session.model.faults.filterClog).toBe(0.85);
  });

  it('handle resetFaults restaura fallas a defaultFaults sin tocar params', () => {
    const mod = createMockModule();
    const session = createSession({ createModel: mod.createModel, driver: 'external' });
    const mode = createLabMode({ session, module: mod, stage: null });

    mode.handle(intents.setParam('rpm', 4500));
    mode.handle(intents.setFault('filterClog', 0.85));
    mode.handle(intents.setFault('relayDead', true));

    mode.handle(intents.resetFaults());
    expect(session.model.faults.filterClog).toBe(0);
    expect(session.model.faults.relayDead).toBe(false);
    expect(session.model.params.rpm).toBe(4500);
  });

  it('handle applyPreset aplica preset, ejecuta setup y devuelve feedback', () => {
    const mod = createMockModule();
    const session = createSession({ createModel: mod.createModel, driver: 'external' });
    const mode = createLabMode({ session, module: mod, stage: null });

    const events = mode.handle(intents.applyPreset('case-clogged'));
    expect(events.length).toBe(1);
    expect(events[0].type).toBe('feedback');
    expect(events[0].text).toBe('Nota sobre el filtro tapado');

    expect(session.model.params.rpm).toBe(2500);
    expect(session.model.faults.filterClog).toBe(0.9);
    expect(session.model.actions.refill).toHaveBeenCalledWith(100);
    expect(mode.activePreset.id).toBe('case-clogged');
  });

  it('handle action invoca la acción del modelo', () => {
    const mod = createMockModule();
    const session = createSession({ createModel: mod.createModel, driver: 'external' });
    const mode = createLabMode({ session, module: mod, stage: null });

    mode.handle(intents.action('refill', [20]));
    expect(session.model.actions.refill).toHaveBeenCalledWith(20);
  });

  it('intents desconocidos se ignoran sin error', () => {
    const mod = createMockModule();
    const session = createSession({ createModel: mod.createModel, driver: 'external' });
    const mode = createLabMode({ session, module: mod, stage: null });

    expect(mode.handle(null)).toEqual([]);
    expect(mode.handle({ type: 'unknown' })).toEqual([]);
    expect(mode.update(0.01)).toEqual([]);
  });

  it('setParam/setFault rechazan NaN, Infinity y tipos distintos (§6)', () => {
    const mod = createMockModule();
    const session = createSession({ createModel: mod.createModel, driver: 'external' });
    const mode = createLabMode({ session, module: mod, stage: null });

    mode.handle(intents.setParam('rpm', NaN));
    mode.handle(intents.setParam('throttle', Infinity));
    mode.handle(intents.setParam('rpm', '3000'));
    mode.handle(intents.setFault('filterClog', NaN));
    mode.handle(intents.setFault('relayDead', 1));
    expect(session.model.params).toEqual({ rpm: 800, throttle: 0 });
    expect(session.model.faults).toEqual({ filterClog: 0, relayDead: false });
  });

  it('onReset reinicia la sesión y olvida el preset activo', () => {
    const mod = createMockModule();
    const session = createSession({ createModel: mod.createModel, driver: 'external' });
    const mode = createLabMode({ session, module: mod, stage: null });

    mode.handle(intents.applyPreset('case-clogged'));
    mode.onReset();
    expect(mode.activePreset).toBe(null);
    expect(session.model.params.rpm).toBe(800);
    expect(session.model.faults.filterClog).toBe(0);
  });
});
