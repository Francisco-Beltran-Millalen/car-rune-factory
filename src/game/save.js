// Guardado versionado del progreso (CONTRATOS.md §6.8, ley §27).
// Nunca bloquea el juego: storage corrupto o ausente → valores por defecto.

export const SAVE_KEY = 'crf.save.v1';
export const SAVE_VERSION = 1;

/** @returns {{version:number, stages:Object, mastery:Object}} */
function defaults() {
  return { version: SAVE_VERSION, stages: {}, mastery: {} };
}

/** Storage en memoria con la misma interfaz que localStorage (tests y sin storage). */
export function createMemoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => {
      map.set(k, String(v));
    },
    removeItem: (k) => {
      map.delete(k);
    },
  };
}

/** localStorage si se puede usar; si no (Safari privado, Node), memoria. */
export function safeLocalStorage() {
  try {
    const ls = globalThis.localStorage;
    if (ls) {
      ls.getItem(SAVE_KEY); // el acceso puede lanzar aunque localStorage exista
      return ls;
    }
  } catch {
    /* sin almacenamiento */
  }
  return createMemoryStorage();
}

function readRaw(storage) {
  try {
    if (typeof storage?.getItem === 'function') return storage.getItem(SAVE_KEY);
    if (typeof storage?.get === 'function') return storage.get(SAVE_KEY) ?? null;
  } catch {
    /* storage roto o revocado (Safari privado): se juega sin guardar */
  }
  return null;
}

function writeRaw(storage, text) {
  if (typeof storage?.setItem === 'function') storage.setItem(SAVE_KEY, text);
  else if (typeof storage?.set === 'function') storage.set(SAVE_KEY, text);
}

function removeRaw(storage) {
  try {
    if (typeof storage?.removeItem === 'function') storage.removeItem(SAVE_KEY);
    else if (typeof storage?.delete === 'function') storage.delete(SAVE_KEY);
  } catch {
    /* sin storage */
  }
}

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** Acepta sólo la forma v1 completa y sanea cada entrada; si no, defaults. */
function parseSave(raw) {
  if (!raw) return defaults();
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return defaults();
  }
  const ok =
    data &&
    typeof data === 'object' &&
    !Array.isArray(data) &&
    data.version === SAVE_VERSION &&
    data.stages &&
    typeof data.stages === 'object' &&
    !Array.isArray(data.stages) &&
    data.mastery &&
    typeof data.mastery === 'object' &&
    !Array.isArray(data.mastery);
  if (!ok) return defaults();

  const stages = {};
  for (const [id, v] of Object.entries(data.stages)) {
    if (!v || typeof v !== 'object' || Array.isArray(v)) continue;
    stages[id] = {
      bestScore: Math.max(0, num(v.bestScore)),
      stars: Math.min(3, Math.max(0, num(v.stars))),
      completedAt: typeof v.completedAt === 'string' ? v.completedAt : '',
    };
  }
  const mastery = {};
  for (const [key, v] of Object.entries(data.mastery)) {
    if (!v || typeof v !== 'object' || Array.isArray(v)) continue;
    mastery[key] = { seen: Math.max(0, num(v.seen)), correct: Math.max(0, num(v.correct)) };
  }
  return { version: SAVE_VERSION, stages, mastery };
}

/**
 * @param {Object} [storage] localStorage, un Map o createMemoryStorage()
 * @returns {import('./types.js').SaveApi}
 */
export function createSave(storage = safeLocalStorage()) {
  let data = parseSave(readRaw(storage));

  function persist() {
    try {
      writeRaw(storage, JSON.stringify(data));
    } catch {
      /* sin storage: el progreso dura sólo esta sesión */
    }
  }

  return {
    get() {
      return data;
    },
    /** Mejora el registro de la etapa: máximo puntaje y estrellas, última fecha. */
    recordStage(id, result = {}) {
      const prev = data.stages[id];
      data.stages[id] = {
        bestScore: Math.max(num(prev?.bestScore), Math.max(0, num(result.score))),
        stars: Math.min(3, Math.max(num(prev?.stars), Math.max(0, num(result.stars)))),
        completedAt: result.completedAt || new Date().toISOString(),
      };
      persist();
      return data.stages[id];
    },
    recordAnswer(partType, ok) {
      const m = data.mastery[partType] || { seen: 0, correct: 0 };
      data.mastery[partType] = { seen: m.seen + 1, correct: m.correct + (ok ? 1 : 0) };
      persist();
      return data.mastery[partType];
    },
    reset() {
      data = defaults();
      removeRaw(storage);
      persist();
      return data;
    },
  };
}
