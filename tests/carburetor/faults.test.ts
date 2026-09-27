// Fallas del carburador sobre el modelo completo (A16, spec carburetor §11:
// tests 5, 6, 8, 9 y 10).
import { describe, expect, it } from 'vitest';
import { createCarburetorModel, type CarburetorModel } from '../../src/modules/carburetor/circuit.ts';

function run(m: CarburetorModel, seconds: number): void {
  const n = Math.round(seconds / 0.001);
  for (let i = 0; i < n; i++) m.step(0.001);
}

describe('idleJetClog = 1 (test §11.5)', () => {
  it('se apaga en ralentí pero anda bien en carretera', () => {
    const idle = createCarburetorModel({ params: { rpm: 800, throttle: 0 }, faults: { idleJetClog: 1 } });
    run(idle, 3);
    expect(idle.state.mixture).toBeLessThan(0.1);

    const cruising = createCarburetorModel({ params: { rpm: 3000, throttle: 0.3 }, faults: { idleJetClog: 1 } });
    run(cruising, 3);
    expect(cruising.state.mixture).toBeGreaterThan(0.85);
  });
});

describe('mainJetClog = 0,6 (test §11.6)', () => {
  it('pobre a fondo y alto régimen; ralentí sano', () => {
    const wot = createCarburetorModel({ params: { rpm: 6000, throttle: 1 }, faults: { mainJetClog: 0.6 } });
    run(wot, 3);
    expect(wot.state.mixture).toBeLessThan(0.55);

    const idle = createCarburetorModel({ params: { rpm: 800, throttle: 0 }, faults: { mainJetClog: 0.6 } });
    run(idle, 3);
    expect(idle.state.mixture).toBeGreaterThan(0.95);
  });
});

describe('needleStuck a fondo, 6000 rpm (test §11.8)', () => {
  it('la cuba se vacía en 4-9 s y la mezcla termina cayendo bajo 0,4', () => {
    const model = createCarburetorModel({ params: { rpm: 6000, throttle: 1 }, faults: { needleStuck: true } });
    let emptyAt: number | null = null;
    let minMixture = Infinity;
    // `disponible` (spec §5.4) sólo empieza a limitar bajo 0,01 L: la mezcla
    // se desploma un poco después de que la cuba cruza ese nivel, no en el
    // mismo instante.
    for (let i = 0; i < 12000; i++) {
      model.step(0.001);
      if (emptyAt === null && model.state.bowlLevel < 0.01) emptyAt = model.time;
      if (emptyAt !== null) minMixture = Math.min(minMixture, model.state.mixture);
    }
    expect(emptyAt).not.toBeNull();
    expect(emptyAt!).toBeGreaterThanOrEqual(4);
    expect(emptyAt!).toBeLessThanOrEqual(9);
    expect(minMixture).toBeLessThan(0.4);
  });
});

describe('floatPunctured en ralentí (test §11.9)', () => {
  it('la cuba rebalsa antes de 20 s y la mezcla se dispara', () => {
    const model = createCarburetorModel({ params: { rpm: 800, throttle: 0 }, faults: { floatPunctured: true } });
    run(model, 20);
    expect(model.state.flooding).toBe(true);
    expect(model.state.mixture).toBeGreaterThan(1.9);
  });

  it('la cuba llega a rebalsar dentro de los primeros 20 s', () => {
    const model = createCarburetorModel({ params: { rpm: 800, throttle: 0 }, faults: { floatPunctured: true } });
    let floodedAt: number | null = null;
    for (let i = 0; i < 20000 && floodedAt === null; i++) {
      model.step(0.001);
      if (model.state.flooding) floodedAt = model.time;
    }
    expect(floodedAt).not.toBeNull();
    expect(floodedAt!).toBeLessThan(20);
  });
});

describe('pumpWear = 0,8 (test §11.10)', () => {
  it('a fondo a 4000 rpm la cuba baja de 0,01 L antes de 90 s', () => {
    const model = createCarburetorModel({ params: { rpm: 4000, throttle: 1 }, faults: { pumpWear: 0.8 } });
    let low: number | null = null;
    for (let i = 0; i < 90000 && low === null; i++) {
      model.step(0.001);
      if (model.state.bowlLevel < 0.01) low = model.time;
    }
    expect(low).not.toBeNull();
    expect(low!).toBeLessThan(90);
  });

  it('en crucero (3000 rpm / 0,3) se sostiene sobre 0,04 L durante 120 s', () => {
    const model = createCarburetorModel({ params: { rpm: 3000, throttle: 0.3 }, faults: { pumpWear: 0.8 } });
    let min = Infinity;
    for (let i = 0; i < 120000; i++) {
      model.step(0.001);
      min = Math.min(min, model.state.bowlLevel);
    }
    expect(min).toBeGreaterThan(0.04);
  });
});
