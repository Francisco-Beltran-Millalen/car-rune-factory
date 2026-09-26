// Criterios 1, 2, 5, 6, 7 y 15 de la spec four-stroke §11:
// geometría, válvulas, trabajo por ciclo, sin chispa, avance y subpasos.
import { describe, expect, it } from 'vitest';
import {
  burnFraction,
  compressionPeak,
  cylinderVolume,
  exhaustLift,
  intakeLift,
  pistonDrop,
} from '../../src/sim/engine/geometry.ts';
import { K } from '../../src/modules/four-stroke/constants.ts';
import { createCylinderGas, stepGas, type CylinderGas, type GasInputs } from '../../src/modules/four-stroke/gas.ts';

const wot = (rpm: number, overrides: Partial<GasInputs> = {}): GasInputs => ({
  dtPerDeg: 60 / (rpm * 360),
  pMan: 0,
  backpressure: 0,
  advance: 25,
  spark: 1,
  mixture: 1,
  n: K.nRun,
  kLeak: 0,
  kValve: 0,
  lash: 0,
  camOffset: 0,
  ...overrides,
});

/** Corre hasta completar `cycles` ciclos (desde el cierre de admisión). */
function runCycles(rpm: number, input: GasInputs, cycles: number): CylinderGas {
  let cyl = createCylinderGas(0);
  const target = 720 * cycles + 220;
  while (cyl.phase < target) {
    const d = Math.min(rpm / 60 * 360 * 0.001, target - cyl.phase);
    cyl = stepGas(cyl, cyl.phase, cyl.phase + d, input);
  }
  return cyl;
}

describe('geometría (spec §11.1 y §11.2)', () => {
  it('carrera y volúmenes', () => {
    expect(pistonDrop(0)).toBeCloseTo(0, 6);
    expect(pistonDrop(180)).toBeCloseTo(86, 2);
    expect(cylinderVolume(0)).toBeCloseTo(55.5, 1);
    expect(cylinderVolume(180)).toBeCloseTo(555.1, 1);
  });

  it('eventos de válvula y alzada máxima', () => {
    expect(intakeLift(0)).toBeGreaterThan(0);
    expect(intakeLift(200)).toBeGreaterThan(0);
    expect(intakeLift(240)).toBe(0);
    expect(intakeLift(400)).toBe(0);
    expect(exhaustLift(520)).toBeGreaterThan(0);
    expect(exhaustLift(700)).toBeGreaterThan(0);
    expect(exhaustLift(60)).toBe(0);
    expect(intakeLift(105)).toBeCloseTo(9, 1);
    expect(exhaustLift(615)).toBeCloseTo(9, 1);
    expect(burnFraction(360, 25)).toBeGreaterThan(0);
    expect(burnFraction(330, 25)).toBe(0);
  });
});

describe('gas de un cilindro (spec §11.5 a §11.7, §11.15)', () => {
  it('a fondo, 3000 rpm, avance 25°: trabajo y pico en rango', () => {
    const cyl = runCycles(3000, wot(3000), 6);
    expect(cyl.lastWork).toBeGreaterThan(520);
    expect(cyl.lastWork).toBeLessThan(650);
    expect(cyl.lastPeak).toBeGreaterThan(55);
    expect(cyl.lastPeak).toBeLessThan(75);
  });

  it('sin chispa: el trabajo neto queda cerca de cero', () => {
    const cyl = runCycles(3000, wot(3000, { spark: 0 }), 6);
    expect(cyl.lastWork).toBeGreaterThan(-30);
    expect(cyl.lastWork).toBeLessThan(10);
  });

  it('avance: 25° supera a 0° en ≥12 % y a 40° en ≥2 %', () => {
    const w25 = runCycles(3000, wot(3000, { advance: 25 }), 6).lastWork;
    const w0 = runCycles(3000, wot(3000, { advance: 0 }), 6).lastWork;
    const w40 = runCycles(3000, wot(3000, { advance: 40 }), 6).lastWork;
    expect(w25).toBeGreaterThan(w0 * 1.12);
    expect(w25).toBeGreaterThan(w40 * 1.02);
  });

  it('subpaso de 1° vs 0,25° a 6000 rpm difiere <1 %', () => {
    const w1 = runCycles(6000, wot(6000), 8).lastWork;
    const w4 = runCycles(6000, wot(6000, { subStep: 0.25 }), 8).lastWork;
    expect(Math.abs(w1 - w4) / Math.abs(w4)).toBeLessThan(0.01);
  });

  it('la fuga de anillos baja el pico de la prueba de compresión', () => {
    const sano = compressionPeak(0);
    expect(sano).toBeGreaterThan(13.5);
    expect(sano).toBeLessThan(15);
    expect(compressionPeak(8)).toBeLessThan(7.5);
  });
});
