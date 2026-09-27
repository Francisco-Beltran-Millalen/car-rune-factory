// Contenido, circuito, catálogo y narración de la refrigeración (A13).
import { describe, expect, it } from 'vitest';
import { createCoolingModel, coolingDef, type CoolingModel } from '../../src/modules/cooling/circuit.ts';
import { createParts } from '../../src/modules/cooling/content.ts';
import { DEFAULT_FAULTS, DEFAULT_PARAMS } from '../../src/modules/cooling/controllers.ts';
import { coolingFaults } from '../../src/modules/cooling/faults.ts';
import { createNarrator } from '../../src/modules/cooling/narrate.ts';
import { COOLING_PRESENT } from '../../src/modules/cooling/present.ts';
import { controls, faults, presets, readouts } from '../../src/modules/cooling/specs.ts';
import { DRAWERS } from '../../src/render/svg/drawers/index.ts';
import { validateCircuit } from '../../src/sim/circuit/validate.ts';
import { ELEMENT_TYPES } from '../../src/sim/elements/index.ts';

const COMMON = [
  'engineBlock', 'waterPump', 'pumpBelt', 'thermostat', 'bypass', 'upperHose',
  'lowerHose', 'radiator', 'radiatorCap', 'expansionTank', 'heaterValve',
  'heaterCore', 'tempSensor', 'tempGauge', 'fan',
];

const run = (m: CoolingModel, s: number): void => {
  const n = Math.round(s / 0.001);
  for (let i = 0; i < n; i++) m.step(0.001);
};

describe.each(['viscous', 'electric'] as const)('contenido cooling %s', (variant) => {
  const ids = [
    ...COMMON,
    ...(variant === 'viscous'
      ? ['fanClutch']
      : ['fanMotor', 'fanSwitch', 'fanRelay', 'battery', 'fuse']),
  ];

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
    const actions = createCoolingModel(variant).actions;
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
    for (const entry of coolingFaults(variant)) {
      expect(seen.has(entry.id), entry.id).toBe(false);
      seen.add(entry.id);
      expect(parts[entry.part], `${entry.id} → ${entry.part}`).toBeDefined();
      expect(DEFAULT_FAULTS, entry.modelKey).toHaveProperty(entry.modelKey);
    }
  });

  it('el circuito compila sin errores y cada pieza dibujada tiene drawer', () => {
    const def = coolingDef(variant);
    const issues = validateCircuit(def, ELEMENT_TYPES);
    expect(issues.filter((i) => i.level === 'error')).toEqual([]);
    for (const part of def.parts) {
      if (!part.visual) continue;
      expect(DRAWERS[part.visual], part.id).toBeDefined();
    }
  });

  it('las lecturas dan números finitos y el esquema cubre las piezas dibujadas', () => {
    const m = createCoolingModel(variant, { params: { rpm: 1500, load: 0.3, ambientC: 25 } });
    run(m, 1);
    for (const r of readouts(variant)) expect(Number.isFinite(r.get(m.state)), r.id).toBe(true);
    const drawn = [
      'waterPump',
      'engineBlock',
      'thermostat',
      'radiator',
      'expansionTank',
      'heaterCore',
      'tempGauge',
      'fan',
      ...(variant === 'electric' ? ['battery'] : []),
    ];
    for (const id of drawn) expect(COOLING_PRESENT.parts[id], id).toBeDefined();
  });

  it('todo enlace visual tiene canal de caudal en el esquema (si no, la manguera se ve muerta)', () => {
    for (const link of coolingDef(variant).links) {
      if (!link.visual) continue;
      expect(COOLING_PRESENT.links?.[link.id], link.id).toBeDefined();
      expect(COOLING_PRESENT.links?.[link.id]?.flow, link.id).toBeDefined();
    }
  });
});

describe('narración cooling', () => {
  it('avisa cuando el motor se recalienta', { timeout: 60_000 }, () => {
    const m = createCoolingModel('electric', {
      params: { rpm: 1200, load: 0.15, ambientC: 30, fastThermal: true },
      faults: { fanDead: true },
    });
    const narr = createNarrator();
    run(m, 85);
    expect(narr(m).map((n) => n.text).join(' | ')).toContain('recalentando');
  });

  it('avisa cuando el reloj miente', () => {
    const m = createCoolingModel('electric', {
      params: { rpm: 1500, load: 0.3 },
      faults: { sensorFault: 'readsCold' },
    });
    m.actions['setEngineTemp']?.(95);
    const narr = createNarrator();
    run(m, 1);
    expect(narr(m).map((n) => n.text).join(' | ')).toContain('el sensor falla');
  });
});
