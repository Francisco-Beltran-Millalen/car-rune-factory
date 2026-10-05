// Instantánea del `state`/`control` de los elementos al compilar, para que
// `reset()` deje el modelo igual a uno recién creado (§3) sin que cada
// elemento con estado tenga que acordarse de declarar `init()`. Puro (§1).

import type { ElementDef } from '../solver/types.ts';

function restoreRecord<V>(target: Record<string, V>, saved: Readonly<Record<string, V>>): void {
  for (const key of Object.keys(target)) {
    if (!(key in saved)) Reflect.deleteProperty(target, key);
  }
  Object.assign(target, saved);
}

/** Guarda el estado actual de los elementos y devuelve cómo volver a él. */
export function snapshotElements(elements: Readonly<Record<string, ElementDef>>): () => void {
  const saved = Object.values(elements).map((element) => ({
    element,
    state: { ...element.state },
    control: { ...element.control },
  }));
  return (): void => {
    for (const { element, state, control } of saved) {
      restoreRecord(element.state, state);
      restoreRecord(element.control, control);
    }
  };
}
