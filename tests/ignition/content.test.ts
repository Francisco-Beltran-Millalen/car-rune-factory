// Contenido, circuito, catálogo y narración del encendido (A12).
import { describe, expect, it } from 'vitest';
import type { Narration } from '../../src/core/types.ts';
import { createIgnitionModel, ignitionDef, type IgnitionModel } from '../../src/modules/ignition/circuit.ts';
import { createParts } from '../../src/modules/ignition/content.ts';
import { DEFAULT_FAULTS, DEFAULT_PARAMS } from '../../src/modules/ignition/core.ts';
import { ignitionFaults } from '../../src/modules/ignition/faults.ts';
import { createNarrator } from '../../src/modules/ignition/narrate.ts';
import { IGNITION_PRESENT } from '../../src/modules/ignition/present.ts';
import { controls, faults, presets, readouts } from '../../src/modules/ignition/specs.ts';
import { DRAWERS } from '../../src/render/svg/drawers/index.ts';
import { validateCircuit } from '../../src/sim/circuit/validate.ts';
import { ELEMENT_TYPES } from '../../src/sim/elements/index.ts';

const COMMON = [
  'battery', 'key', 'scope', 'sparkPlug1', 'sparkPlug2', 'sparkPlug3', 'sparkPlug4',
];
const POINTS = [
  'coil', 'ballast', 'points', 'condenser', 'distributor', 'rotor', 'distributorCap',
  'coilLead', 'htLead1', 'htLead2', 'htLead3', 'htLead4', 'centrifugalAdvance',
  'vacuumAdvance', 'vacuumLine',
];
const COP = ['coil1', 'coil2', 'coil3', 'coil4', 'ecu', 'crankSensor', 'toothWheel', 'camSensor', 'igniter'];

const run = (m: IgnitionModel, s: number): void => {
  const n = Math.round(s / 0.001);
  for (let i = 0; i < n; i++) m.step(0.001);
};

describe.each(['points', 'cop'] as const)('contenido ignition %s', (variant) => {
  const ids = [...COMMON, ...(variant === 'points' ? POINTS : COP)];

  it('hay ficha completa para cada pieza de la spec', () => {
    const parts = createParts(variant);
    for (const id of ids) {
      const info = parts[id];
      expect(info, id).toBeDefined();
      if (!info) continue;
      expect(info.name.length, id).toBeGreaterThan(2);
      expect(info.what && info.why && info.how, id).toBeTruthy();
      expect(Array.isArray(info.failures), id).toBe(true);
    }
  });

  it('controles, fallas y presets sólo usan claves del modelo', () => {
    const actions = createIgnitionModel(variant).actions;
    for (const c of controls(variant)) {
      if (c.key) expect(DEFAULT_PARAMS, c.key).toHaveProperty(c.key);
      if (c.action) expect(actions, c.action).toHaveProperty(c.action);
    }
    for (const f of faults(variant)) expect(DEFAULT_FAULTS, f.key).toHaveProperty(f.key);
    for (const p of presets(variant)) {
      for (const k of Object.keys(p.params ?? {})) expect(DEFAULT_PARAMS, `${p.id}.${k}`).toHaveProperty(k);
      for (const k of Object.keys(p.faults ?? {})) expect(DEFAULT_FAULTS, `${p.id}.${k}`).toHaveProperty(k);
    }
  });

  it('el catálogo §26 usa piezas del contenido y claves del modelo', () => {
    const parts = createParts(variant);
    const seen = new Set<string>();
    for (const entry of ignitionFaults(variant)) {
      expect(seen.has(entry.id), entry.id).toBe(false);
      seen.add(entry.id);
      expect(parts[entry.part], `${entry.id} → ${entry.part}`).toBeDefined();
      expect(DEFAULT_FAULTS, entry.modelKey).toHaveProperty(entry.modelKey);
    }
  });

  it('el circuito compila sin errores y cada pieza tiene drawer', () => {
    const def = ignitionDef(variant);
    const issues = validateCircuit(def, ELEMENT_TYPES);
    expect(issues.filter((i) => i.level === 'error')).toEqual([]);
    for (const part of def.parts) {
      if (!part.visual) continue; // topología pura (nudos y el puente)
      expect(DRAWERS[part.visual], part.id).toBeDefined();
    }
  });

  it('las lecturas dan números finitos y el esquema cubre las piezas dibujadas', () => {
    const m = createIgnitionModel(variant, {
      params: { ignitionKey: 'run', rpm: 1500, throttle: 0.3 },
    });
    run(m, 1);
    for (const r of readouts(variant)) expect(Number.isFinite(r.get(m.state)), r.id).toBe(true);
    for (const part of ignitionDef(variant).parts) {
      if (part.type === 'junction') continue;
      expect(IGNITION_PRESENT.parts[part.id], part.id).toBeDefined();
    }
  });
});

describe('narración ignition', () => {
  it('sin sincronía avisa que no hay chispa', () => {
    const m = createIgnitionModel('cop', {
      params: { ignitionKey: 'run', rpm: 800 },
      faults: { crankSensorDead: true },
    });
    const narr = createNarrator('cop');
    run(m, 0.5);
    expect(narr(m).map((n: Narration) => n.text).join(' | ')).toContain('no hay chispa');
  });

  it('el balasto cortado se anuncia al pasar a marcha', () => {
    const m = createIgnitionModel('points', {
      params: { ignitionKey: 'run', rpm: 800 },
      faults: { ballastOpen: true },
    });
    const narr = createNarrator('points');
    run(m, 0.5);
    expect(narr(m).map((n: Narration) => n.text).join(' | ')).toContain('balasto está cortado');
  });
});
