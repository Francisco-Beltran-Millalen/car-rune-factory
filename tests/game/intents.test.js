import { describe, it, expect } from 'vitest';
import { intents, INTENT_TYPES } from '../../src/game/intents.js';

describe('intents', () => {
  it('define todas las constantes de tipos esperadas', () => {
    expect(INTENT_TYPES.setParam).toBe('setParam');
    expect(INTENT_TYPES.setFault).toBe('setFault');
    expect(INTENT_TYPES.resetFaults).toBe('resetFaults');
    expect(INTENT_TYPES.applyPreset).toBe('applyPreset');
    expect(INTENT_TYPES.action).toBe('action');
    expect(INTENT_TYPES.selectPart).toBe('selectPart');
    expect(INTENT_TYPES.hoverPart).toBe('hoverPart');
    expect(INTENT_TYPES.answer).toBe('answer');
    expect(INTENT_TYPES.useTool).toBe('useTool');
    expect(INTENT_TYPES.removeTool).toBe('removeTool');
    expect(INTENT_TYPES.replacePart).toBe('replacePart');
    expect(INTENT_TYPES.deliver).toBe('deliver');
    expect(INTENT_TYPES.markSuspect).toBe('markSuspect');
  });

  it('los constructores producen el payload correspondiente', () => {
    expect(intents.setParam('rpm', 1200)).toEqual({ type: 'setParam', key: 'rpm', value: 1200 });
    expect(intents.setFault('filterClog', 0.8)).toEqual({ type: 'setFault', key: 'filterClog', value: 0.8 });
    expect(intents.resetFaults()).toEqual({ type: 'resetFaults' });
    expect(intents.applyPreset('clogged')).toEqual({ type: 'applyPreset', presetId: 'clogged' });
    expect(intents.action('refill', [50])).toEqual({ type: 'action', name: 'refill', args: [50] });
    expect(intents.selectPart('pump')).toEqual({ type: 'selectPart', partId: 'pump' });
    expect(intents.selectPart(null)).toEqual({ type: 'selectPart', partId: null });
    expect(intents.hoverPart('filter')).toEqual({ type: 'hoverPart', partId: 'filter' });
    expect(intents.answer('choice-a')).toEqual({ type: 'answer', choiceId: 'choice-a' });
    expect(intents.useTool('manometer', 'rail')).toEqual({ type: 'useTool', toolId: 'manometer', partId: 'rail' });
    expect(intents.removeTool('manometer')).toEqual({ type: 'removeTool', toolId: 'manometer' });
    expect(intents.replacePart('filter')).toEqual({ type: 'replacePart', partId: 'filter' });
    expect(intents.deliver()).toEqual({ type: 'deliver' });
    expect(intents.markSuspect('filter', 'suspect')).toEqual({ type: 'markSuspect', partId: 'filter', mark: 'suspect' });
  });
});
