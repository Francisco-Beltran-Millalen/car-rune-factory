import { describe, it, expect } from 'vitest';
import { parseHash } from '../../src/core/router.js';
import { sparklinePoints } from '../../src/core/ui/readouts.js';
import { pickNarrations } from '../../src/core/ui/infoPanel.js';
import { isFaultActive } from '../../src/core/ui/faults.js';
import { createDemoModel } from '../../src/modules/_demo/model.js';

describe('router', () => {
  it('parseHash', () => {
    expect(parseHash('#/fuel')).toBe('fuel');
    expect(parseHash('#/four-stroke')).toBe('four-stroke');
    expect(parseHash('#/')).toBe(null);
    expect(parseHash('')).toBe(null);
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
    const list = [
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
  it('se vacía, reset conserva identidad de params/faults', () => {
    const m = createDemoModel();
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
