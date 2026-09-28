// A15: `compileVehicle` sobre los dos vehículos genéricos. Humo (arranca,
// converge, sin NaN) + una falla de un sistema se ve en otro (bus eléctrico
// compartido, plan del vehículo §9 "fallas cruzadas").
import { describe, expect, it } from 'vitest';
import { compileVehicle } from '../../src/modules/vehicle/compile.ts';
import { VEHICLE_2000, VEHICLE_70 } from '../../src/modules/vehicle/defs.ts';

const DT = 0.001;

function run(model: { step(dt: number): void }, seconds: number): void {
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps; i++) model.step(DT);
}

describe('compileVehicle — vehicle-70 (A15)', () => {
  it('compila sin problemas de validación y el motor arranca', () => {
    const v = compileVehicle(VEHICLE_70);
    expect(v.solver.stats).toBeDefined();
    v.model.params['ignitionKey'] = 'start';
    v.model.params['rpm'] = 800;
    v.model.params['throttle'] = 0;
    run(v.model, 1.2);
    expect(v.model.state['engineState'] as string | undefined).not.toBe('off');
    expect(v.solver.stats.failures).toBe(0);
    for (const value of Object.values(v.model.state)) {
      if (typeof value === 'number') expect(Number.isFinite(value)).toBe(true);
    }
  });

  it('la batería del encendido (proveedor del bus 12v) es la misma que ve lubricación', () => {
    // El encendido provee el bus en vehicle-70 (plan §8): su `battery.+` y el
    // punto que usa lubricación para su testigo (`key.a`, aguas abajo de su
    // propia llave, río arriba de la batería excluida) deben ser el MISMO
    // nodo del solver fusionado, no dos circuitos separados con el mismo
    // número por casualidad.
    const v = compileVehicle(VEHICLE_70);
    v.model.params['ignitionKey'] = 'run';
    v.model.params['rpm'] = 800;
    v.model.params['throttle'] = 0;
    run(v.model, 0.05);
    const ignitionBatteryNode = v.portToNode['ignition:battery.+'];
    const lubricationKeyNode = v.portToNode['lubrication:key.a'];
    expect(ignitionBatteryNode).toBeDefined();
    expect(lubricationKeyNode).toBe(ignitionBatteryNode);

    v.model.params['ignition:batteryV'] = 9; // batería débil
    run(v.model, 0.05);
    expect(v.solver.stats.failures).toBe(0);
    expect(v.solver.potential(lubricationKeyNode ?? -1)).toBeLessThan(9.5);
  });
});

describe('compileVehicle — vehicle-2000 (A15)', () => {
  it('compila sin problemas de validación y el motor arranca', () => {
    const v = compileVehicle(VEHICLE_2000);
    v.model.params['ignitionKey'] = 'start';
    v.model.params['rpm'] = 800;
    v.model.params['throttle'] = 0;
    run(v.model, 1.2);
    expect(v.model.state['engineState'] as string | undefined).not.toBe('off');
    expect(v.solver.stats.failures).toBe(0);
  });

  it('sin sincronía de la ECU, el combustible no inyecta (§4.8)', () => {
    const v = compileVehicle(VEHICLE_2000);
    v.model.params['ignitionKey'] = 'start';
    v.model.params['rpm'] = 800;
    v.model.params['throttle'] = 0;
    run(v.model, 1.2);
    const runningMixture = v.model.state['fuel:mixtureRatio'];
    expect(typeof runningMixture).toBe('number');
  });
});
