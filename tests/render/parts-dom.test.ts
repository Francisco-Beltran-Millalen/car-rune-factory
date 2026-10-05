// @vitest-environment happy-dom
// §10 en el DOM real: toda pieza clickeable (`data-part`) de cada ruta tiene su
// ficha en `parts`, también las sub-piezas que dibuja un drawer por dentro
// (en el vehículo llevan el prefijo de su sistema; antes no lo llevaban y el
// clic en los platinos del vehículo no mostraba nada).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShell } from '../../src/core/shell.ts';
import { modules } from '../../src/modules/registry.ts';

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

describe('data-part del SVG ↔ parts (§10)', () => {
  it.each(modules.map((m) => [m.id, m] as const))('%s', (_id, desc) => {
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const root = document.createElement('div');
    document.body.append(root);
    const shell = createShell(root, modules, { go: vi.fn() });
    shell.route({ kind: 'lab', id: desc.id });
    // Lo oculto (`display: none`, p. ej. la correa dentada en el OHV) no se puede clicar.
    const visible = (n: Element): boolean => {
      for (let e: Element | null = n; e; e = e.parentElement) {
        if (e instanceof HTMLElement || e instanceof SVGElement) {
          if (e.style.display === 'none') return false;
        }
      }
      return true;
    };
    const ids = new Set(
      [...root.querySelectorAll('.stage [data-part]')].filter(visible).map((n) => n.getAttribute('data-part') ?? ''),
    );
    expect([...ids].filter((id) => !(id in desc.parts))).toEqual([]);
    shell.unmount();
  });
});
