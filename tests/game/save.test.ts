import { describe, it, expect } from 'vitest';
import { createSave, createMemoryStorage, SAVE_KEY, SAVE_VERSION } from '../../src/game/save.ts';

describe('save v1 (CONTRATOS.md §6.8, ley §27)', () => {
  it('sin storage arranca con valores por defecto', () => {
    const save = createSave(createMemoryStorage());
    expect(save.get()).toEqual({ version: SAVE_VERSION, stages: {}, mastery: {} });
  });

  it('recordStage guarda puntaje, estrellas y fecha, y respeta la versión', () => {
    const storage = createMemoryStorage();
    const save = createSave(storage);
    const rec = save.recordStage('fuel-quiz-1', { score: 80, stars: 2, completedAt: '2026-09-24T00:00:00.000Z' });

    expect(rec).toEqual({ bestScore: 80, stars: 2, completedAt: '2026-09-24T00:00:00.000Z' });
    const stored = JSON.parse(storage.getItem(SAVE_KEY)!) as {
      version: number;
      stages: Record<string, unknown>;
    };
    expect(stored.version).toBe(SAVE_VERSION);
    expect(stored.stages['fuel-quiz-1']).toEqual(rec);
  });

  it('recordStage no baja el mejor puntaje ni las estrellas', () => {
    const save = createSave(createMemoryStorage());
    save.recordStage('fuel-quiz-1', { score: 100, stars: 3, completedAt: 'a' });
    const rec = save.recordStage('fuel-quiz-1', { score: 40, stars: 1, completedAt: 'b' });

    expect(rec.bestScore).toBe(100);
    expect(rec.stars).toBe(3);
    expect(rec.completedAt).toBe('b');
  });

  it('recordAnswer acumula vistos y correctos por pieza', () => {
    const save = createSave(createMemoryStorage());
    save.recordAnswer('filter', true);
    save.recordAnswer('filter', false);
    save.recordAnswer('filter', true);

    expect(save.get().mastery['filter']).toEqual({ seen: 3, correct: 2 });
  });

  it('el progreso persiste entre instancias con el mismo storage', () => {
    const storage = createMemoryStorage();
    createSave(storage).recordStage('fuel-quiz-1', { score: 70, stars: 2, completedAt: 'x' });

    const save2 = createSave(storage);
    expect(save2.get().stages['fuel-quiz-1']!.bestScore).toBe(70);
  });

  it('storage corrupto (JSON inválido) → defaults, sin lanzar', () => {
    const storage = createMemoryStorage();
    storage.setItem(SAVE_KEY, '{no es json');
    expect(createSave(storage).get()).toEqual({ version: SAVE_VERSION, stages: {}, mastery: {} });
  });

  it('forma inesperada o versión desconocida → defaults', () => {
    for (const raw of ['null', '[]', '{"version":2,"stages":{},"mastery":{}}', '{"version":1}', '{"version":1,"stages":[],"mastery":{}}']) {
      const storage = createMemoryStorage();
      storage.setItem(SAVE_KEY, raw);
      expect(createSave(storage).get(), raw).toEqual({ version: SAVE_VERSION, stages: {}, mastery: {} });
    }
  });

  it('sanea entradas con forma inválida dentro de la v1', () => {
    const storage = createMemoryStorage();
    storage.setItem(
      SAVE_KEY,
      JSON.stringify({
        version: 1,
        stages: { roto: 1, ok: { bestScore: '80', stars: 9, completedAt: 42 } },
        mastery: { pump: { seen: '2', correct: '1' }, malo: null },
      }),
    );
    const data = createSave(storage).get();
    expect(data.stages).toEqual({ ok: { bestScore: 80, stars: 3, completedAt: '' } });
    expect(data.mastery).toEqual({ pump: { seen: 2, correct: 1 } });
  });

  it('un storage que lanza no rompe: se juega sin persistir', () => {
    const storage = {
      getItem() {
        throw new Error('revocado');
      },
      setItem() {
        throw new Error('revocado');
      },
    };
    const save = createSave(storage);
    expect(save.get().stages).toEqual({});
    save.recordStage('fuel-quiz-1', { score: 10, stars: 1 });
    expect(save.get().stages['fuel-quiz-1']!.bestScore).toBe(10);
  });

  it('acepta un Map como storage (inyectable en tests)', () => {
    const map = new Map<string, string>();
    const save = createSave(map);
    save.recordAnswer('pump', true);

    const stored = JSON.parse(map.get(SAVE_KEY)!) as {
      mastery: Record<string, { seen: number; correct: number }>;
    };
    expect(stored.mastery['pump']).toEqual({ seen: 1, correct: 1 });
  });

  it('reset limpia el progreso y el storage', () => {
    const storage = createMemoryStorage();
    const save = createSave(storage);
    save.recordStage('fuel-quiz-1', { score: 50, stars: 1 });
    save.recordAnswer('pump', true);

    expect(save.reset()).toEqual({ version: SAVE_VERSION, stages: {}, mastery: {} });
    expect(createSave(storage).get().stages).toEqual({});
  });
});
