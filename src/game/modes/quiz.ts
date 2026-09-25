// Modo quiz E1: nombrar piezas (docs/plans/2026-09-23-arquitectura-juego.md §6).
// Puro (§21): sin DOM; el azar sale del rng con semilla (§3, D10).

import type { PartInfo } from '../../core/types.ts';
import { createRng, type Rng } from '../../core/rng.ts';
import { nextStageOf } from '../campaign.ts';
import { INTENT_TYPES, intents } from '../intents.ts';
import type {
  GameMode,
  HighlightStyle,
  HudLogLine,
  HudModel,
  ModeContext,
  ModeEvent,
  ModeUi,
  QuizQuestionType,
  QuizStageConfig,
} from '../types.ts';

export const FEEDBACK_SECONDS = 1.0;
export const STARS_THRESHOLDS = [0.9, 0.7, 0.5];

const STOPWORDS = new Set(['del', 'de', 'la', 'el', 'los', 'las', 'y', 'con', 'sin', 'al', 'en']);

export interface Concept {
  key: string;
  ids: string[];
}

export interface QuizChoice {
  id: string;
  label: string;
}

export interface FindQuestion {
  type: 'find';
  partId: string;
  validIds: string[];
  prompt: string;
}

export interface ChoiceQuestion {
  type: 'name' | 'purpose';
  partId: string;
  choices: QuizChoice[];
  prompt: string;
}

export type QuizQuestion = FindQuestion | ChoiceQuestion;

export interface QuizMode extends GameMode {
  hud(): HudModel;
}

/** Fisher-Yates con el rng del juego, para que todo sea reproducible. */
function shuffle<T>(rng: Rng, arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    const ai = a[i];
    const aj = a[j];
    if (ai === undefined || aj === undefined) continue;
    a[i] = aj;
    a[j] = ai;
  }
  return a;
}

/**
 * Agrupa piezas que son el mismo concepto (los 4 inyectores): nunca son
 * distractores entre sí y para `find` vale cualquiera (§6).
 */
export function groupConcepts(
  parts: Readonly<Record<string, PartInfo>>,
  ids: readonly string[],
  sameConcept: readonly (readonly string[])[] = [],
): Concept[] {
  const groups: Concept[] = [];
  const byKey = new Map<string, Concept>();
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
export function conceptLabel(
  ids: readonly string[],
  parts: Readonly<Record<string, PartInfo>>,
): string {
  const first = ids[0];
  if (!first) return '';
  const firstName = parts[first]?.name ?? first;
  if (ids.length === 1) return firstName;
  const roots = ids.map((id) => (parts[id]?.name ?? id).replace(/\s*\d+$/, '').trim());
  return roots.every((r) => r === roots[0]) ? (roots[0] ?? firstName) : firstName;
}

/** ¿El `why` de la pieza contiene alguna palabra de su propio nombre? */
export function revealsName(
  parts: Readonly<Record<string, PartInfo>>,
  id: string,
): boolean {
  const p = parts[id];
  if (!p) return false;
  const why = (p.why || '').toLowerCase();
  const tokens = (p.name || '')
    .toLowerCase()
    .split(/[^\p{L}\d]+/u)
    .filter((t) => t.length >= 4 && !STOPWORDS.has(t));
  return tokens.some((t) => why.includes(t));
}

function partName(parts: Readonly<Record<string, PartInfo>>, id: string): string {
  return parts[id]?.name ?? id;
}

/**
 * Genera las preguntas de una partida con el rng dado (§6, D10).
 */
export function generateQuestions(
  rng: Rng,
  parts: Readonly<Record<string, PartInfo>>,
  config: QuizStageConfig = {},
): QuizQuestion[] {
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
  const used = new Set<string>();
  const out: QuizQuestion[] = [];

  const safe = (c: Concept): boolean => c.ids.some((id) => !revealsName(parts, id));

  for (let i = 0; i < questions; i++) {
    const type = types[i % types.length] ?? 'purpose';
    const pool = type === 'purpose' ? concepts.filter(safe) : concepts;
    const concept = pool.find((c) => !used.has(c.key));
    if (!concept) break;
    used.add(concept.key);
    out.push(makeQuestion(rng, parts, allConcepts, concept, type));
  }
  return out;
}

function makeQuestion(
  rng: Rng,
  parts: Readonly<Record<string, PartInfo>>,
  allConcepts: readonly Concept[],
  concept: Concept,
  type: QuizQuestionType,
): QuizQuestion {
  if (type === 'find') {
    return {
      type,
      partId: rng.pick(concept.ids),
      validIds: [...concept.ids],
      prompt: `Haz clic en: ${conceptLabel(concept.ids, parts)}`,
    };
  }

  const candidates =
    type === 'purpose' ? concept.ids.filter((id) => !revealsName(parts, id)) : concept.ids;
  const partId = rng.pick(candidates.length ? candidates : concept.ids);
  const distractors: QuizChoice[] = shuffle(
    rng,
    allConcepts.filter((c) => c.key !== concept.key),
  )
    .slice(0, 3)
    .map((c) => {
      const id = rng.pick(c.ids);
      return { id, label: partName(parts, id) };
    });
  const choices = shuffle(rng, [{ id: partId, label: partName(parts, partId) }, ...distractors]);

  if (type === 'name') {
    return { type, partId, choices, prompt: '¿Cómo se llama la pieza resaltada?' };
  }
  return { type: 'purpose', partId, choices, prompt: parts[partId]?.why ?? '' };
}

/** Estrellas por porcentaje de aciertos: ≥90 % → 3, ≥70 % → 2, ≥50 % → 1. */
export function starsFor(correct: number, total: number): number {
  if (!total) return 0;
  const ratio = correct / total;
  if (ratio >= (STARS_THRESHOLDS[0] ?? 1)) return 3;
  if (ratio >= (STARS_THRESHOLDS[1] ?? 1)) return 2;
  if (ratio >= (STARS_THRESHOLDS[2] ?? 1)) return 1;
  return 0;
}

export function createQuizMode(ctx: ModeContext): QuizMode {
  const { session, module, stage, save } = ctx;
  const model = session.model;
  const parts = module.parts ?? {};
  const config: QuizStageConfig = {
    questions: 10,
    types: ['find', 'name', 'purpose'],
    parts: 'all',
    ...stage?.config,
  };
  const rng = ctx.rng ?? createRng(stage?.seed ?? 1);
  const questions = generateQuestions(rng, parts, config);
  const total = questions.length;

  let index = 0;
  let phase: 'question' | 'feedback' | 'done' = total ? 'question' : 'done';
  let correct = 0;
  let score = 0;
  let streak = 0;
  let bestStreak = 0;
  let timer = 0;
  let announced = false;
  const log: HudLogLine[] = [];

  // El diagrama se ve vivo durante el quiz (§6).
  if ('ignitionKey' in model.params) model.params['ignitionKey'] = 'run';

  const ui: ModeUi = {
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

  const question = (): QuizQuestion | null => questions[index] ?? null;

  function addLog(level: HudLogLine['level'], text: string): void {
    log.push({ level, text });
    if (log.length > 6) log.shift();
  }

  const highlight = (
    partIds: readonly string[],
    style: HighlightStyle,
  ): ModeEvent => ({ type: 'highlight', data: { partIds, style } });

  /** Cierra la pregunta actual: puntaje, feedback y racha. */
  function settle(ok: boolean, clickedId: string | null, q: QuizQuestion): ModeEvent[] {
    const target = q.partId;
    timer = FEEDBACK_SECONDS;
    phase = 'feedback';
    const shown = clickedId ?? target;
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
    const last = log[log.length - 1];
    if (!last) throw new Error('invariante: settle siempre agrega un log');
    save?.recordAnswer(shown, ok);
    return [
      highlight([shown], ok ? 'correct' : 'wrong'),
      { type: 'feedback', level: ok ? 'good' : 'bad', text: last.text },
      { type: 'score', data: { score, streak } },
    ];
  }

  function finish(): ModeEvent[] {
    phase = 'done';
    const stars = starsFor(correct, total);
    save?.recordStage(stage?.id ?? 'quiz', { score, stars });
    addLog(stars >= 2 ? 'good' : 'info', `Terminaste: ${correct}/${total} aciertos, ${score} puntos, ${stars} estrellas.`);
    return [highlight([], 'selected'), { type: 'stageEnd', data: { score, stars, correct, total } }];
  }

  if (total === 0) finish(); // etapa vacía: cierra una vez para que quede registrada

  return {
    id: 'quiz',
    get ui(): ModeUi {
      return ui;
    },
    get status(): 'playing' | 'won' {
      return phase === 'done' ? 'won' : 'playing';
    },
    handle(intent): ModeEvent[] {
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
    update(simDt): ModeEvent[] {
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
      if (next?.type === 'name') return [highlight([next.partId], 'target')];
      return [highlight([], 'target')];
    },
    hud(): HudModel {
      const q = question();
      const stars = starsFor(correct, total);
      const base: HudModel = {
        title: stage?.title ?? 'Quiz',
        brief: stage?.brief ?? '',
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
        prompt: {
          text: q.type === 'name' ? q.prompt : `¿Qué pieza cumple esta función? “${q.prompt}”`,
          choices: q.choices,
        },
      };
    },
    onReset(): void {
      session.reset();
      if ('ignitionKey' in model.params) model.params['ignitionKey'] = 'run';
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
    destroy(): void {
      log.length = 0;
    },
  };
}
