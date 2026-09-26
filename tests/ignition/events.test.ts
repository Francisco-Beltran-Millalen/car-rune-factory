// Criterios 1, 10 y 12 de la spec ignition §11: RL del primario, avance y
// detección de eventos (puros, sin modelo).
import { describe, expect, it } from 'vitest';
import { IG } from '../../src/modules/ignition/constants.ts';
import {
  availableVoltageKv,
  breakCurrent,
  chargeIntegral,
  copAdvance,
  pointsAdvance,
  requiredVoltageKv,
  sparkEvents,
} from '../../src/modules/ignition/events.ts';

describe('events — ley del primario (spec §11.1)', () => {
  it('a t = τ = L/R la corriente llega al 63,2 % de V/R', () => {
    const r = 0.5;
    const l = 0.003;
    const tau = l / r; // 6 ms
    const v = 12.6;
    const i = breakCurrent(v, r, l, tau, 0);
    expect(i / (v / r)).toBeGreaterThan(0.627);
    expect(i / (v / r)).toBeLessThan(0.637);
  });

  it('el tope del igniter limita en 8 A y la integral lo respeta', () => {
    const r = 0.5;
    const l = 0.003;
    const v = 12.6;
    const i = breakCurrent(v, r, l, 0.05, IG.copCurrentLimit);
    expect(i).toBeCloseTo(8, 6);
    const qCap = chargeIntegral(0.05, v, r, l, IG.copCurrentLimit);
    const qNoCap = chargeIntegral(0.05, v, r, l, 0);
    expect(qCap).toBeLessThan(qNoCap);
    expect(qCap).toBeGreaterThan(0);
  });
});

describe('events — avance (spec §11.10)', () => {
  it('platinos: ralentí 8°, crucero 3000/0,3 en [40; 46]', () => {
    expect(pointsAdvance(800, -0.65, 0, 0)).toBeCloseTo(8, 6);
    const cruise = pointsAdvance(3000, -0.455, 0.3, 0);
    expect(cruise).toBeGreaterThan(40);
    expect(cruise).toBeLessThan(46);
    expect(pointsAdvance(6000, 0, 1, 0)).toBeCloseTo(32, 6);
  });

  it('COP: ralentí 22°, a fondo 25,7° a 3000 y 30° a 6000', () => {
    expect(copAdvance(800, -0.65)).toBeCloseTo(22, 6);
    expect(copAdvance(3000, 0)).toBeCloseTo(25.7, 1);
    expect(copAdvance(6000, 0)).toBeCloseTo(30, 6);
  });
});

describe('events — cortes en el paso (spec §11.1 y §11.12)', () => {
  it('un ciclo completo tiene 4 cortes exactos a 6500 rpm', () => {
    let count = 0;
    for (let deg = 0; deg < 720; deg += 39) {
      const d = Math.min(39, 720 - deg);
      count += sparkEvents(deg % 720, d, 30).length;
    }
    expect(count).toBe(4);
  });

  it('un corte cae en el paso que corresponde y con su desfase', () => {
    const events = sparkEvents(350, 20, 25); // corte en 360−25=335 no cae
    expect(events).toHaveLength(0);
    const next = sparkEvents(330, 20, 25); // 335 sí
    expect(next).toHaveLength(1);
    expect(next[0]?.cylinder).toBe(1);
    expect(next[0]?.offset).toBeCloseTo(5, 6);
  });

  it('chispa perdida: cada bobina dispara también 360° después', () => {
    expect(sparkEvents(0, 720, 25).length).toBe(4);
    expect(sparkEvents(0, 720, 25, true).length).toBe(8);
  });

  it('energía y voltajes: ½·L·i² y umbral pedido', () => {
    expect(IG.eta).toBe(0.5);
    const v = availableVoltageKv(0.096, 0.5);
    expect(v).toBeGreaterThan(30);
    expect(v).toBeLessThanOrEqual(35);
    expect(requiredVoltageKv(0.7, 6)).toBeCloseTo(10.4, 6);
    expect(requiredVoltageKv(1.6, 8.1)).toBeCloseTo(27.92, 2);
  });
});
