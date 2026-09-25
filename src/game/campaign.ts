// Campaña: lista ordenada de etapas y reglas de desbloqueo (CONTRATOS.md §6.8).

import fuelQuiz1 from './stages/fuel-quiz-1.ts';
import fuelQuiz2 from './stages/fuel-quiz-2.ts';
import type { Stage } from './types.ts';

export const stages: readonly Stage[] = [fuelQuiz1, fuelQuiz2];

export interface UnlockSave {
  readonly stages?: Readonly<Record<string, unknown>>;
}

export function getStage(id: string): Stage | null {
  return stages.find((s) => s.id === id) ?? null;
}

/** ¿Están completas todas las etapas de `unlockAfter`? */
export function isStageUnlocked(stage: Stage | null, saveData: UnlockSave | null): boolean {
  const done = saveData?.stages ?? {};
  return (stage?.unlockAfter ?? []).every((id) => !!done[id]);
}

export function nextStageOf(id: string): Stage | null {
  const i = stages.findIndex((s) => s.id === id);
  return i >= 0 && i + 1 < stages.length ? (stages[i + 1] ?? null) : null;
}
