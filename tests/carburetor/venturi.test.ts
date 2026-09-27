// Física pura del venturi (A16, spec carburetor §5.2, tests §11.3 y §11.4).
import { describe, expect, it } from 'vitest';
import {
  bowlHeight,
  mainFraction,
  mixtureRatio,
  vaporization,
  venturiDp,
} from '../../src/modules/carburetor/venturi.ts';

const NOMINAL_LEVEL = 0.06; // cuba en su nivel regulado (sin bonus por cuba alta)

describe('venturi — umbral del principal (test §11.3)', () => {
  it('mainFraction es 0 bajo ~36 kg/h de aire', () => {
    const h = bowlHeight(NOMINAL_LEVEL);
    const dpv = venturiDp(35);
    expect(mainFraction(dpv, h)).toBe(0);
  });

  it('mainFraction domina (> 0,78) a 61 kg/h', () => {
    const h = bowlHeight(NOMINAL_LEVEL);
    const dpv = venturiDp(61);
    expect(mainFraction(dpv, h)).toBeGreaterThan(0.78);
  });
});

describe('venturi — mezcla sana y en frío (test §11.2 y §11.4)', () => {
  it('sano da r = 1 en todo el rango, cualquiera sea φ', () => {
    for (const phi of [0, 0.3, 0.8, 1]) {
      const r = mixtureRatio({
        phi,
        mainJetClog: 0,
        idleJetClog: 0,
        idleScrew: 1,
        bowlLevel: NOMINAL_LEVEL,
        chokeEf: 0,
        tempC: 90,
      });
      expect(r).toBeCloseTo(1, 6);
    }
  });

  it('20 °C sin choke: mezcla pobre (frío no evapora)', () => {
    const r = mixtureRatio({
      phi: 0.5,
      mainJetClog: 0,
      idleJetClog: 0,
      idleScrew: 1,
      bowlLevel: NOMINAL_LEVEL,
      chokeEf: 0,
      tempC: 20,
    });
    expect(r).toBeGreaterThanOrEqual(0.5);
    expect(r).toBeLessThanOrEqual(0.58);
  });

  it('20 °C con choke 1: se enriquece justo para partir', () => {
    const r = mixtureRatio({
      phi: 0.5,
      mainJetClog: 0,
      idleJetClog: 0,
      idleScrew: 1,
      bowlLevel: NOMINAL_LEVEL,
      chokeEf: 1,
      tempC: 20,
    });
    expect(r).toBeGreaterThanOrEqual(1.0);
    expect(r).toBeLessThanOrEqual(1.12);
  });

  it('90 °C con choke 1: muy rica (humo negro)', () => {
    const r = mixtureRatio({
      phi: 0.5,
      mainJetClog: 0,
      idleJetClog: 0,
      idleScrew: 1,
      bowlLevel: NOMINAL_LEVEL,
      chokeEf: 1,
      tempC: 90,
    });
    expect(r).toBeGreaterThan(1.9);
  });

  it('vaporización satura a 1 desde 80 °C', () => {
    expect(vaporization(90)).toBe(1);
    expect(vaporization(80)).toBeCloseTo(1, 6);
    expect(vaporization(10)).toBeCloseTo(0.45, 6);
  });
});

describe('venturi — cuba alta y rebalse', () => {
  it('cuba sobre 0,062 L enriquece proporcionalmente', () => {
    const r = mixtureRatio({
      phi: 0.5,
      mainJetClog: 0,
      idleJetClog: 0,
      idleScrew: 1,
      bowlLevel: 0.072,
      chokeEf: 0,
      tempC: 90,
    });
    expect(r).toBeCloseTo(1 * (1 + 25 * 0.01), 6);
  });

  it('cuba llena (≥ 0,099 L) dispara la mezcla (+1)', () => {
    const r = mixtureRatio({
      phi: 0.5,
      mainJetClog: 0,
      idleJetClog: 0,
      idleScrew: 1,
      bowlLevel: 0.099,
      chokeEf: 0,
      tempC: 90,
    });
    expect(r).toBeGreaterThan(1.9);
  });
});
