// Contenido, circuito, catálogo y narración del ciclo de 4 tiempos (A11).
import { describe, expect, it } from 'vitest';
import type { Narration } from '../../src/core/types.ts';
import { fourStrokeDef, createFourStrokeModel, type FourStrokeModel } from '../../src/modules/four-stroke/circuit.ts';
import { createParts } from '../../src/modules/four-stroke/content.ts';
import { VARIANTS, type FourStrokeVariant } from '../../src/modules/four-stroke/constants.ts';
import { fourStrokeFaults } from '../../src/modules/four-stroke/faults.ts';
import { createNarrator } from '../../src/modules/four-stroke/narrate.ts';
import { FOUR_STROKE_PRESENT } from '../../src/modules/four-stroke/present.ts';
import { controls, faults, presets, readouts } from '../../src/modules/four-stroke/specs.ts';
import { DEFAULT_FAULTS, DEFAULT_PARAMS } from '../../src/modules/four-stroke/mechanism.ts';
import { validateCircuit } from '../../src/sim/circuit/validate.ts';
import { ELEMENT_TYPES } from '../../src/sim/elements/index.ts';
import { DRAWERS } from '../../src/render/svg/drawers/index.ts';

const VARIANTS_TO_TEST: readonly FourStrokeVariant[] = ['ohv', 'dohc'];

const MOTOR_IDS = [
  'cyl1', 'cyl2', 'cyl3', 'cyl4', 'piston', 'rings', 'rod', 'crank', 'head',
  'intakeValve', 'exhaustValve', 'camshaft', 'sparkPlug', 'intakePort', 'exhaustPort',
];
const TIMING_IDS = [
  'crankBolt', 'crankKey', 'crankSprocket', 'timingChain', 'tensioner', 'chainGuide', 'camSprocket',
];

const run = (m: FourStrokeModel, s: number): void => {
  const n = Math.round(s / 0.001);
  for (let i = 0; i < n; i++) m.step(0.001);
};

const texts = (narr: (m: FourStrokeModel) => Narration[], m: FourStrokeModel): string =>
  narr(m).map((n) => n.text).join(' | ');

describe.each(VARIANTS_TO_TEST)('contenido four-stroke %s', (variant) => {
  const ids = [...MOTOR_IDS, ...TIMING_IDS, ...(variant === 'ohv' ? ['pushrod', 'rocker'] : ['timingBelt'])];

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
    const actions = createFourStrokeModel(variant).actions;
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
    for (const entry of fourStrokeFaults(variant)) {
      expect(seen.has(entry.id), entry.id).toBe(false);
      seen.add(entry.id);
      expect(parts[entry.part], `${entry.id} → ${entry.part}`).toBeDefined();
      expect(DEFAULT_FAULTS, entry.modelKey).toHaveProperty(entry.modelKey);
      expect(entry.id.startsWith(`${entry.part}.`), entry.id).toBe(true);
      expect(entry.visibility, entry.id).toBeDefined();
    }
  });

  it('el circuito compila sin avisos y cada pieza tiene drawer', () => {
    const def = fourStrokeDef(variant);
    const issues = validateCircuit(def, ELEMENT_TYPES);
    expect(issues).toEqual([]);
    for (const part of def.parts) {
      expect(DRAWERS[part.visual ?? part.type], part.id).toBeDefined();
    }
  });

  it('las lecturas dan números finitos y el esquema cubre las piezas del dibujo', () => {
    const m = createFourStrokeModel(variant, { params: { mode: 'auto', rpm: 3000, throttle: 1 } });
    run(m, 1);
    for (const r of readouts) expect(Number.isFinite(r.get(m.state)), r.id).toBe(true);
    for (const partId of ['cylinder', 'timing', 'pv', 'compression']) {
      expect(FOUR_STROKE_PRESENT.parts[partId], partId).toBeDefined();
    }
    expect(VARIANTS[variant].id).toContain(variant);
  });

  it('todo enlace visual tiene canal de caudal en el esquema (si no, se ve muerto)', () => {
    for (const link of fourStrokeDef(variant).links) {
      if (!link.visual) continue;
      expect(FOUR_STROKE_PRESENT.links?.[link.id], link.id).toBeDefined();
      expect(FOUR_STROKE_PRESENT.links?.[link.id]?.flow, link.id).toBeDefined();
    }
  });
});

describe('narración four-stroke', () => {
  it('el choque de válvulas se anuncia como malo', () => {
    const m = createFourStrokeModel('dohc', {
      params: { mode: 'auto', rpm: 800, throttle: 0 },
      faults: { skippedTeeth: 2 },
    });
    const narr = createNarrator();
    run(m, 1);
    expect(texts(narr, m)).toContain('chocaron con el pistón');
  });

  it('sin chispa avisa que no hay combustión', () => {
    const m = createFourStrokeModel('dohc', {
      params: { mode: 'auto', rpm: 1000, throttle: 0.5, spark: false },
    });
    const narr = createNarrator();
    run(m, 1);
    expect(texts(narr, m)).toContain('Sin chispa');
  });

  it('una compresión baja tras la prueba se avisa con el cilindro', () => {
    const m = createFourStrokeModel('dohc', {
      params: { mode: 'auto', rpm: 800, throttle: 0, viewCylinder: 1 },
      faults: { ringWear2: 1 },
    });
    const narr = createNarrator();
    m.actions['compressionTest']?.();
    run(m, 5);
    expect(texts(narr, m)).toContain('cilindro 2 comprime poco');
  });
});
