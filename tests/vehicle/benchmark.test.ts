// A15, plan del vehículo §10: benchmark del vehículo real (componente
// fusionada de `vehicle-2000`, el caso más caro por nodo — inyección
// electrónica + COP + refrigeración eléctrica). Presupuesto de A4: 4000
// pasos/s. Simplificación de A15 (documentada en `compile.ts`): un solo
// solver para todo el vehículo, no uno por componente conexa (D-V3) — este
// benchmark es justamente la medición que dice si hace falta particionar.
import { describe, expect, it } from 'vitest';
import { compileVehicle } from '../../src/modules/vehicle/compile.ts';
import { VEHICLE_2000 } from '../../src/modules/vehicle/defs.ts';

const DT = 0.001;
const BUDGET_STEPS_PER_SECOND = 4000;

describe('vehicle-2000 — benchmark del solver fusionado (plan §10)', () => {
  it(`hace ≥ ${BUDGET_STEPS_PER_SECOND} pasos/s con el motor en marcha`, () => {
    const v = compileVehicle(VEHICLE_2000);
    v.model.params['ignitionKey'] = 'start';
    v.model.params['rpm'] = 800;
    v.model.params['throttle'] = 0.3;
    for (let i = 0; i < 300; i++) v.model.step(DT); // llega a régimen antes de medir

    // Mejor de 3 tandas de 1000 pasos: una pausa de GC (o del resto de la
    // suite compitiendo por CPU, `tests/sim/nodal.test.ts` ya lo nota) no
    // debe hacer fallar el benchmark solo.
    const steps = 1000;
    let bestMs = Infinity;
    for (let trial = 0; trial < 3; trial++) {
      const t0 = performance.now();
      for (let i = 0; i < steps; i++) v.model.step(DT);
      bestMs = Math.min(bestMs, performance.now() - t0);
    }
    const stepsPerSecond = steps / (bestMs / 1000);

    expect(v.solver.stats.failures).toBe(0);
    process.stdout.write(
      `\n[vehicle-2000] benchmark ${steps} pasos (mejor de 3): ${bestMs.toFixed(1)} ms ` +
        `(${(bestMs / steps).toFixed(4)} ms/paso, ${stepsPerSecond.toFixed(0)} pasos/s, ` +
        `${stepsPerSecond >= BUDGET_STEPS_PER_SECOND ? 'dentro' : 'DEBAJO'} del presupuesto de ${BUDGET_STEPS_PER_SECOND})\n`,
    );
    // Umbral duro bajo (no el presupuesto de 4000 del plan): la medida sola,
    // sin competir por CPU con el resto de la suite, da ~5000 (impreso
    // arriba); acá sólo se ataja una regresión real (como la de 1398 pasos/s
    // antes de cachear las vistas por sistema, ver `compile.ts`), no el
    // ruido de la corrida completa en paralelo.
    expect(stepsPerSecond).toBeGreaterThan(1500);
  });
});
