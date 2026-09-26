import { describe, it, expect } from 'vitest';
import type { Narration } from '../../src/core/types.ts';
import { parts } from '../../src/modules/fuel/content.ts';
import { DEFAULT_FAULTS, DEFAULT_PARAMS, createFuelModel, type FuelModel } from '../../src/modules/fuel/reference-model.ts';
import { createNarrator } from '../../src/modules/fuel/narrate.ts';
import { controls, faults, presets, readouts } from '../../src/modules/fuel/specs.ts';

const PART_IDS = [
  'battery', 'key', 'relay', 'tank', 'strainer', 'pump', 'checkValve', 'feedLine', 'filter', 'rail',
  'injector1', 'injector2', 'injector3', 'injector4', 'injectorWires', 'manifold', 'regulator', 'vacuumHose', 'returnLine', 'ecu',
];
const run = (m: FuelModel, s: number): void => { for (let i = 0; i < s * 1000; i++) m.step(0.001); };
function start(m: FuelModel): void {
  m.params.ignitionKey = 'on'; run(m, 2.5);
  m.params.ignitionKey = 'start'; run(m, 1.5);
  m.params.ignitionKey = 'run'; run(m, 2);
}
const texts = (narr: (m: FuelModel) => Narration[], m: FuelModel): string =>
  narr(m).map((n) => n.text).join(' | ');

describe('contenido del combustible', () => {
  it('hay ficha completa para cada pieza de la spec', () => {
    for (const id of PART_IDS) {
      expect(parts[id], id).toBeDefined();
      expect(parts[id]!.name.length).toBeGreaterThan(2);
      expect(parts[id]!.what && parts[id]!.why && parts[id]!.how, id).toBeTruthy();
      expect(Array.isArray(parts[id]!.failures)).toBe(true);
    }
  });

  it('controles, fallas y presets sólo usan claves que existen en el modelo', () => {
    for (const c of controls) {
      if (c.key) expect(DEFAULT_PARAMS, c.key).toHaveProperty(c.key);
      if (c.action) expect(createFuelModel().actions, c.action).toHaveProperty(c.action);
    }
    for (const f of faults) expect(DEFAULT_FAULTS, f.key).toHaveProperty(f.key);
    const actions = createFuelModel().actions;
    for (const p of presets) {
      for (const k of Object.keys(p.params ?? {})) expect(DEFAULT_PARAMS, `${p.id}.${k}`).toHaveProperty(k);
      for (const k of Object.keys(p.faults ?? {})) expect(DEFAULT_FAULTS, `${p.id}.${k}`).toHaveProperty(k);
      for (const k of Object.keys(p.setup ?? {})) expect(actions, `${p.id}.${k}`).toHaveProperty(k);
    }
  });

  it('las lecturas dan números finitos', () => {
    const m = createFuelModel();
    start(m);
    for (const r of readouts) expect(Number.isFinite(r.get(m.state)), r.id).toBe(true);
  });
});

describe('narración del combustible', () => {
  it('cebado', () => {
    const m = createFuelModel();
    const narr = createNarrator();
    m.params.ignitionKey = 'on';
    run(m, 0.5);
    expect(texts(narr, m)).toContain('presurizar el riel');
  });
  it('presión estable en marcha', () => {
    const m = createFuelModel();
    const narr = createNarrator();
    start(m);
    expect(texts(narr, m)).toContain('Presión estable');
  });
  it('filtro tapado a fondo', () => {
    const m = createFuelModel({ faults: { filterClog: 0.9 } });
    const narr = createNarrator();
    start(m);
    m.params.throttle = 1;
    m.params.rpm = 6000;
    run(m, 3);
    const t = texts(narr, m);
    expect(t).toContain('filtro está restringiendo');
    expect(t).toContain('Mezcla pobre');
  });
  it('manguera suelta en ralentí', () => {
    const m = createFuelModel({ faults: { vacuumHoseOff: true } });
    const narr = createNarrator();
    start(m);
    expect(texts(narr, m)).toContain('Sin referencia de vacío');
  });
  it('fuga de presión residual con el motor apagado', () => {
    const m = createFuelModel({ faults: { injectorLeak: 1 } });
    const narr = createNarrator();
    m.params.ignitionKey = 'on';
    run(m, 3);
    narr(m);
    run(m, 1);
    expect(texts(narr, m)).toContain('presión residual no se mantiene');
  });
  it('regulador pegado abierto: gira y no parte', () => {
    const m = createFuelModel({ faults: { regulator: 'stuckOpen' } });
    const narr = createNarrator();
    start(m);
    expect(texts(narr, m)).toContain('gira pero no parte');
  });
  it('sin bencina: aire y motor detenido', () => {
    const m = createFuelModel({ tankLevel: 1.5 });
    const narr = createNarrator();
    start(m);
    m.params.fastConsumption = true;
    m.params.throttle = 0.6;
    m.params.rpm = 3500;
    let sawAir = false;
    for (let i = 0; i < 60 && m.state.engineState !== 'stalled'; i++) {
      run(m, 0.5);
      sawAir ||= texts(narr, m).includes('aspira aire');
    }
    expect(sawAir).toBe(true);
    expect(m.state.engineState).toBe('stalled');
    expect(texts(narr, m)).toContain('se detuvo');
  });
});

describe('vista ↔ contenido (§10)', () => {
  it('cada data-part que dibuja la vista tiene ficha', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(new URL('../../src/modules/fuel/view.ts', import.meta.url), 'utf8');
    const ids = new Set([...src.matchAll(/part: '([\w]+)'/g)].map((m) => m[1]!));
    if (src.includes('part: `injector${i + 1}`')) [1, 2, 3, 4].forEach((n) => ids.add(`injector${n}`));
    for (const id of ids) expect(parts, id).toHaveProperty(id);
    for (const id of PART_IDS) expect(ids.has(id), `la vista no dibuja ${id}`).toBe(true);
  });
});
