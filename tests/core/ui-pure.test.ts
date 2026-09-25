import { describe, it, expect } from 'vitest';
import { parseHash } from '../../src/core/router.ts';
import { sparklinePoints } from '../../src/core/ui/readouts.ts';
import { pickNarrations } from '../../src/core/ui/infoPanel.ts';
import { isFaultActive } from '../../src/core/ui/faults.ts';
import { createDemoModel } from '../../src/modules/_demo/model.js';
import type { Narration } from '../../src/core/types.ts';

describe('router', () => {
  it('parseHash', () => {
    expect(parseHash('#/fuel')).toEqual({ kind: 'lab', id: 'fuel' });
    expect(parseHash('#/lab/fuel')).toEqual({ kind: 'lab', id: 'fuel' });
    expect(parseHash('#/four-stroke')).toEqual({ kind: 'lab', id: 'four-stroke' });
    expect(parseHash('#/stage/fuel-quiz-1')).toEqual({ kind: 'stage', id: 'fuel-quiz-1' });
    expect(parseHash('#/')).toEqual({ kind: 'home', id: null });
    expect(parseHash('')).toEqual({ kind: 'home', id: null });
  });
});

describe('readouts', () => {
  it('sparklinePoints escala a la caja y tolera series planas', () => {
    expect(sparklinePoints([1])).toBe('');
    const pts = sparklinePoints([0, 10], 100, 20).split(' ');
    expect(pts[0]).toBe('0.0,18.0');
    expect(pts[1]).toBe('100.0,2.0');
    expect(sparklinePoints([5, 5, 5], 100, 20)).not.toContain('NaN');
  });
});

describe('narración', () => {
  it('ordena por severidad, estable, máx 3', () => {
    const list: Narration[] = [
      { level: 'info', text: 'a' },
      { level: 'bad', text: 'b' },
      { level: 'warn', text: 'c' },
      { level: 'bad', text: 'd' },
    ];
    expect(pickNarrations(list).map((n) => n.text)).toEqual(['b', 'd', 'c']);
  });
});

describe('fallas', () => {
  it('isFaultActive', () => {
    expect(isFaultActive(0, 0)).toBe(false);
    expect(isFaultActive(0.5, 0)).toBe(true);
    expect(isFaultActive(true, false)).toBe(true);
    expect(isFaultActive('ok', 'ok')).toBe(false);
    expect(isFaultActive('dead', 'ok')).toBe(true);
  });
});

describe('_demo', () => {
  interface DemoModel {
    params: { valve: number };
    state: { level: number };
    step(dt: number): void;
    reset(): void;
  };
  it('se vacía, reset conserva identidad de params/faults', () => {
    // El módulo `_demo` sigue en JS (inferencia `state: {}`) hasta TS4:
    // el test lo ve por su forma de uso.
    const raw: unknown = createDemoModel();
    const m = raw as DemoModel;
    const p = m.params;
    for (let i = 0; i < 5000; i++) m.step(0.001);
    expect(m.state.level).toBeLessThan(80);
    m.params.valve = 1;
    m.reset();
    expect(m.params).toBe(p);
    expect(m.params.valve).toBe(0.5);
    expect(m.state.level).toBe(80);
  });
});
