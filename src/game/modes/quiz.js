// Modo quiz E1: nombrar piezas (docs/plans/2026-09-23-arquitectura-juego.md §6).
// Puro (§21): sin DOM; el azar sale del rng con semilla (§3, D10).

import { createRng } from '../../core/rng.ts';
import { INTENT_TYPES, intents } from '../intents.js';
import { nextStageOf } from '../campaign.js';

export const FEEDBACK_SECONDS = 1.0;
export const STARS_THRESHOLDS = [0.9, 0.7, 0.5];

const STOPWORDS = new Set(['del', 'de', 'la', 'el', 'los', 'las', 'y', 'con', 'sin', 'al', 'en']);

/** Fisher-Yates con el rng del juego, para que todo sea reproducible. */
function shuffle(rng, arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Agrupa piezas que son el mismo concepto (los 4 inyectores): nunca son
 * distractores entre sí y para `find` vale cualquiera (§6).
 * @returns {Array<{ key: string, ids: string[] }>}
 */
export function groupConcepts(parts, ids, sameConcept = []) {
  const groups = [];
  const byKey = new Map();
  for (const id of ids) {
    if (!parts[id]) continue;
    const group = sameConcept.find((g) => g.includes(id));
    const key = group ? [...group].sort().join('|') : id;
    let c = byKey.get(key);
    if (!c) {
      c = { key, ids: group ? group.filter((gid) => parts[gid]) : [id] };
      byKey.set(key, c);
      groups.push(c);
    }
  }
  return groups;
}

/** Nombre del concepto: para un grupo, el prefijo común ("Inyector 1..4" → "Inyector"). */
export function conceptLabel(ids, parts) {
  if (ids.length === 1) return parts[ids[0]].name;
  const roots = ids.map((id) => parts[id].name.replace(/\s*\d+$/, '').trim());
  return roots.every((r) => r === roots[0]) ? roots[0] : parts[ids[0]].name;
}

/** ¿El `why` de la pieza contiene alguna palabra de su propio nombre? */
export function revealsName(parts, id) {
  const why = (parts[id].why || '').toLowerCase();
  const tokens = (parts[id].name || '')
    .toLowerCase()
    .split(/[^\p{L}\d]+/u)
    .filter((t) => t.length >= 4 && !STOPWORDS.has(t));
  return tokens.some((t) => why.includes(t));
}

function partName(parts, id) {
  return parts[id]?.name || id;
}

/**
 * Genera las preguntas de una partida con el rng dado (§6, D10).
 * @param {ReturnType<typeof createRng>} rng
 * @param {Record<string, import('../../core/types.ts').PartInfo>} parts
 * @param {{questions?:number, types?:string[], parts?:string[]|'all', sameConcept?:string[][]}} config
 */
export function generateQuestions(rng, parts, config = {}) {
  const {
    questions = 10,
    types = ['find', 'name', 'purpose'],
    parts: selection = 'all',
    sameConcept = [],
  } = config;
  const ids = selection === 'all' ? Object.keys(parts) : selection.filter((id) => parts[id]);
  const concepts = shuffle(rng, groupConcepts(parts, ids, sameConcept));
  // Los distractores salen de todo el módulo, no sólo de la selección de la etapa.
  const allConcepts = groupConcepts(parts, Object.keys(parts), sameConcept);
  const used = new Set();
  const out = [];

  const safe = (c) => c.ids.some((id) => !revealsName(parts, id));

  for (let i = 0; i < questions; i++) {
    const type = types[i % types.length];
    const pool = type === 'purpose' ? concepts.filter(safe) : concepts;
    const concept = pool.find((c) => !used.has(c.key));
    if (!concept) break;
    used.add(concept.key);
    out.push(makeQuestion(rng, parts, allConcepts, concept, type));
  }
  return out;
}

function makeQuestion(rng, parts, allConcepts, concept, type) {
  if (type === 'find') {
    return {
      type,
      partId: rng.pick(concept.ids),
      validIds: [...concept.ids],
      prompt: `Haz clic en: ${conceptLabel(concept.ids, parts)}`,
    };
  }

  const candidates = type === 'purpose' ? concept.ids.filter((id) => !revealsName(parts, id)) : concept.ids;
  const partId = rng.pick(candidates.length ? candidates : concept.ids);
  const distractors = shuffle(rng, allConcepts.filter((c) => c.key !== concept.key))
    .slice(0, 3)
    .map((c) => {
      const id = rng.pick(c.ids);
      return { id, label: partName(parts, id) };
    });
  const choices = shuffle(rng, [{ id: partId, label: partName(parts, partId) }, ...distractors]);

  if (type === 'name') {
    return { type, partId, choices, prompt: '¿Cómo se llama la pieza resaltada?' };
  }
  return { type: 'purpose', partId, choices, prompt: parts[partId].why };
}

/** Estrellas por porcentaje de aciertos: ≥90 % → 3, ≥70 % → 2, ≥50 % → 1. */
export function starsFor(correct, total) {
  if (!total) return 0;
  const ratio = correct / total;
  if (ratio >= STARS_THRESHOLDS[0]) return 3;
  if (ratio >= STARS_THRESHOLDS[1]) return 2;
  if (ratio >= STARS_THRESHOLDS[2]) return 1;
  return 0;
}

/**
 * @param {import('../types.js').ModeContext} ctx
 * @returns {import('../types.js').GameMode}
 */
export function createQuizMode(ctx) {
  const { session, module, stage, save } = ctx;
  const model = session.model;
  const parts = module.parts || {};
  const config = {
    questions: 10,
    types: ['find', 'name', 'purpose'],
    parts: 'all',
    ...(stage?.config || {}),
  };
  const rng = ctx.rng || createRng(stage?.seed ?? 1);
  const questions = generateQuestions(rng, parts, config);
  const total = questions.length;

  let index = 0;
  let phase = total ? 'question' : 'done';
  let correct = 0;
  let score = 0;
  let streak = 0;
  let bestStreak = 0;
  let timer = 0;
  let announced = false;
  const log = [];

  // El diagrama se ve vivo durante el quiz (§6).
  if (model.params && 'ignitionKey' in model.params) model.params.ignitionKey = 'run';

  const ui = {
    controls: [],
    faults: 'none',
    readouts: [],
    narration: 'off',
    labels: false,
    tooltips: false,
    infoPanel: false,
    presets: false,
    timebar: { maxScale: 4 },
    edit: { draggable: false, connectable: false, palette: [] },
    revealedFaults: [],
  };

  const question = () => questions[index] || null;

  function addLog(level, text) {
    log.push({ level, text });
    if (log.length > 6) log.shift();
  }

  const highlight = (partIds, style) => ({ type: 'highlight', data: { partIds, style } });

  /** Cierra la pregunta actual: puntaje, feedback y racha. */
  function settle(ok, clickedId, q) {
    const target = q.partId;
    timer = FEEDBACK_SECONDS;
    phase = 'feedback';
    const shown = clickedId || target;
    if (ok) {
      correct++;
      streak++;
      bestStreak = Math.max(bestStreak, streak);
      score += 10 + 5 * (streak - 1);
      addLog('good', `¡Correcto! ${partName(parts, shown)}.`);
    } else {
      streak = 0;
      addLog('bad', `Era: ${partName(parts, target)}. Tocaste: ${partName(parts, shown)}.`);
    }
    save?.recordAnswer?.(shown, ok);
    return [
      highlight([shown], ok ? 'correct' : 'wrong'),
      { type: 'feedback', level: ok ? 'good' : 'bad', text: log[log.length - 1].text },
      { type: 'score', data: { score, streak } },
    ];
  }

  function finish() {
    phase = 'done';
    const stars = starsFor(correct, total);
    save?.recordStage?.(stage?.id ?? 'quiz', { score, stars });
    addLog(stars >= 2 ? 'good' : 'info', `Terminaste: ${correct}/${total} aciertos, ${score} puntos, ${stars} estrellas.`);
    return [highlight([], 'selected'), { type: 'stageEnd', data: { score, stars, correct, total } }];
  }

  if (total === 0) finish(); // etapa vacía: cierra una vez para que quede registrada

  return {
    id: 'quiz',
    get ui() {
      return ui;
    },
    get status() {
      return phase === 'done' ? 'won' : 'playing';
    },
    handle(intent) {
      if (!intent || phase !== 'question') return [];
      const q = question();
      if (!q) return [];

      if (intent.type === INTENT_TYPES.selectPart && q.type === 'find' && intent.partId) {
        return settle(q.validIds.includes(intent.partId), intent.partId, q);
      }
      if (intent.type === INTENT_TYPES.answer && q.type !== 'find' && intent.choiceId) {
        return settle(intent.choiceId === q.partId, intent.choiceId, q);
      }
      return [];
    },
    update(simDt) {
      const q = question();
      if (phase === 'question') {
        // El HUD no puede resaltar solo: el modo avisa una única vez por pregunta.
        if (announced || q?.type !== 'name') {
          announced = true;
          return [];
        }
        announced = true;
        return [highlight([q.partId], 'target')];
      }
      if (phase !== 'feedback') return [];
      timer -= simDt;
      if (timer > 0) return [];
      index++;
      if (index >= total) return finish();
      phase = 'question';
      const next = question();
      announced = next?.type === 'name';
      return [highlight(next?.type === 'name' ? [next.partId] : [], 'target')];
    },
    hud() {
      const q = question();
      const stars = starsFor(correct, total);
      const base = {
        title: stage?.title || 'Quiz',
        brief: stage?.brief || '',
        stats: [
          { label: 'Pregunta', value: `${Math.min(index + 1, total)}/${total}` },
          { label: 'Aciertos', value: correct },
          { label: 'Puntos', value: score },
          { label: 'Racha', value: bestStreak },
        ],
        log: [...log],
      };
      if (phase === 'done') {
        return {
          ...base,
          stats: [...base.stats, { label: 'Estrellas', value: '★'.repeat(stars) + '☆'.repeat(3 - stars) }],
          prompt: { text: `Terminaste: ${correct} de ${total} aciertos.` },
          actions: [
            { intent: intents.retry(), label: 'Reintentar', disabled: false },
            ...(stage && nextStageOf(stage.id)
              ? [{ intent: intents.nextStage(), label: 'Siguiente etapa', disabled: false }]
              : []),
            { intent: intents.quit(), label: 'Volver al taller', disabled: false },
          ],
        };
      }
      if (!q) return base;
      if (q.type === 'find') return { ...base, prompt: { text: q.prompt } };
      return {
        ...base,
        prompt: { text: q.type === 'name' ? q.prompt : `¿Qué pieza cumple esta función? “${q.prompt}”`, choices: q.choices },
      };
    },
    onReset() {
      session.reset();
      if (model.params && 'ignitionKey' in model.params) model.params.ignitionKey = 'run';
      index = 0;
      phase = total ? 'question' : 'done';
      correct = 0;
      score = 0;
      streak = 0;
      bestStreak = 0;
      timer = 0;
      announced = false;
      log.length = 0;
    },
    destroy() {
      log.length = 0;
    },
  };
}
