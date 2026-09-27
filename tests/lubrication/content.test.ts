// Contenido, circuito, catálogo y narración de la lubricación (A14).
import { describe, expect, it } from 'vitest';
import {
  createLubricationModel,
  lubricationDef,
  type LubricationModel,
} from '../../src/modules/lubrication/circuit.ts';
import { createParts } from '../../src/modules/lubrication/content.ts';
import { DEFAULT_FAULTS, DEFAULT_PARAMS } from '../../src/modules/lubrication/controllers.ts';
import { lubricationFaults } from '../../src/modules/lubrication/faults.ts';
import { createNarrator } from '../../src/modules/lubrication/narrate.ts';
import { LUBRICATION_PRESENT } from '../../src/modules/lubrication/present.ts';
import { controls, faults, presets, readouts } from '../../src/modules/lubrication/specs.ts';
import { DRAWERS } from '../../src/render/svg/drawers/index.ts';
import { validateCircuit } from '../../src/sim/circuit/validate.ts';
import { ELEMENT_TYPES } from '../../src/sim/elements/index.ts';

const COMMON = [
  'sump', 'drainPlug', 'pickup', 'oilPump', 'reliefValve', 'oilFilter',
  'filterBypass', 'mainGallery', 'mainBearings', 'rodBearings', 'camBearings',
  'pressureSwitch', 'warningLamp', 'battery', 'key',
];

const run = (m: LubricationModel, s: number): void => {
  const n = Math.round(s / 0.001);
  for (let i = 0; i < n; i++) m.step(0.001);
};

describe.each(['gauge', 'lamp'] as const)('contenido lubrication %s', (variant) => {
  const ids = [...COMMON, ...(variant === 'gauge' ? ['oilGauge'] : ['antiDrainback'])];

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
    const actions = createLubricationModel(variant).actions;
    for (const c of controls(variant)) {
      if (c.key) expect(DEFAULT_PARAMS, c.key).toHaveProperty(c.key);
      if (c.action) expect(actions, c.action).toHaveProperty(c.action);
    }
    for (const f of faults(variant)) expect(DEFAULT_FAULTS, f.key).toHaveProperty(f.key);
    for (const p of presets(variant)) {
      for (const k of Object.keys(p.params ?? {})) expect(DEFAULT_PARAMS, `${p.id}.${k}`).toHaveProperty(k);
      for (const k of Object.keys(p.faults ?? {})) expect(DEFAULT_FAULTS, `${p.id}.${k}`).toHaveProperty(k);
      for (const k of Object.keys(p.setup ?? {})) expect(actions, `${p.id}.${k}`).toHaveProperty(k);
    }
  });

  it('el catálogo §26 usa piezas del contenido y claves del modelo', () => {
    const parts = createParts(variant);
    const seen = new Set<string>();
    for (const entry of lubricationFaults(variant)) {
      expect(seen.has(entry.id), entry.id).toBe(false);
      seen.add(entry.id);
      expect(parts[entry.part], `${entry.id} → ${entry.part}`).toBeDefined();
      expect(DEFAULT_FAULTS, entry.modelKey).toHaveProperty(entry.modelKey);
    }
  });

  it('el circuito compila sin errores y cada pieza dibujada tiene drawer', () => {
    const def = lubricationDef(variant);
    const issues = validateCircuit(def, ELEMENT_TYPES);
    expect(issues.filter((i) => i.level === 'error')).toEqual([]);
    for (const part of def.parts) {
      if (!part.visual) continue;
      expect(DRAWERS[part.visual], part.id).toBeDefined();
    }
  });

  it('las lecturas dan números finitos y el esquema cubre las piezas dibujadas', () => {
    const m = createLubricationModel(variant, {
      params: { ignitionKey: 'run', rpm: 1500, oilTempC: 100 },
    });
    run(m, 1);
    for (const r of readouts) expect(Number.isFinite(r.get(m.state)), r.id).toBe(true);
    const drawn = [
      'sump',
      'oilPump',
      'reliefValve',
      'oilFilter',
      'mainGallery',
      'mainBearings',
      'rodBearings',
      'camBearings',
      'warningLamp',
      'battery',
      'key',
      ...(variant === 'gauge' ? ['oilGauge'] : []),
    ];
    for (const id of drawn) expect(LUBRICATION_PRESENT.parts[id], id).toBeDefined();
  });

  it('todo enlace visual tiene canal de caudal en el esquema (si no, el tubo se ve vacío)', () => {
    for (const link of lubricationDef(variant).links) {
      if (!link.visual) continue;
      expect(LUBRICATION_PRESENT.links?.[link.id], link.id).toBeDefined();
      expect(LUBRICATION_PRESENT.links?.[link.id]?.flow, link.id).toBeDefined();
    }
  });
});

describe('narración lubrication', () => {
  it('el testigo en marcha se anuncia como malo', () => {
    const m = createLubricationModel('lamp', {
      params: { ignitionKey: 'run', rpm: 800, oilTempC: 100 },
      faults: { bearingWear: 1 },
    });
    const narr = createNarrator();
    run(m, 1);
    expect(narr(m).map((n) => n.text).join(' | ')).toContain('testigo de aceite');
  });

  it('el filtro tapado abre el bypass y se avisa', () => {
    const m = createLubricationModel('lamp', {
      params: { ignitionKey: 'run', rpm: 3000, oilTempC: 100 },
      faults: { filterClog: 1 },
    });
    const narr = createNarrator();
    run(m, 1);
    expect(narr(m).map((n) => n.text).join(' | ')).toContain('bypass');
  });
});
