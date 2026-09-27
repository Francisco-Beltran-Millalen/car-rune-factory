// Contenido, circuito, catálogo y narración del carburador (A16).
import { describe, expect, it } from 'vitest';
import { CARB_DEF, createCarburetorModel, type CarburetorModel } from '../../src/modules/carburetor/circuit.ts';
import { parts } from '../../src/modules/carburetor/content.ts';
import { DEFAULT_FAULTS, DEFAULT_PARAMS } from '../../src/modules/carburetor/controllers.ts';
import { CARBURETOR_FAULTS } from '../../src/modules/carburetor/faults.ts';
import { createNarrator } from '../../src/modules/carburetor/narrate.ts';
import { CARBURETOR_PRESENT } from '../../src/modules/carburetor/present.ts';
import { controls, faults, presets, readouts } from '../../src/modules/carburetor/specs.ts';
import { DRAWERS } from '../../src/render/svg/drawers/index.ts';
import { validateCircuit } from '../../src/sim/circuit/validate.ts';
import { ELEMENT_TYPES } from '../../src/sim/elements/index.ts';

const run = (m: CarburetorModel, s: number): void => {
  const n = Math.round(s / 0.001);
  for (let i = 0; i < n; i++) m.step(0.001);
};

const PIECES = [
  'tank', 'fuelLine', 'mechPump', 'fuelFilter', 'needleValve', 'floatBowl',
  'float', 'venturi', 'mainJet', 'idleJet', 'idleScrew', 'throttlePlate',
  'choke', 'accelPump', 'airHorn',
];

describe('contenido carburetor', () => {
  it('hay ficha completa para cada pieza de la spec', () => {
    for (const id of PIECES) {
      const info = parts[id];
      expect(info, id).toBeDefined();
      if (!info) continue;
      expect(info.name.length, id).toBeGreaterThan(2);
      expect(info.what && info.why && info.how, id).toBeTruthy();
      expect(Array.isArray(info.failures), id).toBe(true);
    }
  });

  it('controles, fallas y presets sólo usan claves del modelo', () => {
    const actions = createCarburetorModel().actions;
    for (const c of controls) {
      if (c.key) expect(DEFAULT_PARAMS, c.key).toHaveProperty(c.key);
      if (c.action) expect(actions, c.action).toHaveProperty(c.action);
    }
    for (const f of faults) expect(DEFAULT_FAULTS, f.key).toHaveProperty(f.key);
    for (const p of presets) {
      for (const k of Object.keys(p.params ?? {})) expect(DEFAULT_PARAMS, `${p.id}.${k}`).toHaveProperty(k);
      for (const k of Object.keys(p.faults ?? {})) expect(DEFAULT_FAULTS, `${p.id}.${k}`).toHaveProperty(k);
    }
  });

  it('el catálogo §26 usa piezas del contenido y claves del modelo', () => {
    const seen = new Set<string>();
    for (const entry of CARBURETOR_FAULTS) {
      expect(seen.has(entry.id), entry.id).toBe(false);
      seen.add(entry.id);
      expect(parts[entry.part], `${entry.id} → ${entry.part}`).toBeDefined();
      expect(DEFAULT_FAULTS, entry.modelKey).toHaveProperty(entry.modelKey);
    }
  });

  it('el circuito compila sin errores y cada pieza dibujada tiene drawer', () => {
    const issues = validateCircuit(CARB_DEF, ELEMENT_TYPES);
    expect(issues.filter((i) => i.level === 'error')).toEqual([]);
    for (const part of CARB_DEF.parts) {
      if (!part.visual) continue;
      expect(DRAWERS[part.visual], part.id).toBeDefined();
    }
  });

  it('las lecturas dan números finitos y el esquema cubre las piezas dibujadas', () => {
    const m = createCarburetorModel({ params: { rpm: 2500, throttle: 0.3 } });
    run(m, 1);
    for (const r of readouts) expect(Number.isFinite(r.get(m.state)), r.id).toBe(true);
    const drawn = ['tank', 'fuelLine', 'mechPump', 'fuelFilter', 'floatBowl', 'carbBody', 'choke'];
    for (const id of drawn) expect(CARBURETOR_PRESENT.parts[id], id).toBeDefined();
  });

  it('todo enlace visual tiene canal de caudal en el esquema (si no, el tubo se ve vacío)', () => {
    for (const link of CARB_DEF.links) {
      if (!link.visual) continue;
      expect(CARBURETOR_PRESENT.links?.[link.id], link.id).toBeDefined();
      expect(CARBURETOR_PRESENT.links?.[link.id]?.flow, link.id).toBeDefined();
    }
  });
});

describe('narración carburetor', () => {
  it('la cuba rebalsada se anuncia como mala', () => {
    const m = createCarburetorModel({ params: { rpm: 800, throttle: 0 }, faults: { floatPunctured: true } });
    const narr = createNarrator();
    run(m, 20);
    expect(narr(m).map((n) => n.text).join(' | ')).toContain('rebalsa');
  });

  it('frío sin choke avisa que conviene tirarlo', () => {
    const m = createCarburetorModel({ params: { rpm: 300, throttle: 0, engineTempC: 20, choke: 0 } });
    const narr = createNarrator();
    run(m, 1);
    expect(narr(m).map((n) => n.text).join(' | ')).toContain('Tira el choke');
  });
});
