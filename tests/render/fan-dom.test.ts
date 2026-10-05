// @vitest-environment happy-dom
// El ventilador viscoso gira siempre con el motor (acople mínimo 0,3): en
// ralentí frío tiene que verse girar (antes: 25 °/s, parecía quieto). El
// eléctrico, en cambio, queda quieto hasta que el termocontacto cierra (100 °C).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShell } from '../../src/core/shell.ts';
import { modules } from '../../src/modules/registry.ts';

interface SimDebugLike {
  session: { tick(dt: number): number };
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

/** Ángulo de las aspas tras `seconds` reales a 1×. */
function bladeAngleAfter(id: string, seconds: number): number {
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  const root = document.createElement('div');
  document.body.append(root);
  const shell = createShell(root, modules, { go: vi.fn() });
  shell.route({ kind: 'lab', id });
  // Frontera de test: `window.__sim` es el acceso de depuración del shell.
  const sim = (window as unknown as { __sim: SimDebugLike }).__sim;
  for (let t = 0; t < seconds; t += 0.05) sim.session.tick(0.05);
  const blades = root.querySelector('[data-part="fan"] ellipse.fan-blade')?.parentElement;
  const match = /rotate\(([-\d.]+)/.exec(blades?.getAttribute('transform') ?? '');
  shell.unmount();
  return Number(match?.[1] ?? 0);
}

describe('ventilador dibujado', () => {
  it('el viscoso se ve girar en ralentí frío (≥ 90°/s)', () => {
    expect(bladeAngleAfter('cooling-viscous', 0.5)).toBeGreaterThanOrEqual(45);
  });
  it('el eléctrico queda quieto con el motor frío', () => {
    expect(bladeAngleAfter('cooling-electric', 0.5)).toBe(0);
  });
});
