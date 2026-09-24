# Plan 2026-09-24 — arreglos de la revisión (robustez NaN, reset, preset)

Origen: revisión del repo tras A1. Arreglo chico, sin cambio de contratos.

1. **NaN en la física (§6)**: `clamp(NaN, …)` devolvía NaN, así que un NaN en
   `throttle` o en una falla dejaba `pRail = NaN` para siempre.
   - `core/math.js`: `clamp` devuelve `min` ante NaN (red de seguridad).
   - `game/modes/lab.js`: `setParam`/`setFault` sólo aceptan un valor del
     mismo tipo que el actual, y números finitos.
   - Test: NaN en cada param/falla numérica del combustible → estado finito.
2. **`reset()` del combustible ignoraba los overrides**: vuelve a los valores
   de creación (`DEFAULT_*` + overrides). Necesario para A3 (falla oculta).
3. **⟲ no olvidaba el preset**: `labMode.onReset()` limpia `activePreset` y
   reinicia la sesión (el shell ya llama `mode.onReset` si existe).
4. Comentario con una ley inexistente ("§148") en `core/shell.js`.

Nota §12: `core/math.js` es core; se toca como arreglo de revisión.
Fuera de alcance: acumulador del loop en `session.reset()`, dividir `shell.js`.
