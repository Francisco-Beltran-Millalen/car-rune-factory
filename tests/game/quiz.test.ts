import { describe, it, expect, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { createRng } from '../../src/core/rng.ts';
import type { PartInfo } from '../../src/core/types.ts';
import { stages, getStage, isStageUnlocked, nextStageOf } from '../../src/game/campaign.ts';
import { intents } from '../../src/game/intents.ts';
import {
  createQuizMode,
  FEEDBACK_SECONDS,
  generateQuestions,
  revealsName,
  starsFor,
  type ChoiceQuestion,
  type FindQuestion,
} from '../../src/game/modes/quiz.ts';
import { createSession } from '../../src/game/session.ts';
import type { QuizStageConfig, SaveApi, Stage } from '../../src/game/types.ts';
import { parts as contentParts } from '../../src/modules/fuel/content.ts';

// El contenido cumple el contrato PartInfo; el alias deja claro el uso en el test.
const parts: Readonly<Record<string, PartInfo>> = contentParts;

const INJ = [['injector1', 'injector2', 'injector3', 'injector4']];
const SEED = 7;

const quizStage = (config: QuizStageConfig, id = 'test-quiz'): Stage => ({
  id,
  mode: 'quiz',
  module: 'fuel',
  title: 'Test',
  brief: 'Brief de prueba',
  seed: 1,
  unlockAfter: [],
  config,
});

function createModel() {
  const params = { ignitionKey: 'off' };
  return {
    params,
    faults: {},
    state: {},
    time: 0,
    step() {},
    reset() {
      params.ignitionKey = 'off';
    },
    actions: {},
  };
}

function makeMode(stage: Stage) {
  const module = { id: 'fuel', title: 'Fuel', parts, createModel };
  const session = createSession({ createModel, driver: 'external' });
  const save: SaveApi = {
    get: vi.fn(),
    recordStage: vi.fn(),
    recordAnswer: vi.fn(),
    reset: vi.fn(),
  };
  const mode = createQuizMode({ session, module, stage, rng: createRng(SEED), save });
  return { mode, session, save };
}

const conceptKey = (id: string): string => (/^injector\d+$/.test(id) ? 'injector' : id);

describe('generación de preguntas del quiz (§6)', () => {
  const config: QuizStageConfig = { questions: 9, types: ['find', 'name', 'purpose'], parts: 'all', sameConcept: INJ };

  it('es determinista con la misma semilla', () => {
    const a = generateQuestions(createRng(42), parts, config);
    const b = generateQuestions(createRng(42), parts, config);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.length).toBe(9);
  });

  it('no repite concepto y respeta el tope de preguntas', () => {
    const qs = generateQuestions(createRng(3), parts, { ...config, questions: 16, types: ['find'] });
    expect(qs.length).toBe(16);
    expect(new Set(qs.map((q) => conceptKey(q.partId))).size).toBe(16);
  });

  it('los 4 inyectores son un solo concepto para `find`', () => {
    const q = generateQuestions(createRng(1), parts, {
      questions: 1,
      types: ['find'],
      parts: ['injector1'],
      sameConcept: INJ,
    })[0] as FindQuestion;
    expect(q.validIds).toEqual(['injector1', 'injector2', 'injector3', 'injector4']);
    expect(q.prompt).toBe('Haz clic en: Inyector');
  });

  it('el arnés de cables es una pieza propia, no un inyector más', () => {
    const qs = generateQuestions(createRng(5), parts, {
      questions: 30,
      types: ['find'],
      parts: 'all',
      sameConcept: INJ,
    });
    const wires = qs.find((q) => q.partId === 'injectorWires');
    expect(wires).toBeDefined();
    if (wires?.type !== 'find') throw new Error('invariante: el arnés es una pregunta de tipo find');
    expect(wires.validIds).toEqual(['injectorWires']);
    expect(wires.prompt).toBe('Haz clic en: Arnés de los inyectores');
    for (const q of qs) {
      if (q.type === 'find' && q.prompt.includes('Inyector')) expect(q.validIds).not.toContain('injectorWires');
    }
  });

  it('distractores válidos: 4 nombres únicos, la correcta incluida y sin inyectores entre sí', () => {
    const qs = generateQuestions(createRng(9), parts, config).filter((q): q is ChoiceQuestion => q.type !== 'find');
    expect(qs.length).toBeGreaterThan(0);
    for (const q of qs) {
      expect(q.choices.length).toBe(4);
      const ids = q.choices.map((c) => c.id);
      expect(new Set(ids).size).toBe(4);
      expect(ids).toContain(q.partId);
      const injectors = ids.filter((id) => /^injector\d+$/.test(id));
      expect(injectors.length).toBeLessThanOrEqual(1);
    }
  });

  it('las preguntas de propósito no nombran la pieza', () => {
    const qs = generateQuestions(createRng(11), parts, config).filter((q): q is ChoiceQuestion => q.type === 'purpose');
    expect(qs.length).toBeGreaterThan(0);
    for (const q of qs) {
      expect(q.prompt).toBe(parts[q.partId]!.why);
      expect(revealsName(parts, q.partId)).toBe(false);
    }
  });

  it('starsFor: ≥90 % → 3, ≥70 % → 2, ≥50 % → 1', () => {
    expect(starsFor(10, 10)).toBe(3);
    expect(starsFor(9, 10)).toBe(3);
    expect(starsFor(7, 10)).toBe(2);
    expect(starsFor(5, 10)).toBe(1);
    expect(starsFor(4, 10)).toBe(0);
    expect(starsFor(0, 0)).toBe(0);
  });
});

describe('modo quiz', () => {
  it('arranca con la UI de quiz y el motor en marcha', () => {
    const stage = quizStage({ questions: 2, types: ['find'], parts: ['tank', 'pump'] });
    const { mode, session } = makeMode(stage);

    expect(mode.id).toBe('quiz');
    expect(mode.status).toBe('playing');
    expect(mode.ui.labels).toBe(false);
    expect(mode.ui.tooltips).toBe(false);
    expect(mode.ui.infoPanel).toBe(false);
    expect(mode.ui.presets).toBe(false);
    expect(mode.ui.controls).toEqual([]);
    expect(mode.ui.faults).toBe('none');
    expect(mode.ui.readouts).toEqual([]);
    expect(mode.ui.narration).toBe('off');
    expect(session.model.params.ignitionKey).toBe('run');
  });

  it('`find`: acierto puntúa, avanza y cierra la etapa con guardado', () => {
    const stage = quizStage({ questions: 2, types: ['find'], parts: ['tank', 'pump'] });
    const { mode, save } = makeMode(stage);
    const expected = generateQuestions(createRng(SEED), parts, stage.config) as FindQuestion[];

    const evs = mode.handle(intents.selectPart(expected[0]!.validIds[0]!));
    expect(evs.some((e) => e.type === 'highlight' && e.data.style === 'correct')).toBe(true);
    expect(save.recordAnswer).toHaveBeenCalledWith(expected[0]!.validIds[0]!, true);
    expect(mode.hud().stats.find((s) => s.label === 'Aciertos')!.value).toBe(1);

    const next = mode.update(FEEDBACK_SECONDS + 0.05);
    expect(next.some((e) => e.type === 'highlight')).toBe(true);

    mode.handle(intents.selectPart(expected[1]!.validIds[0]!));
    const end = mode.update(FEEDBACK_SECONDS + 0.05);
    expect(mode.status).toBe('won');
    expect(end.some((e) => e.type === 'stageEnd')).toBe(true);
    expect(save.recordStage).toHaveBeenCalledWith(stage.id, expect.objectContaining({ stars: 3 }));
  });

  it('`find`: fallo da feedback malo, corta la racha y no avanza solo', () => {
    const stage = quizStage({ questions: 2, types: ['find'], parts: ['tank', 'pump'] });
    const { mode, save } = makeMode(stage);
    const expected = generateQuestions(createRng(SEED), parts, stage.config) as FindQuestion[];
    const wrongId = Object.keys(parts).find((id) => !expected[0]!.validIds.includes(id))!;

    const evs = mode.handle(intents.selectPart(wrongId));
    expect(evs.some((e) => e.type === 'highlight' && e.data.style === 'wrong')).toBe(true);
    expect(evs.some((e) => e.type === 'feedback' && e.level === 'bad')).toBe(true);
    expect(save.recordAnswer).toHaveBeenCalledWith(wrongId, false);
    expect(mode.hud().stats.find((s) => s.label === 'Racha')!.value).toBe(0);
    expect(mode.status).toBe('playing');
  });

  it('`name`: anuncia la pieza objetivo y ofrece 4 nombres', () => {
    const stage = quizStage({ questions: 1, types: ['name'], parts: ['tank', 'pump', 'filter', 'rail'] });
    const { mode } = makeMode(stage);
    const q = generateQuestions(createRng(SEED), parts, stage.config)[0]!;

    const announce = mode.update(0);
    expect(announce).toEqual([{ type: 'highlight', data: { partIds: [q.partId], style: 'target' } }]);
    expect(mode.update(0.016)).toEqual([]); // no repite el anuncio cada frame

    const hud = mode.hud();
    const choices = hud.prompt!.choices!;
    expect(choices.length).toBe(4);
    const chosen = choices.find((c) => c.id === q.partId)!;
    const evs = mode.handle(intents.answer(chosen.id));
    expect(evs.some((e) => e.type === 'highlight' && e.data.style === 'correct')).toBe(true);
  });

  it('`purpose` muestra el `why` y responde con el nombre', () => {
    const stage = quizStage({ questions: 1, types: ['purpose'], parts: ['filter', 'pump', 'rail', 'manifold'] });
    const { mode } = makeMode(stage);
    const q = generateQuestions(createRng(SEED), parts, stage.config)[0]!;

    expect(mode.hud().prompt!.text).toContain(q.prompt);
    const evs = mode.handle(intents.answer(q.partId));
    expect(evs.some((e) => e.type === 'feedback' && e.level === 'good')).toBe(true);
  });

  it('onReset reinicia la partida y deja el motor en marcha', () => {
    const stage = quizStage({ questions: 2, types: ['find'], parts: ['tank', 'pump'] });
    const { mode, session } = makeMode(stage);
    const expected = generateQuestions(createRng(SEED), parts, stage.config) as FindQuestion[];

    mode.handle(intents.selectPart(expected[0]!.validIds[0]!));
    mode.onReset!();

    expect(mode.status).toBe('playing');
    expect(mode.hud().stats.find((s) => s.label === 'Aciertos')!.value).toBe(0);
    expect(mode.hud().stats.find((s) => s.label === 'Pregunta')!.value).toBe('1/2');
    expect(session.model.params.ignitionKey).toBe('run');
  });

  it('puntúa aciertos ×10 más el bono de racha', () => {
    const stage = quizStage({ questions: 3, types: ['find'], parts: ['tank', 'pump', 'filter'] });
    const { mode } = makeMode(stage);
    const expected = generateQuestions(createRng(SEED), parts, stage.config) as FindQuestion[];

    for (const q of expected) {
      mode.handle(intents.selectPart(q.validIds[0]!));
      mode.update(FEEDBACK_SECONDS + 0.05);
    }
    const stats = mode.hud().stats;
    expect(stats.find((s) => s.label === 'Aciertos')!.value).toBe(3);
    expect(stats.find((s) => s.label === 'Puntos')!.value).toBe(45); // 10 + 15 + 20
    expect(mode.status).toBe('won');
  });

  it('durante el feedback ignora más respuestas', () => {
    const stage = quizStage({ questions: 2, types: ['find'], parts: ['tank', 'pump'] });
    const { mode, save } = makeMode(stage);
    const expected = generateQuestions(createRng(SEED), parts, stage.config) as FindQuestion[];

    mode.handle(intents.selectPart(expected[0]!.validIds[0]!));
    expect(mode.handle(intents.selectPart(expected[0]!.validIds[0]!))).toEqual([]);
    expect(save.recordAnswer).toHaveBeenCalledTimes(1);
  });

  it('una etapa sin preguntas cierra una vez y queda registrada', () => {
    const stage = quizStage({ questions: 0, types: ['find'], parts: ['tank'] });
    const { mode, save } = makeMode(stage);

    expect(mode.status).toBe('won');
    expect(save.recordStage).toHaveBeenCalledTimes(1);
  });
});

describe('campaña (§6.8)', () => {
  it('lista las etapas en orden y cada una apunta a un módulo y modo', () => {
    expect(stages.map((s) => s.id)).toEqual(['fuel-quiz-1', 'fuel-quiz-2']);
    for (const s of stages) {
      expect(s.mode).toBe('quiz');
      expect(s.module).toBe('fuel');
      expect(Number.isFinite(s.seed)).toBe(true);
      const selected = s.config.parts ?? 'all';
      for (const id of selected === 'all' ? [] : selected) {
        expect(parts[id], `${s.id}.${id}`).toBeDefined();
      }
    }
  });

  it('desbloquea por etapas previas completadas', () => {
    expect(isStageUnlocked(getStage('fuel-quiz-1'), { stages: {} })).toBe(true);
    expect(isStageUnlocked(getStage('fuel-quiz-2'), { stages: {} })).toBe(false);
    expect(isStageUnlocked(getStage('fuel-quiz-2'), { stages: { 'fuel-quiz-1': { stars: 1 } } })).toBe(true);
  });

  it('las etapas del combustible agrupan los 4 inyectores como un concepto', () => {
    for (const s of stages.filter((st) => st.module === 'fuel')) {
      expect((s.config.sameConcept ?? []).flat()).toEqual(
        expect.arrayContaining(['injector1', 'injector2', 'injector3', 'injector4']),
      );
    }
  });

  it('nextStageOf encadena y termina en null', () => {
    expect(nextStageOf('fuel-quiz-1')!.id).toBe('fuel-quiz-2');
    expect(nextStageOf('fuel-quiz-2')).toBe(null);
    expect(nextStageOf('nope')).toBe(null);
  });
});

describe('etiquetas delatoras en el renderer (riesgo §6)', () => {
  const dir = new URL('../../src/render/svg/drawers/', import.meta.url);
  const src = readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((name) => name.endsWith('.ts'))
    .map((name) => readFileSync(new URL(name, dir), 'utf8'))
    .join('\n');
  const classAfter = (text: string): string | null => {
    const i = src.indexOf(`'${text}',`);
    if (i < 0) return null;
    const j = src.indexOf('className:', i);
    const k = src.indexOf("'", j + 10);
    const l = src.indexOf("'", k + 1);
    return src.slice(k + 1, l);
  };

  it('cada etiqueta de nombre lleva part-label', () => {
    const names = [
      'Batería',
      'Relé',
      'ECU',
      'Estanque',
      'Bomba',
      'Colador',
      'Check',
      'Alimentación →',
      'Filtro',
      'Riel',
      'Múltiple de admisión',
      'Regulador',
      '← Retorno al estanque',
    ];
    for (const name of names) {
      const cls = classAfter(name);
      expect(cls, name).toBeTruthy();
      expect(cls, name).toContain('part-label');
    }
  });

  it('las etiquetas de valor no llevan part-label', () => {
    expect(src).not.toMatch(/lbl-mono[^']*part-label|part-label[^']*lbl-mono/);
    expect(src).not.toMatch(/tag-text[^']*part-label|part-label[^']*tag-text/);
    expect(src).not.toMatch(/inj-num[^']*part-label|part-label[^']*inj-num/);
  });
});
