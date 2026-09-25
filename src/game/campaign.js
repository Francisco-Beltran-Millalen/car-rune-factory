// Campaña: lista ordenada de etapas y reglas de desbloqueo (CONTRATOS.md §6.8).

import fuelQuiz1 from './stages/fuel-quiz-1.js';
import fuelQuiz2 from './stages/fuel-quiz-2.js';

export const stages = [fuelQuiz1, fuelQuiz2];

export function getStage(id) {
  return stages.find((s) => s.id === id) || null;
}

/** ¿Están completas todas las etapas de `unlockAfter`? */
export function isStageUnlocked(stage, saveData) {
  const done = saveData?.stages || {};
  return (stage?.unlockAfter || []).every((id) => !!done[id]);
}

export function nextStageOf(id) {
  const i = stages.findIndex((s) => s.id === id);
  return i >= 0 && i + 1 < stages.length ? stages[i + 1] : null;
}
