// Transitorio de bencina y bomba de aceleración (A16, spec carburetor §5.3,
// test §11.7). Puro: no usa el modelo ni el solver.
import { describe, expect, it } from 'vitest';
import { airMassFlowStub } from '../../src/sim/signals/stubs.ts';
import { INITIAL_TRANSIENT, mixtureOf, stepTransient, type TransientState } from '../../src/modules/carburetor/transient.ts';

const DT = 0.001;
const RPM = 2500;

/** Pisa de 0,1 a 1 en `rampS` segundos a 2500 rpm y sigue el mínimo/máximo de
 *  la mezcla durante 2 s (sano, `r = 1` por construcción). */
function stomp(rampS: number, accelPumpFailed: boolean): { min: number; max: number; recoverAt: number | null } {
  let state: TransientState = INITIAL_TRANSIENT;
  // Asienta en ralentí (0,1) antes del pisotón: si no, el arranque desde
  // `qReal = 0` se lee como un tironeo que no es el que mide el test.
  const settleSteps = Math.round(2 / DT);
  for (let i = 0; i < settleSteps; i++) {
    const airMassFlow = airMassFlowStub({ rpm: RPM, throttle: 0.1 });
    state = stepTransient(state, DT, { r: 1, airMassFlow, dThrottle: 0, accelPumpFailed: false });
  }
  let prevThrottle = 0.1;
  let min = Infinity;
  let max = -Infinity;
  let recoverAt: number | null = null;
  const steps = Math.round(2 / DT);
  for (let i = 0; i <= steps; i++) {
    const t = i * DT;
    const throttle = t >= rampS ? 1 : 0.1 + 0.9 * (t / rampS);
    const airMassFlow = airMassFlowStub({ rpm: RPM, throttle });
    const dThrottle = (throttle - prevThrottle) / DT;
    state = stepTransient(state, DT, { r: 1, airMassFlow, dThrottle, accelPumpFailed });
    const mixture = mixtureOf(state.qReal, airMassFlow, state.accelBoost);
    if (t > 0) {
      min = Math.min(min, mixture);
      max = Math.max(max, mixture);
    }
    if (recoverAt === null && t >= rampS && mixture > 0.9) recoverAt = t;
    prevThrottle = throttle;
  }
  return { min, max, recoverAt };
}

describe('transient — pisotón 0,1 → 1 en 0,1 s a 2500 rpm (test §11.7)', () => {
  it('sana: mínimo ≥ 0,85 y máximo ≤ 1,3', () => {
    const { min, max } = stomp(0.1, false);
    expect(min).toBeGreaterThanOrEqual(0.85);
    expect(max).toBeLessThanOrEqual(1.3);
  });

  it('sin bomba de aceleración: tironeo (mínimo ≤ 0,65) y se recupera en < 1,2 s', () => {
    const { min, recoverAt } = stomp(0.1, true);
    expect(min).toBeLessThanOrEqual(0.65);
    expect(recoverAt).not.toBeNull();
    expect(recoverAt!).toBeLessThan(0.1 + 1.2);
  });
});
