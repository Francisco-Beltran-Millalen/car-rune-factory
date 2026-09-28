// A5: un test por elemento con su ley y el jacobiano contra diferencias
// finitas (error relativo < 1e-4). Referencias: P23 §8.2 y solver.md §7.
import { describe, expect, it } from 'vitest';
import {
  ELEMENT_TYPES,
  createAdvection,
  createBattery,
  createBreach,
  createCentrifugalPump,
  createCheckValve,
  createCurrentLoad,
  createDisplacementPump,
  createElectricPump,
  createFlowSource,
  createHeatCapacity,
  createHeatSource,
  createJunction,
  createLeak,
  createLinearRestrictor,
  createOrifice,
  createPressureSource,
  createReliefRegulator,
  createResistor,
  createRestrictor,
  createSwitch,
  createTank,
  createTee,
  createThermalConductance,
  createVariableOrifice,
  createVolume,
} from '../../src/sim/elements/index.ts';
import { createSolver } from '../../src/sim/solver/nodal.ts';
import type { ElementDef, EvalOut } from '../../src/sim/solver/types.ts';

interface Evaluated {
  flow: Float64Array;
  jac: Float64Array;
}

function evaluate(def: ElementDef, pot: readonly number[], dt = 0.001): Evaluated {
  const k = def.ports.length;
  const out: EvalOut = { flow: new Float64Array(k), jac: new Float64Array(k * k) };
  def.eval(Float64Array.from(pot), out, dt);
  return { flow: out.flow, jac: out.jac };
}

/** Compara `jac[p*k+q]` con la derivada central. La tolerancia mezcla absoluta
 *  (1e-9, para entradas exactamente nulas) y relativa (1e-4). */
function checkJacobian(def: ElementDef, pot: readonly number[], label: string): void {
  const k = def.ports.length;
  const jac = evaluate(def, pot).jac;
  const h = 1e-6;
  for (let q = 0; q < k; q++) {
    const plus = [...pot];
    plus[q] = (plus[q] ?? 0) + h;
    const minus = [...pot];
    minus[q] = (minus[q] ?? 0) - h;
    const fp = evaluate(def, plus).flow;
    const fm = evaluate(def, minus).flow;
    for (let p = 0; p < k; p++) {
      const fd = ((fp[p] ?? 0) - (fm[p] ?? 0)) / (2 * h);
      const an = jac[p * k + q] ?? 0;
      const tolerance = 1e-9 + 1e-4 * Math.abs(fd);
      expect(Math.abs(an - fd), `${label}: ∂flow${p}/∂pot${q} (an=${an}, fd=${fd})`).toBeLessThan(
        tolerance,
      );
    }
  }
}

describe('elementos — ley y jacobiano (§8.2)', () => {
  it('restrictor: q = Δp/√(k(|Δp|+ε)) y `clog` escala k', () => {
    const restrictor = createRestrictor({ k: 1e-3, clogFactor: 1000 }, 'fuel');
    const dp = 2;
    const q = -(evaluate(restrictor, [3 + dp, 3]).flow[0] ?? 0);
    expect(q).toBeCloseTo(dp / Math.sqrt(1e-3 * (dp + 1e-4)), 9);

    restrictor.control['clog'] = 1;
    const qClog = -(evaluate(restrictor, [3 + dp, 3]).flow[0] ?? 0);
    expect(qClog).toBeCloseTo(dp / Math.sqrt(1e-3 * 1001 * (dp + 1e-4)), 9);

    checkJacobian(restrictor, [3, 1], 'restrictor Δp=2');
    checkJacobian(restrictor, [1, 3], 'restrictor Δp=−2');
    checkJacobian(restrictor, [1e-3, 0], 'restrictor Δp≈0');
  });

  it('checkValve: conduce en directo y bloquea en inversa', () => {
    const valve = createCheckValve({ g: 100 }, 'fuel');
    expect(-(evaluate(valve, [0.5, 0]).flow[0] ?? 0)).toBeCloseTo(50, 9);
    expect(-(evaluate(valve, [-0.5, 0]).flow[0] ?? 0)).toBeCloseTo(-5e-5, 12);
    // En la transición (0,02 bar) la conductancia va a la mitad.
    const q = -(evaluate(valve, [0.01, 0]).flow[0] ?? 0);
    expect(q).toBeCloseTo(0.5000005, 6);

    checkJacobian(valve, [0.01, 0], 'checkValve transición');
    checkJacobian(valve, [0.5, 0], 'checkValve abierta');
    checkJacobian(valve, [-0.5, 0], 'checkValve cerrada');
  });

  it('leak: q = k·s·√(p⁺) y se pierde', () => {
    const leak = createLeak({ k: 2 }, 'fuel');
    leak.control['severity'] = 1;
    expect(-(evaluate(leak, [4]).flow[0] ?? 0)).toBeCloseTo((2 * 4) / Math.sqrt(4.0001), 9);
    leak.control['severity'] = 0.5;
    expect(-(evaluate(leak, [4]).flow[0] ?? 0)).toBeCloseTo(4 / Math.sqrt(4.0001), 9);
    expect(evaluate(leak, [-1]).flow[0]).toBeCloseTo(0, 12);

    checkJacobian(leak, [4], 'leak p=4');
    checkJacobian(leak, [1e-3], 'leak p≈0');
    checkJacobian(leak, [-1], 'leak p<0');
  });

  it('volume: sólo capacitancia, ya en flujo/(bar·s)', () => {
    const volume = createVolume({ c: 0.005 }, 'fuel');
    expect(volume.capacitance?.['a']).toBeCloseTo(0.005 * 3600, 12);
    expect(evaluate(volume, [3]).flow[0]).toBe(0);
    checkJacobian(volume, [3], 'volume');
  });

  it('tee: no aporta flujos', () => {
    const tee = createTee({}, 'fuel');
    expect(tee.ports).toHaveLength(3);
    expect([...evaluate(tee, [1, 2, 3]).flow]).toEqual([0, 0, 0]);
    checkJacobian(tee, [1, 2, 3], 'tee');
  });

  it('electricPump: curva, guarda de V y desgaste', () => {
    const pump = createElectricPump({}, 'fuel');
    const nominal = evaluate(pump, [13.5, 0, 0, 3]);
    expect(-(nominal.flow[2] ?? 0)).toBeCloseTo(120 * (1 - 3 / 6.51), 9);
    expect(nominal.flow[0] ?? 0).toBeCloseTo(-(1.5 + (5.5 * 3) / 6.51), 9);

    // Guarda: V = 0 con Δp = 3 bar → todo finito, q = 0.
    const guard = evaluate(pump, [0, 0, 0, 3]);
    expect(guard.flow[2]).toBeCloseTo(0, 12);
    expect(guard.flow[0]).toBeCloseTo(0, 12);

    pump.control['air'] = 1;
    expect(evaluate(pump, [13.5, 0, 0, 3]).flow[3]).toBeCloseTo(0, 12);
    pump.control['air'] = 0;

    pump.control['wear'] = 1;
    const worn = evaluate(pump, [13.5, 0, 0, 1]);
    expect(-(worn.flow[2] ?? 0)).toBeCloseTo(120 * 0.3 * (1 - 1 / 3.26), 9);
    pump.control['wear'] = 0;

    checkJacobian(pump, [13.5, 0, 0, 3], 'pump nominal');
    checkJacobian(pump, [12, 0, 0, 1], 'pump 12 V');
    checkJacobian(pump, [0.4, 0, 0, 3], 'pump guarda');
  });

  it('reliefRegulator: setpoint, sin retorno y referencia', () => {
    const regulator = createReliefRegulator({ k: 1000, set: 3 }, 'fuel');
    expect(-(evaluate(regulator, [4, 0, 0]).flow[0] ?? 0)).toBeCloseTo(1000, 6);
    expect(evaluate(regulator, [2, 0, 0]).flow[0]).toBeCloseTo(0, 12);

    checkJacobian(regulator, [4, 0, 0], 'regulador abierto');
    checkJacobian(regulator, [3.005, 0, 0], 'regulador transición');
    checkJacobian(regulator, [2, 0, 0], 'regulador cerrado');
    checkJacobian(regulator, [4, 0, -1], 'regulador con referencia');

    regulator.control['noReturn'] = true;
    expect(evaluate(regulator, [6, 0, 0]).flow[0]).toBeCloseTo(0, 12);
    regulator.control['noReturn'] = false;

    regulator.control['set'] = 0.8;
    expect(-(evaluate(regulator, [1.8, 0, 0]).flow[0] ?? 0)).toBeCloseTo(1000, 6);
  });

  it('orifice: abierto √Δp, cerrado con fuga por severidad', () => {
    const injector = createOrifice({ k: 12 / Math.sqrt(3), leakCoeff: 0.6 }, 'fuel');
    injector.control['open'] = true;
    const kInj = 12 / Math.sqrt(3);
    expect(-(evaluate(injector, [3.65, 0.65]).flow[0] ?? 0)).toBeCloseTo(
      (kInj * 3) / Math.sqrt(3.0001),
      9,
    );
    checkJacobian(injector, [3.65, 0.65], 'orifice abierto');
    checkJacobian(injector, [0.001, 0], 'orifice abierto Δp≈0');

    injector.control['open'] = false;
    injector.control['leak'] = 1;
    expect(-(evaluate(injector, [3.65, 0.65]).flow[0] ?? 0)).toBeCloseTo(
      (0.6 * 3) / Math.sqrt(3.0001),
      6,
    );
    checkJacobian(injector, [3.65, 0.65], 'orifice fuga');

    injector.control['leak'] = 0;
    expect(evaluate(injector, [3.65, 0.65]).flow[0]).toBeCloseTo(0, 12);
  });

  it('tank: nivel, commit con la reacción, probes e init', () => {
    const tank = createTank({ capacity: 50, pickupLow: 1 }, 'fuel');
    const state = tank.state;
    expect(tank.probes?.['level']?.(new Float64Array(2))).toBe(40);
    expect(tank.probes?.['pickupAir']?.(new Float64Array(2))).toBe(0);

    state['level'] = 0.5;
    expect(tank.probes?.['pickupAir']?.(new Float64Array(2))).toBeCloseTo(0.5, 12);

    // 36 L/h de neto durante 1 s → 0,01 L.
    tank.commit(new Float64Array(2), 1, new Float64Array([36, 36]));
    expect(state['level']).toBeCloseTo(0.49, 9);
    tank.control['fast'] = true;
    tank.commit(new Float64Array(2), 1, new Float64Array([36, 36]));
    expect(state['level']).toBeCloseTo(0, 9);
    tank.control['fast'] = false;

    tank.init?.({ tankLevel: 75 });
    expect(state['level']).toBe(50);
    tank.init?.({ tankLevel: 20 });
    expect(state['level']).toBe(20);
    tank.init?.({ tankLevel: Number.NaN });
    expect(state['level']).toBe(40);

    const fixedOut = new Float64Array(2).fill(NaN);
    tank.fixed?.(fixedOut);
    expect([...fixedOut]).toEqual([0, 0]);
    checkJacobian(tank, [0, 0], 'tank');
  });

  it('pressureSource: fija su nodo con control.p', () => {
    const source = createPressureSource({}, 'fuel');
    source.control['p'] = -0.65;
    const fixedOut = new Float64Array(1).fill(NaN);
    source.fixed?.(fixedOut);
    expect(fixedOut[0]).toBeCloseTo(-0.65, 12);
    expect(evaluate(source, [-0.65]).flow[0]).toBe(0);
    checkJacobian(source, [-0.65], 'pressureSource');
  });

  it('battery: V = control.v − R·I', () => {
    const battery = createBattery({ r: 0.02 });
    battery.control['v'] = 12.6;
    expect(evaluate(battery, [12.6, 0]).flow[0]).toBeCloseTo(0, 9);
    expect(evaluate(battery, [12, 0]).flow[0]).toBeCloseTo(30, 9);
    expect(battery.probes?.['i']?.(new Float64Array([12, 0]))).toBeCloseTo(30, 9);
    checkJacobian(battery, [12, 0], 'battery');
  });

  it('switch y resistor: conductancias', () => {
    const sw = createSwitch({ rOn: 0.01, rOff: 1e7 });
    sw.control['closed'] = true;
    expect(-(evaluate(sw, [1, 0]).flow[0] ?? 0)).toBeCloseTo(100, 6);
    sw.control['closed'] = false;
    expect(-(evaluate(sw, [1, 0]).flow[0] ?? 0)).toBeCloseTo(1e-7, 12);
    checkJacobian(sw, [1, 0], 'switch');

    const resistor = createResistor({ r: 10 });
    expect(-(evaluate(resistor, [10, 0]).flow[0] ?? 0)).toBeCloseTo(1, 12);
    expect(resistor.probes?.['q']?.(new Float64Array([10, 0]))).toBeCloseTo(1, 12);
    checkJacobian(resistor, [10, 0], 'resistor');
  });

  it('switch con rampMs: conductancia log-lineal en `commit`, no en `eval` (§24)', () => {
    const sw = createSwitch({ rOn: 0.01, rOff: 1e7, rampMs: 20 });
    sw.control['closed'] = true;
    // Recién creado (p=0): eval no se mueve solo, sólo `commit` avanza `p`.
    expect(-(evaluate(sw, [1, 0]).flow[0] ?? 0)).toBeCloseTo(1e-7, 12);
    const zero = new Float64Array(2);
    for (let i = 0; i < 20; i++) sw.commit(zero, 0.001, zero);
    expect(-(evaluate(sw, [1, 0]).flow[0] ?? 0)).toBeCloseTo(100, 6);
    sw.control['closed'] = false;
    for (let i = 0; i < 20; i++) sw.commit(zero, 0.001, zero);
    expect(-(evaluate(sw, [1, 0]).flow[0] ?? 0)).toBeCloseTo(1e-7, 12);
  });

  it('breach: cruce de fluidos gateado por `severity` (A15 §10.4)', () => {
    const breach = createBreach({ k: 1e-3 }, 'coolant', 'oil');
    expect(breach.ports.map((p) => p.fluid)).toEqual(['coolant', 'oil']);
    expect(evaluate(breach, [3, 1]).flow[0]).toBe(0); // sin falla no fluye
    breach.control['severity'] = 1;
    const dp = 2;
    const q = -(evaluate(breach, [3, 1]).flow[0] ?? 0);
    expect(q).toBeCloseTo(dp / Math.sqrt(1e-3 * (dp + 1e-4)), 6);
    expect(breach.probes?.['q']?.(new Float64Array([3, 1]))).toBeCloseTo(q, 6);
    checkJacobian(breach, [3, 1], 'breach');
  });

  it('currentLoad: I = control.i·ramp con jacobiano suave', () => {
    const load = createCurrentLoad({});
    load.control['i'] = 2;
    expect(-(evaluate(load, [12, 0]).flow[0] ?? 0)).toBeCloseTo(2, 9);
    expect(-(evaluate(load, [0.5, 0]).flow[0] ?? 0)).toBeCloseTo(1, 9);
    expect(-(evaluate(load, [-1, 0]).flow[0] ?? 0)).toBeCloseTo(0, 12);
    expect(load.probes?.['i']?.(new Float64Array([12, 0]))).toBeCloseTo(2, 9);
    checkJacobian(load, [12, 0], 'currentLoad ΔV=12');
    checkJacobian(load, [0.5, 0], 'currentLoad rampa');
    checkJacobian(load, [1.5, 0.8], 'currentLoad ΔV=0,7');
  });

  it('centrifugalPump: ley de la bomba centrífuga (A13)', () => {
    const pump = createCentrifugalPump({ qMax: 9000, pMax: 1.5, nRef: 6000 }, 'coolant');
    pump.control['n'] = 6000;
    const q0 = -(evaluate(pump, [0, 0]).flow[0] ?? 0);
    expect(q0).toBeCloseTo(9000 / Math.sqrt(1 + 1e-4), 3);
    expect(-(evaluate(pump, [0, 0.75]).flow[0] ?? 0)).toBeCloseTo(
      9000 * (0.5 / Math.sqrt(0.5 + 1e-4)),
      3,
    );
    pump.control['n'] = 3000;
    expect(-(evaluate(pump, [0, 0]).flow[0] ?? 0)).toBeCloseTo(4500 / Math.sqrt(1 + 1e-4), 3);
    pump.control['n'] = 6000;
    pump.control['air'] = 0.5;
    expect(-(evaluate(pump, [0, 0]).flow[0] ?? 0)).toBeCloseTo(q0 * 0.5, 3);
    pump.control['air'] = 0;
    checkJacobian(pump, [0, 0.5], 'centrifugalPump');
  });

  it('variableOrifice: g controla la conductancia (A13)', () => {
    const vo = createVariableOrifice({ gOpen: 1000, gLeak: 0 }, 'coolant');
    vo.control['open'] = 0.5;
    const k = 1 / (500 * 500);
    const dp = 0.5;
    expect(-(evaluate(vo, [dp, 0]).flow[0] ?? 0)).toBeCloseTo(dp / Math.sqrt(k * (dp + 1e-4)), 6);
    checkJacobian(vo, [0.5, 0], 'variableOrifice');
    vo.control['open'] = 0;
    expect(-(evaluate(vo, [dp, 0]).flow[0] ?? 0)).toBeCloseTo(0, 12);
  });

  it('displacementPump: caudal por revoluciones menos la fuga interna (A14)', () => {
    const pump = createDisplacementPump({ disp: 6.67e-3, slip: 20, pMax: 0 }, 'oil');
    pump.control['n'] = 3000;
    const q = -(evaluate(pump, [0, 1]).flow[0] ?? 0);
    expect(q).toBeCloseTo(6.67e-3 * 3000 * 60 - 20, 6);
    checkJacobian(pump, [0, 1], 'displacementPump');
    const limited = createDisplacementPump({ disp: 6.67e-3, slip: 0, pMax: 2 }, 'oil');
    limited.control['n'] = 3000;
    expect(-(evaluate(limited, [0, 2]).flow[0] ?? 0)).toBeCloseTo(0, 3);
    limited.control['air'] = 1;
    expect(-(evaluate(limited, [0, 0]).flow[0] ?? 0)).toBeCloseTo(0, 9);
  });

  it('flowSource: caudal impuesto, jacobiano nulo (A16)', () => {
    const source = createFlowSource({}, 'fuel');
    source.control['q'] = 42;
    expect(-(evaluate(source, [0.2, 0]).flow[0] ?? 0)).toBeCloseTo(42, 9);
    expect(evaluate(source, [0.2, 0]).flow[1]).toBeCloseTo(42, 9);
    checkJacobian(source, [0.2, 0], 'flowSource');
    source.control['q'] = 0;
    expect(evaluate(source, [5, -3]).flow[0]).toBeCloseTo(0, 12);
    expect(evaluate(source, [5, -3]).flow[1]).toBeCloseTo(0, 12);
  });

  it('linearRestrictor: q = g·Δp (A14)', () => {
    const res = createLinearRestrictor({ g: 260 }, 'oil');
    expect(-(evaluate(res, [1, 0]).flow[0] ?? 0)).toBeCloseTo(260, 9);
    checkJacobian(res, [0.5, 0.2], 'linearRestrictor');
  });

  it('tank: el control `drain` baja el nivel sin pasar por la red (A14)', () => {
    const tank = createTank({ capacity: 5 }, 'oil');
    tank.init?.({ tankLevel: 4 });
    tank.control['drain'] = 3600;
    tank.commit(new Float64Array([0, 0]), 1, new Float64Array([0, 0]));
    expect(tank.probes?.['level']?.(new Float64Array(2))).toBeCloseTo(3, 6);
  });

  it('heatSource, thermalConductance, advection y heatCapacity (A13)', () => {
    const source = createHeatSource({});
    source.control['q'] = 1000;
    const heat = evaluate(source, [25]);
    expect(heat.flow[0]).toBe(1000);
    expect(heat.jac[0]).toBe(0);

    const conductance = createThermalConductance({ g: 100 });
    const cond = evaluate(conductance, [90, 20]);
    expect(-(cond.flow[0] ?? 0)).toBeCloseTo(7000, 6);
    expect(cond.flow[1]).toBeCloseTo(7000, 6);
    checkJacobian(conductance, [90, 20], 'thermalConductance');

    const advection = createAdvection({ mc: 500 });
    const adv = evaluate(advection, [90, 60]);
    expect(adv.flow[0]).toBe(0);
    expect(adv.flow[1]).toBeCloseTo(15000, 6);
    checkJacobian(advection, [90, 60], 'advection');
  });

  it('advection conserva la energía en un lazo cerrado de 3 nodos', () => {
    const mc = 500;
    const cap = 1000;
    const solver = createSolver({
      nodeCount: 3,
      elements: [
        { def: createAdvection({ mc }), nodes: [0, 1] },
        { def: createAdvection({ mc }), nodes: [1, 2] },
        { def: createAdvection({ mc }), nodes: [2, 0] },
        { def: createHeatCapacity({ c: cap }), nodes: [0] },
        { def: createHeatCapacity({ c: cap }), nodes: [1] },
        { def: createHeatCapacity({ c: cap }), nodes: [2] },
      ],
    });
    solver.setPotential(0, 80);
    solver.setPotential(1, 40);
    solver.setPotential(2, 20);
    const total = (): number =>
      cap * (solver.potential(0) + solver.potential(1) + solver.potential(2));
    const before = total();
    for (let i = 0; i < 2000; i++) solver.step(0.001);
    expect(solver.stats.failures).toBe(0);
    expect(Math.abs(total() - before)).toBeLessThan(Math.abs(before) * 1e-6);
  });

  it('junction: todos los puertos son un nodo sin flujos', () => {
    const junction = createJunction();
    expect(junction.ports).toHaveLength(6);
    const out = evaluate(junction, [3, 3, 3, 3, 3, 3]);
    for (const f of out.flow) expect(f).toBe(0);
    for (const j of out.jac) expect(j).toBe(0);
  });

  it('el registro tiene todos los tipos con fábrica', () => {
    const types = [
      'restrictor',
      'checkValve',
      'leak',
      'volume',
      'tee',
      'electricPump',
      'reliefRegulator',
      'orifice',
      'tank',
      'pressureSource',
      'battery',
      'resistor',
      'switch',
      'currentLoad',
      'junction',
      'centrifugalPump',
      'variableOrifice',
      'displacementPump',
      'linearRestrictor',
      'flowSource',
      'heatSource',
      'temperatureSource',
      'thermalConductance',
      'advection',
      'heatCapacity',
      'thermalNode',
      'hydroNode',
      'breach',
      'visual',
    ];
    for (const type of types) {
      expect(ELEMENT_TYPES[type]?.create, type).toBeDefined();
    }
    expect(Object.keys(ELEMENT_TYPES)).toHaveLength(types.length);
  });
});
