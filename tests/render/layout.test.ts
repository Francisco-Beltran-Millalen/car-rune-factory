// Plan V1: ninguna manguera termina en el aire ni cruza otra pieza, en todos
// los laboratorios del registro. Con LAYOUT_SHEETS=1 escribe la hoja de cada
// uno en `layout-sheets/` (`npm run layout`).
import { mkdirSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { modules } from '../../src/modules/registry.ts';
import { DRAWERS } from '../../src/render/svg/drawers/index.ts';
import { checkLayout, NODE_TYPES, renderLayoutSheet, type LayoutIssue } from '../../src/render/svg/layout.ts';
import { ELEMENT_TYPES } from '../../src/sim/elements/index.ts';
import type { CircuitDef, CircuitLinkDef, CircuitPartDef } from '../../src/sim/circuit/types.ts';

const SHEETS = process.env['LAYOUT_SHEETS'] ? 'layout-sheets' : null;
const errors = (issues: readonly LayoutIssue[]): string[] =>
  issues.filter((i) => i.level === 'error').map((i) => `[${i.code}] ${i.message}`);

describe('layout de los laboratorios (plan V1)', () => {
  const labs = modules.filter((m) => m.circuit);
  it.each(labs.map((m) => [m.id, m] as const))('%s: sin problemas de conexión', (_id, m) => {
    const circuit: CircuitDef | undefined = m.circuit;
    if (!circuit) return;
    const issues = checkLayout(circuit, m.viewBox);
    if (SHEETS) {
      mkdirSync(SHEETS, { recursive: true });
      writeFileSync(`${SHEETS}/${m.id}.svg`, renderLayoutSheet(circuit, m.viewBox, issues));
    }
    expect(errors(issues)).toEqual([]);
  });
});

describe('catálogo de drawers', () => {
  it('NODE_TYPES son justo los tipos joint + multiple del solver', () => {
    const joints = Object.entries(ELEMENT_TYPES)
      .filter(([, info]) => info.joint === true && info.multiple === true)
      .map(([type]) => type);
    expect([...NODE_TYPES].sort()).toEqual(joints.sort());
  });

  it('cada geometría da una caja finita y puertos finitos', () => {
    const part: CircuitPartDef = { id: 'p', type: 'visual', x: 100, y: 100 };
    const def: CircuitDef = { id: 'd', title: 'd', parts: [part], links: [] };
    for (const [visual, entry] of Object.entries(DRAWERS)) {
      const geo = entry.geometry(part, def);
      for (const v of [geo.box.x, geo.box.y, geo.box.w, geo.box.h]) expect(Number.isFinite(v), visual).toBe(true);
      for (const p of Object.values(geo.ports ?? {})) expect(p.every(Number.isFinite), visual).toBe(true);
    }
  });
});

// ------------------------------------------------ cada código dispara

const VIEW = [0, 0, 1000, 600] as const;
const wire = { pipeClass: 'fluid-electric' };
const bat = (x: number, y: number): CircuitPartDef => ({ id: 'bat', type: 'battery', visual: 'battery', x, y });
const key = (x: number, y: number): CircuitPartDef => ({ id: 'key', type: 'switch', visual: 'key', x, y });
function codes(parts: CircuitPartDef[], links: CircuitLinkDef[], view = VIEW): string[] {
  return checkLayout({ id: 't', title: 't', parts, links }, view).map((i) => i.code);
}

describe('checkLayout: cada ley dispara', () => {
  it('un circuito bien armado no da problemas', () => {
    // + de la batería (159,92) sube, va a la derecha y entra a la llave por a (300,130).
    expect(codes([bat(100, 100), key(300, 100)], [
      { id: 'w', from: 'bat.+', to: 'key.a', via: [[159, 60], [280, 60], [280, 130]], visual: wire },
    ])).toEqual([]);
  });

  it('visual-sin-drawer, extremo-sin-pieza y puerto-inexistente', () => {
    expect(codes([{ id: 'x', type: 'resistor', visual: 'noExiste', x: 0, y: 0 }], [])).toContain('visual-sin-drawer');
    expect(codes([bat(100, 100), { id: 'r', type: 'resistor', x: 400, y: 100 }], [
      { id: 'w', from: 'bat.+', to: 'r.a', visual: wire },
    ])).toContain('extremo-sin-pieza');
    expect(codes([bat(100, 100), key(300, 100)], [
      { id: 'w', from: 'bat.x', to: 'key.a', visual: wire },
    ])).toContain('puerto-inexistente');
  });

  it('tramo-diagonal y tubo-cruza-pieza', () => {
    expect(codes([bat(100, 100), key(300, 100)], [
      { id: 'w', from: 'bat.+', to: 'key.a', visual: wire },
    ])).toContain('tramo-diagonal');
    // Sale del + hacia abajo: atraviesa su propia batería.
    expect(codes([bat(100, 100), key(300, 100)], [
      { id: 'w', from: 'bat.+', to: 'key.a', via: [[159, 130]], visual: wire },
    ])).toContain('tubo-cruza-pieza');
  });

  it('nudo-colgando y pieza-aislada', () => {
    expect(codes([bat(100, 100), key(300, 100), { id: 'n', type: 'junction', x: 159, y: 40 }], [
      { id: 'w', from: 'bat.+', to: 'n.a', visual: wire },
      { id: 'm', from: 'n.b', to: 'key.a' },
    ])).toEqual(expect.arrayContaining(['nudo-colgando', 'pieza-aislada']));
  });

  it('piezas-solapadas, tubos-encimados y fuera-del-lienzo', () => {
    expect(codes([bat(100, 100), key(150, 100)], [])).toContain('piezas-solapadas');
    expect(codes([bat(100, 100), key(300, 100), { id: 'k2', type: 'switch', visual: 'key', x: 300, y: 300 }], [
      { id: 'w1', from: 'bat.+', to: 'key.a', via: [[159, 60], [280, 60], [280, 130]], visual: wire },
      { id: 'w2', from: 'bat.-', to: 'k2.a', via: [[121, 60], [270, 60], [270, 330]], visual: wire },
    ])).toContain('tubos-encimados');
    expect(codes([bat(960, 100)], [])).toContain('fuera-del-lienzo');
  });

  it('joinedBy exige que las cajas se toquen', () => {
    expect(codes([bat(100, 100), { ...key(600, 100), joinedBy: 'bat' }], [])).toContain('union-lejana');
    expect(codes([bat(100, 100), { ...key(184, 100), joinedBy: 'bat' }], [])).not.toContain('union-lejana');
  });
});
