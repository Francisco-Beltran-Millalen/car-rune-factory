import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseHash, createRouter, type HashWindow } from '../../src/core/router.ts';

describe('router (rutas nuevas A1)', () => {
  it('parseHash reconoce lab, stage, home y compatibilidad', () => {
    // Rutas lab
    expect(parseHash('#/lab/fuel')).toEqual({ kind: 'lab', id: 'fuel' });
    expect(parseHash('#/lab/demo')).toEqual({ kind: 'lab', id: 'demo' });

    // Rutas stage
    expect(parseHash('#/stage/fuel-quiz-1')).toEqual({ kind: 'stage', id: 'fuel-quiz-1' });
    expect(parseHash('#/stage/diag-fuel-2')).toEqual({ kind: 'stage', id: 'diag-fuel-2' });

    // Compatibilidad (#/<id> → lab)
    expect(parseHash('#/fuel')).toEqual({ kind: 'lab', id: 'fuel' });
    expect(parseHash('#/otro')).toEqual({ kind: 'lab', id: 'otro' });

    // Alias de A11/A12: la ruta vieja redirige a la variante moderna
    expect(parseHash('#/four-stroke')).toEqual({ kind: 'lab', id: 'four-stroke-dohc' });
    expect(parseHash('#/lab/four-stroke')).toEqual({ kind: 'lab', id: 'four-stroke-dohc' });
    expect(parseHash('#/lab/four-stroke-ohv')).toEqual({ kind: 'lab', id: 'four-stroke-ohv' });
    expect(parseHash('#/ignition')).toEqual({ kind: 'lab', id: 'ignition-cop' });
    expect(parseHash('#/lab/ignition-points')).toEqual({ kind: 'lab', id: 'ignition-points' });
    expect(parseHash('#/cooling')).toEqual({ kind: 'lab', id: 'cooling-electric' });

    // Portada y vacíos
    expect(parseHash('#/')).toEqual({ kind: 'home', id: null });
    expect(parseHash('#')).toEqual({ kind: 'home', id: null });
    expect(parseHash('')).toEqual({ kind: 'home', id: null });
    expect(parseHash(null)).toEqual({ kind: 'home', id: null });
  });

  describe('createRouter', () => {
    let mockWin: HashWindow;

    beforeEach(() => {
      mockWin = {
        location: {
          hash: '',
          replace: vi.fn((newHash: string) => {
            mockWin.location.hash = newHash;
          }),
        },
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };
    });

    it('start llama onRoute con la ruta actual', () => {
      mockWin.location.hash = '#/lab/fuel';
      const onRoute = vi.fn();
      const router = createRouter(onRoute, mockWin);

      router.start();
      expect(onRoute).toHaveBeenCalledWith({ kind: 'lab', id: 'fuel' });
      expect(mockWin.addEventListener).toHaveBeenCalledWith('hashchange', expect.any(Function));
      router.destroy();
      expect(mockWin.removeEventListener).toHaveBeenCalledWith('hashchange', expect.any(Function));
    });

    it('redirige hashes compatibles (#/fuel → #/lab/fuel)', () => {
      mockWin.location.hash = '#/fuel';
      const onRoute = vi.fn();
      const router = createRouter(onRoute, mockWin);

      router.start();
      expect(mockWin.location.replace).toHaveBeenCalledWith('#/lab/fuel');
      router.destroy();
    });

    it('go navega a la ruta indicada', () => {
      const onRoute = vi.fn();
      const router = createRouter(onRoute, mockWin);

      router.go(null);
      expect(mockWin.location.hash).toBe('#/');

      router.go('fuel');
      expect(mockWin.location.hash).toBe('#/lab/fuel');

      router.go({ kind: 'stage', id: 'fuel-quiz-1' });
      expect(mockWin.location.hash).toBe('#/stage/fuel-quiz-1');

      router.go({ kind: 'home' });
      expect(mockWin.location.hash).toBe('#/');
    });
  });
});
