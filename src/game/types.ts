// Tipos del juego y modos (CONTRATOS.md §6). Puros, sin DOM (§1).

import type { HistoryReadout, Recorder } from '../core/history.ts';
import type { Loop } from '../core/loop.ts';
import type { Rng } from '../core/rng.ts';
import type {
  Model,
  ParamRecord,
  PartInfo,
  Preset,
} from '../core/types.ts';
import type { Intent } from './intents.ts';

export interface SessionOptions<M extends Model = Model> {
  createModel: () => M;
  readouts?: readonly HistoryReadout[];
  /** 'external': alguien llama session.tick(realDt). */
  driver?: 'raf' | 'external';
  raf?: (cb: FrameRequestCallback) => number;
  caf?: (id: number) => void;
}

export interface Session<M extends Model = Model> {
  readonly model: M;
  readonly loop: Loop;
  readonly recorder: Recorder;
  tick(realDt: number): number;
  onFrame(cb: (simDt: number, steps: number) => void): () => void;
  start(): void;
  stop(): void;
  reset(): void;
  destroy(): void;
}

export type NarrationMode = 'full' | 'hints' | 'off';
export type HighlightStyle = 'selected' | 'correct' | 'wrong' | 'target';

export interface ModeUi {
  controls: readonly string[] | 'all';
  faults: readonly string[] | 'all' | 'none';
  readouts: readonly string[] | 'all';
  narration: NarrationMode;
  labels: boolean;
  tooltips: boolean;
  infoPanel: boolean;
  presets: boolean;
  timebar: { maxScale: number };
  edit: { draggable: boolean; connectable: boolean; palette: readonly string[] };
  revealedFaults: readonly string[];
}

export type ModeEvent =
  | {
      type: 'feedback';
      level: 'info' | 'good' | 'bad';
      text: string;
      data?: { preset: Preset };
    }
  | { type: 'score'; data: { score: number; streak: number } }
  | {
      type: 'stageEnd';
      data: { score: number; stars: number; correct: number; total: number };
    }
  | { type: 'uiChanged' }
  | {
      type: 'highlight';
      data: { partIds: readonly string[]; style: HighlightStyle };
    };

export type QuizQuestionType = 'find' | 'name' | 'purpose';

export interface QuizStageConfig {
  questions?: number;
  types?: readonly QuizQuestionType[];
  parts?: 'all' | readonly string[];
  sameConcept?: readonly (readonly string[])[];
}

export interface QuizStage {
  id: string;
  mode: 'quiz';
  module: string;
  title: string;
  brief: string;
  seed: number;
  unlockAfter?: readonly string[];
  config: QuizStageConfig;
}

/** A3 sumará los modos diagnosis y assembly a la unión. */
export type Stage = QuizStage;

export interface StageRecord {
  bestScore: number;
  stars: number;
  completedAt: string;
}

export interface MasteryRecord {
  seen: number;
  correct: number;
}

export interface SaveData {
  version: number;
  stages: Record<string, StageRecord>;
  mastery: Record<string, MasteryRecord>;
}

export interface StageResult {
  score?: number;
  stars?: number;
  completedAt?: string;
}

export interface SaveApi {
  get(): SaveData;
  recordStage(id: string, result?: StageResult): StageRecord;
  recordAnswer(partType: string, ok: boolean): MasteryRecord;
  reset(): SaveData;
}

export interface HudChoice {
  id: string;
  label: string;
}

export interface HudStat {
  label: string;
  value: string | number;
}

export interface HudTool {
  id: string;
  label: string;
  active: boolean;
  cost: number;
}

export interface HudAction {
  intent: Intent;
  label: string;
  disabled: boolean;
}

export interface HudSuspect {
  partId: string;
  label: string;
  mark: 'suspect' | 'cleared' | null;
}

export interface HudLogLine {
  level: 'info' | 'good' | 'bad';
  text: string;
}

export interface HudModel {
  title: string;
  brief: string;
  stats: readonly HudStat[];
  prompt?: { text: string; choices?: readonly HudChoice[] };
  tools?: readonly HudTool[];
  actions?: readonly HudAction[];
  suspects?: readonly HudSuspect[];
  log: readonly HudLogLine[];
}

/** Lo mínimo que un modo necesita del sistema (el descriptor entero lo cumple). */
export interface KeyedFault {
  readonly key: string;
}

export interface ModeModule {
  readonly id: string;
  readonly parts?: Readonly<Record<string, PartInfo>>;
  readonly faults?: readonly KeyedFault[];
  readonly defaultFaults?: Readonly<ParamRecord>;
  readonly presets?: readonly Preset[];
}

export interface ModeContext {
  session: Session;
  module: ModeModule;
  stage: Stage | null;
  rng?: Rng;
  save?: SaveApi;
}

export type GameStatus = 'playing' | 'won' | 'lost' | 'free';

export interface GameMode {
  readonly id: string;
  readonly ui: ModeUi;
  handle(intent: Intent | null): ModeEvent[];
  update(simDt: number): ModeEvent[];
  hud(): HudModel | null;
  readonly status: GameStatus;
  onReset?(): void;
  destroy(): void;
}

export interface LabMode extends GameMode {
  readonly activePreset: Preset | null;
}
