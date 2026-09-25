// Constructores de intents del juego (CONTRATOS.md §6.2).
// Canal único de entrada del jugador (§20).

import type { ParamValue } from '../core/types.ts';

/** Los intents sin payload lo declaran como `undefined`. */
export type NoPayload = undefined;

export interface IntentPayloads {
  setParam: { key: string; value: ParamValue };
  setFault: { key: string; value: ParamValue };
  resetFaults: NoPayload;
  applyPreset: { presetId: string };
  action: { name: string; args: readonly unknown[] };
  selectPart: { partId: string | null };
  hoverPart: { partId: string | null };
  answer: { choiceId: string };
  useTool: { toolId: string; partId: string | null };
  removeTool: { toolId: string };
  replacePart: { partId: string };
  deliver: NoPayload;
  markSuspect: { partId: string; mark: 'suspect' | 'cleared' | null };
  placePart: { partType: string; x: number; y: number };
  movePart: { partId: string; x: number; y: number };
  rotatePart: { partId: string };
  deletePart: { partId: string };
  connect: { from: string; to: string };
  disconnect: { linkId: string };
  runTest: NoPayload;
  nextStage: NoPayload;
  retry: NoPayload;
  quit: NoPayload;
}

export type IntentType = keyof IntentPayloads;

export type Intent = {
  [K in IntentType]: IntentPayloads[K] extends NoPayload
    ? { type: K }
    : { type: K } & IntentPayloads[K];
}[IntentType];

export type IntentOf<K extends IntentType> = Extract<Intent, { type: K }>;

export const INTENT_TYPES = {
  setParam: 'setParam',
  setFault: 'setFault',
  resetFaults: 'resetFaults',
  applyPreset: 'applyPreset',
  action: 'action',
  selectPart: 'selectPart',
  hoverPart: 'hoverPart',
  answer: 'answer',
  useTool: 'useTool',
  removeTool: 'removeTool',
  replacePart: 'replacePart',
  deliver: 'deliver',
  markSuspect: 'markSuspect',
  placePart: 'placePart',
  movePart: 'movePart',
  rotatePart: 'rotatePart',
  deletePart: 'deletePart',
  connect: 'connect',
  disconnect: 'disconnect',
  runTest: 'runTest',
  nextStage: 'nextStage',
  retry: 'retry',
  quit: 'quit',
} as const satisfies Record<IntentType, IntentType>;

export const intents = {
  setParam: (key: string, value: ParamValue): IntentOf<'setParam'> => ({
    type: INTENT_TYPES.setParam,
    key,
    value,
  }),
  setFault: (key: string, value: ParamValue): IntentOf<'setFault'> => ({
    type: INTENT_TYPES.setFault,
    key,
    value,
  }),
  resetFaults: (): IntentOf<'resetFaults'> => ({ type: INTENT_TYPES.resetFaults }),
  applyPreset: (presetId: string): IntentOf<'applyPreset'> => ({
    type: INTENT_TYPES.applyPreset,
    presetId,
  }),
  action: (name: string, args: readonly unknown[] = []): IntentOf<'action'> => ({
    type: INTENT_TYPES.action,
    name,
    args,
  }),
  selectPart: (partId: string | null): IntentOf<'selectPart'> => ({
    type: INTENT_TYPES.selectPart,
    partId: partId ?? null,
  }),
  hoverPart: (partId: string | null): IntentOf<'hoverPart'> => ({
    type: INTENT_TYPES.hoverPart,
    partId: partId ?? null,
  }),
  answer: (choiceId: string): IntentOf<'answer'> => ({
    type: INTENT_TYPES.answer,
    choiceId,
  }),
  useTool: (toolId: string, partId: string | null = null): IntentOf<'useTool'> => ({
    type: INTENT_TYPES.useTool,
    toolId,
    partId,
  }),
  removeTool: (toolId: string): IntentOf<'removeTool'> => ({
    type: INTENT_TYPES.removeTool,
    toolId,
  }),
  replacePart: (partId: string): IntentOf<'replacePart'> => ({
    type: INTENT_TYPES.replacePart,
    partId,
  }),
  deliver: (): IntentOf<'deliver'> => ({ type: INTENT_TYPES.deliver }),
  markSuspect: (
    partId: string,
    mark: 'suspect' | 'cleared' | null = null,
  ): IntentOf<'markSuspect'> => ({
    type: INTENT_TYPES.markSuspect,
    partId,
    mark,
  }),
  placePart: (partType: string, x: number, y: number): IntentOf<'placePart'> => ({
    type: INTENT_TYPES.placePart,
    partType,
    x,
    y,
  }),
  movePart: (partId: string, x: number, y: number): IntentOf<'movePart'> => ({
    type: INTENT_TYPES.movePart,
    partId,
    x,
    y,
  }),
  rotatePart: (partId: string): IntentOf<'rotatePart'> => ({
    type: INTENT_TYPES.rotatePart,
    partId,
  }),
  deletePart: (partId: string): IntentOf<'deletePart'> => ({
    type: INTENT_TYPES.deletePart,
    partId,
  }),
  connect: (from: string, to: string): IntentOf<'connect'> => ({
    type: INTENT_TYPES.connect,
    from,
    to,
  }),
  disconnect: (linkId: string): IntentOf<'disconnect'> => ({
    type: INTENT_TYPES.disconnect,
    linkId,
  }),
  runTest: (): IntentOf<'runTest'> => ({ type: INTENT_TYPES.runTest }),
  nextStage: (): IntentOf<'nextStage'> => ({ type: INTENT_TYPES.nextStage }),
  retry: (): IntentOf<'retry'> => ({ type: INTENT_TYPES.retry }),
  quit: (): IntentOf<'quit'> => ({ type: INTENT_TYPES.quit }),
};
