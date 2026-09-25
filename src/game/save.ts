// Guardado versionado del progreso (CONTRATOS.md §6.8, ley §27).
// Nunca bloquea el juego: storage corrupto o ausente → valores por defecto.

import type { SaveApi, SaveData, StageRecord } from './types.ts';

export const SAVE_KEY = 'crf.save.v1';
export const SAVE_VERSION = 1;

/** Lo que el guardado necesita de un storage (localStorage, Map o doble de test). */
export interface SaveStorage {
  getItem?(key: string): string | null;
  setItem?(key: string, value: string): void;
  removeItem?(key: string): void;
  get?(key: string): unknown;
  set?(key: string, value: unknown): unknown;
  delete?(key: string): unknown;
}

export interface MemoryStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function defaults(): SaveData {
  return { version: SAVE_VERSION, stages: {}, mastery: {} };
}

/** Storage en memoria con la misma interfaz que localStorage (tests y sin storage). */
export function createMemoryStorage(): MemoryStorage {
  const map = new Map<string, string>();
  return {
    getItem: (k) => (map.has(k) ? (map.get(k) ?? null) : null),
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
  };
}

/** localStorage si se puede usar; si no (Safari privado, Node), memoria. */
export function safeLocalStorage(): SaveStorage {
  try {
    const ls = globalThis.localStorage;
    ls.getItem(SAVE_KEY); // el acceso puede lanzar aunque localStorage exista
    return ls;
  } catch {
    /* sin almacenamiento */
  }
  return createMemoryStorage();
}

function readRaw(storage: SaveStorage): unknown {
  try {
    if (typeof storage.getItem === 'function') return storage.getItem(SAVE_KEY);
    if (typeof storage.get === 'function') return storage.get(SAVE_KEY) ?? null;
  } catch {
    /* storage roto o revocado (Safari privado): se juega sin guardar */
  }
  return null;
}

function writeRaw(storage: SaveStorage, text: string): void {
  if (typeof storage.setItem === 'function') storage.setItem(SAVE_KEY, text);
  else if (typeof storage.set === 'function') storage.set(SAVE_KEY, text);
}

function removeRaw(storage: SaveStorage): void {
  try {
    if (typeof storage.removeItem === 'function') storage.removeItem(SAVE_KEY);
    else if (typeof storage.delete === 'function') storage.delete(SAVE_KEY);
  } catch {
    /* sin storage */
  }
}

const num = (v: unknown): number => (Number.isFinite(Number(v)) ? Number(v) : 0);

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Acepta sólo la forma v1 completa y sanea cada entrada; si no, defaults. */
function parseSave(raw: unknown): SaveData {
  if (typeof raw !== 'string' || !raw) return defaults();
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return defaults();
  }
  if (!isRecord(data)) return defaults();
  if (
    data['version'] !== SAVE_VERSION ||
    !isRecord(data['stages']) ||
    !isRecord(data['mastery'])
  ) {
    return defaults();
  }

  const stages: Record<string, StageRecord> = {};
  for (const [id, v] of Object.entries(data['stages'])) {
    if (!isRecord(v)) continue;
    stages[id] = {
      bestScore: Math.max(0, num(v['bestScore'])),
      stars: Math.min(3, Math.max(0, num(v['stars']))),
      completedAt: typeof v['completedAt'] === 'string' ? v['completedAt'] : '',
    };
  }
  const mastery: SaveData['mastery'] = {};
  for (const [key, v] of Object.entries(data['mastery'])) {
    if (!isRecord(v)) continue;
    mastery[key] = {
      seen: Math.max(0, num(v['seen'])),
      correct: Math.max(0, num(v['correct'])),
    };
  }
  return { version: SAVE_VERSION, stages, mastery };
}

export function createSave(storage: SaveStorage = safeLocalStorage()): SaveApi {
  let data = parseSave(readRaw(storage));

  function persist(): void {
    try {
      writeRaw(storage, JSON.stringify(data));
    } catch {
      /* sin storage: el progreso dura sólo esta sesión */
    }
  }

  return {
    get(): SaveData {
      return data;
    },
    /** Mejora el registro de la etapa: máximo puntaje y estrellas, última fecha. */
    recordStage(id, result = {}): StageRecord {
      const prev = data.stages[id];
      const rec: StageRecord = {
        bestScore: Math.max(num(prev?.bestScore), Math.max(0, num(result.score))),
        stars: Math.min(3, Math.max(num(prev?.stars), Math.max(0, num(result.stars)))),
        completedAt: result.completedAt ?? new Date().toISOString(),
      };
      data.stages[id] = rec;
      persist();
      return rec;
    },
    recordAnswer(partType, ok) {
      const m = data.mastery[partType] ?? { seen: 0, correct: 0 };
      const rec = { seen: m.seen + 1, correct: m.correct + (ok ? 1 : 0) };
      data.mastery[partType] = rec;
      persist();
      return rec;
    },
    reset(): SaveData {
      data = defaults();
      removeRaw(storage);
      persist();
      return data;
    },
  };
}
