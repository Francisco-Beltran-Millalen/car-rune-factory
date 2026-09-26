// Criterios de aceptación de docs/modules/fuel.md §9.
import { describe, it, expect } from 'vitest';
import { createRng } from '../../src/core/rng.ts';
import { createCompiledFuelModel } from '../../src/modules/fuel/circuit.ts';
import {
  createFuelModel,
  type FuelModel,
  type FuelOverrides,
  type FuelState,
  type IgnitionKey,
  type RegulatorState,
  type RelayState,
} from '../../src/modules/fuel/reference-model.ts';

const DT = 0.001;
function run(m: FuelModel, seconds: number): void {
  const n = Math.round(seconds / DT);
  for (let i = 0; i < n; i++) m.step(DT);
}
/** Contacto (cebado) → arranque → marcha, como lo haría una persona. */
function startEngine(m: FuelModel): void {
  m.params.ignitionKey = 'on';
  run(m, 2.5);
  m.params.ignitionKey = 'start';
  run(m, 1.5);
  m.params.ignitionKey = 'run';
  run(m, 2);
}
/** Promedio de una magnitud durante `seconds` (suaviza los pulsos de inyección). */
function avg(m: FuelModel, seconds: number, get: (s: FuelState) => number): number {
  const n = Math.round(seconds / DT);
  let sum = 0;
  for (let i = 0; i < n; i++) {
    m.step(DT);
    sum += get(m.state);
  }
  return sum / n;
}

type FuelFactory = (overrides?: FuelOverrides) => FuelModel;

/** La misma suite corre contra la referencia y contra el modelo compilado. */
const IMPLEMENTATIONS: [string, FuelFactory][] = [
  ['referencia', createFuelModel],
  ['compilado', createCompiledFuelModel],
];

describe.each(IMPLEMENTATIONS)('fuel model (%s) — §9', (name, create) => {
  it('1. cebado presuriza y mantiene la presión residual', () => {
    const m = create();
    m.params.ignitionKey = 'on';
    run(m, 1.5);
    expect(m.state.relayOn).toBe(true);
    expect(m.state.pRail).toBeGreaterThanOrEqual(2.8);
    expect(m.state.pRail).toBeLessThanOrEqual(3.3);
    run(m, 2.5);
    expect(m.state.relayOn).toBe(false);
    expect(m.state.pRail).toBeGreaterThan(2.5);
  });

  it('2. ralentí sano: 3 bar sobre el múltiple', () => {
    const m = create();
    startEngine(m);
    expect(m.state.engineState).toBe('running');
    run(m, 2);
    const dp = avg(m, 1, (s) => s.pRail - s.pMan);
    const p = avg(m, 1, (s) => s.pRail);
    expect(dp).toBeGreaterThanOrEqual(2.95);
    expect(dp).toBeLessThanOrEqual(3.15);
    expect(p).toBeGreaterThanOrEqual(2.3);
    expect(p).toBeLessThanOrEqual(2.5);
  });

  it('3. a fondo sostiene la presión con retorno', () => {
    const m = create();
    startEngine(m);
    m.params.throttle = 1;
    m.params.rpm = 6000;
    run(m, 3);
    const p = avg(m, 1, (s) => s.pRail);
    expect(p).toBeGreaterThanOrEqual(2.8);
    expect(p).toBeLessThanOrEqual(3.2);
    expect(m.state.qReturn).toBeGreaterThan(0);
    expect(m.state.engineState).toBe('running');
  });

  it('4. filtro tapado: cae la presión a fondo, en ralentí sigue andando', () => {
    const m = create({ faults: { filterClog: 1 } });
    startEngine(m);
    run(m, 2);
    expect(m.state.engineState).toBe('running');
    m.params.throttle = 1;
    m.params.rpm = 6000;
    run(m, 3);
    expect(avg(m, 1, (s) => s.pRail)).toBeLessThan(2.0);
    expect(['misfire', 'stalled']).toContain(m.state.engineState);
  });

  it('5. manguera de vacío suelta sube la presión en ralentí', () => {
    const a = create();
    const b = create({ faults: { vacuumHoseOff: true } });
    startEngine(a);
    startEngine(b);
    run(a, 2);
    run(b, 2);
    const pa = avg(a, 1, (s) => s.pRail);
    const pb = avg(b, 1, (s) => s.pRail);
    expect(pb - pa).toBeGreaterThanOrEqual(0.55);
  });

  it('6. regulador pegado cerrado: sin retorno, presión al límite de la bomba', () => {
    const m = create({ faults: { regulator: 'stuckClosed' } });
    startEngine(m);
    run(m, 3);
    expect(m.state.pRail).toBeGreaterThan(4.5);
    expect(m.state.qReturn).toBe(0);
  });

  it('7. bomba gastada + batería baja no alcanza a fondo', () => {
    const m = create({ params: { batteryV: 11 }, faults: { pumpWear: 1 } });
    startEngine(m);
    m.params.throttle = 1;
    m.params.rpm = 6000;
    run(m, 4);
    expect(m.state.engineState).not.toBe('running');
  });

  it('8. inyector goteando pierde la presión residual; sano la mantiene', () => {
    const leak = create({ faults: { injectorLeak: 1 } });
    const ok = create();
    for (const m of [leak, ok]) {
      m.params.ignitionKey = 'on';
      run(m, 2.5);
    }
    run(leak, 60);
    run(ok, 60);
    expect(leak.state.pRail).toBeLessThan(1);
    expect(ok.state.pRail).toBeGreaterThan(2.5);
  });

  it('9. estanque casi vacío: la bomba aspira aire', () => {
    const low = create({ tankLevel: 0.2 });
    const full = create();
    for (const m of [low, full]) {
      m.params.ignitionKey = 'on';
      m.step(DT);
    }
    expect(low.state.pickupAir).toBeGreaterThan(0.7);
    const ratio = low.state.qPump / full.state.qPump;
    // Las dos implementaciones resuelven q = Qm(1−Δp/Pm)(1−aire) de forma
    // implícita (A6b): el ratio queda ~2,6 % sobre 1−aire porque el aire
    // también reduce la caída resistiva (§9d de fuel.md).
    expect(ratio).toBeGreaterThan(0.19);
    expect(ratio).toBeLessThan(0.215);
    expect(low.state.pickupAir).toBeCloseTo(0.8, 2);
  });

  it(
    '10. robustez: combinaciones aleatorias nunca dan NaN y la presión queda acotada',
    () => {
    const rng = createRng(99);
    const keys: IgnitionKey[] = ['off', 'on', 'start', 'run'];
    const relays: RelayState[] = ['ok', 'intermittent', 'dead'];
    const regulators: RegulatorState[] = ['ok', 'stuckOpen', 'stuckClosed'];
    // El compilado tarda ~10× por paso: fuzz reducido (P23 §9, fila A6).
    const cases = name === 'compilado' ? 200 : 1000;
    const steps = name === 'compilado' ? 1000 : 2000;
    for (let k = 0; k < cases; k++) {
      const m = create({
        seed: k,
        tankLevel: rng.range(0, 50),
        params: {
          ignitionKey: rng.pick(keys),
          rpm: rng.range(0, 6500),
          throttle: rng.next(),
          batteryV: rng.range(10, 14.5),
          fastConsumption: rng.chance(0.5),
        },
        faults: {
          strainerClog: rng.next(),
          filterClog: rng.next(),
          pumpWear: rng.next(),
          relay: rng.pick(relays),
          regulator: rng.pick(regulators),
          vacuumHoseOff: rng.chance(0.5),
          injectorLeak: rng.next(),
          lineLeak: rng.next(),
        },
      });
      for (let i = 0; i < steps; i++) {
        if (i === Math.floor(steps / 2)) m.params.ignitionKey = rng.pick(keys);
        m.step(DT);
      }
      for (const [name, v] of Object.entries(m.state) as [string, unknown][]) {
        if (typeof v === 'number') expect(Number.isFinite(v), `${name} en caso ${k}`).toBe(true);
      }
      // La referencia clampa pRail ≥ 0; el solver no, y permite que el riel
      // baje hasta la presión del múltiple (≥ −0,65 bar): ahí el goteo hacia
      // el múltiple deja de fluir. A6b justifica al solver en fuel.md §9d.
      const floor = name === 'compilado' ? -0.7 : 0;
      expect(m.state.pRail).toBeGreaterThanOrEqual(floor);
      expect(m.state.pRail).toBeLessThanOrEqual(7.5);
    }
    },
    30_000,
  );

  it('11. determinismo', () => {
    const mk = () => create({ faults: { relay: 'intermittent' } });
    const a = mk();
    const b = mk();
    startEngine(a);
    startEngine(b);
    a.params.throttle = b.params.throttle = 0.6;
    run(a, 5);
    run(b, 5);
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
  });

  it('reset vuelve al estado inicial conservando los objetos', () => {
    const m = create();
    const { params, faults, state } = m;
    startEngine(m);
    m.faults.filterClog = 1;
    m.reset();
    expect(m.params).toBe(params);
    expect(m.faults).toBe(faults);
    expect(m.state).toBe(state);
    expect(m.state.engineState).toBe('off');
    expect(m.faults.filterClog).toBe(0);
    expect(m.time).toBe(0);
  });

  it('reset vuelve a los overrides de creación, no a los valores por defecto', () => {
    const m = create({ params: { rpm: 3000 }, faults: { filterClog: 0.5 } });
    m.params.rpm = 5000;
    m.faults.filterClog = 1;
    m.reset();
    expect(m.params.rpm).toBe(3000);
    expect(m.faults.filterClog).toBe(0.5);
  });

  it('robustez: un NaN en cualquier parámetro numérico no contamina el estado (§6)', () => {
    const numeric = [
      ['params', 'rpm'],
      ['params', 'throttle'],
      ['params', 'batteryV'],
      ['faults', 'strainerClog'],
      ['faults', 'filterClog'],
      ['faults', 'pumpWear'],
      ['faults', 'injectorLeak'],
      ['faults', 'lineLeak'],
    ] as const;
    for (const [group, key] of numeric) {
      const m = create();
      startEngine(m);
      if (group === 'params') m.params[key] = NaN;
      else m.faults[key] = NaN;
      run(m, 1);
      for (const [name, v] of Object.entries(m.state) as [string, unknown][]) {
        if (typeof v === 'number') expect(Number.isFinite(v), `${name} con ${key}=NaN`).toBe(true);
      }
    }
  });

  it('inyectores pulsan en orden 1-3-4-2', () => {
    const m = create();
    startEngine(m);
    const order: number[] = [];
    let prev = [false, false, false, false];
    for (let i = 0; i < 400; i++) {
      m.step(DT);
      m.state.injectors.forEach((inj, k) => {
        if (inj.open && !prev[k]) order.push(k + 1);
      });
      prev = m.state.injectors.map((x) => x.open);
    }
    const seq = order.join('');
    expect('13421342134213421342').toContain(seq.slice(0, 8));
  });
});
