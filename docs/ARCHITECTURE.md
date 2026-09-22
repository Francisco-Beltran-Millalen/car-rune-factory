# Arquitectura y rationale

El código documenta lo hecho; este archivo (≤200 líneas) fija las **leyes** y
el **por qué**. Las interfaces exactas están en `CONTRATOS.md`.

## Leyes (el código las cita por §)

Código que viole estas leyes no se implementa ni mergea.

- **§1** Modelo ⟂ vista ⟂ UI. El modelo (`model.js`) es JS puro: sin DOM,
  sin `Date`, sin `Math.random`, sin `requestAnimationFrame`. Se testea en
  Node.
- **§2** Único escritor. `state` lo escriben sólo `model.step` y
  `model.actions`. `params`/`faults` los escriben sólo los controles de la UI
  (y los tests). La vista, las lecturas y la narración sólo leen.
- **§3** Determinismo: la aleatoriedad sale sólo de `core/rng.js` con
  semilla. La misma secuencia de entradas da el mismo estado.
- **§4** Paso fijo: la física avanza con `fixedDt = 1 ms`, sin importar el
  framerate. `timeScale` sólo cambia cuántos pasos se dan por frame.
- **§5** Unidades reales y explícitas: bar relativos (manométricos), L/h, V,
  A, rpm, °C, s. La tabla de estado de `modules/<id>.md` es la fuente de
  verdad de las unidades.
- **§6** Robustez numérica: `step` nunca produce `NaN`/`Infinity` con
  ninguna combinación de params/faults. Se limita con `clamp`, y un test de
  fuzz con semilla lo fija.
- **§7** Estados mutuamente excluyentes son un string enum
  (`engineState: 'off' | 'cranking' | …`), nunca varios booleanos.
- **§8** UI declarativa: controles, fallas, lecturas, piezas y presets son
  **datos** en el descriptor del módulo. El core los renderiza; ningún
  módulo crea sus propios paneles.
- **§9** La vista dibuja la geometría una vez en `createView`. En `update`
  sólo muta atributos (transform, fill, opacity, partículas). Colores sólo
  por variables CSS, para que funcione el tema oscuro.
- **§10** Toda pieza clickeable lleva `data-part="<partId>"`, y ese `partId`
  existe en `parts`.
- **§11** Aislamiento de módulos: ningún modelo importa ni lee a otro. La
  integración futura ("motor completo") la hace un orquestador que copia
  señales de un `state` al `params` de otro.
- **§12** Propiedad de archivos: un módulo vive en `src/modules/<id>/` y
  `tests/<id>/`. `src/core/` sólo se toca en tareas de core. Los pedidos van
  a `docs/core-requests.md`.
- **§13** Checkpoint = verificado **en el navegador** por el usuario, a mano
  (Firefox), siguiendo una checklist que deja el agente. No sólo tests en
  verde. Sin automatización de navegador en el proyecto.
- **§14** Los números de física los respalda un test con rangos. Si un rango
  no cuadra, se ajustan las constantes (no el test) y el cambio se documenta
  en `docs/modules/<id>.md` con la cuenta.
- **§15** Comentarios sólo para invariantes, restricciones o workarounds no
  obvios, de máximo 3 líneas. El porqué largo va a `docs/` y el código lo
  cita.
- **§16** ~300 líneas por archivo es señal de dividir, no un bloqueo duro.
- **§17** Sin dependencias de runtime. Sólo `vite` y `vitest` como
  devDependencies. Nada de `innerHTML` con datos dinámicos: se usan los
  helpers de `core/dom.js` y `core/svg.js`.
- **§18** Textos de la UI y comentarios en español; identificadores en
  inglés. Factories (`createX()`) en vez de clases; tipos con JSDoc en
  `core/types.js`.

## Pipeline

```
controles/fallas (UI) ──escriben──▶ model.params / model.faults
                                           │
loop (rAF) ── acc += realDt·timeScale ── model.step(1 ms) × N   (§4)
                                           │
                                     model.state  (§2: sólo lectura afuera)
                     ┌─────────────────────┼──────────────────────┐
               view.update(dt)      readouts + history      narrate (~4 Hz)
               (SVG, partículas)    (números, sparklines)   ("¿Qué está pasando?")
```

`shell.mount(descriptor)` arma todo (SVG, modelo, vista, loop, paneles) y
`shell.unmount()` lo destruye sin dejar listeners. El router por hash
(`#/<id>`) elige el descriptor desde `modules/registry.js`.

## Rationale

- **SVG y no Canvas/3D**: las piezas son elementos del DOM clickeables (§10),
  se estilan con CSS (tema oscuro gratis) y un diagrama plano se lee mejor
  que un modelo 3D para ver flujos internos.
- **Vanilla + Vite**: la complejidad está en la física y el dibujo, no en el
  estado de la UI. Un framework no aporta y agrega capas que cada agente
  tendría que aprender.
- **Paso fijo de 1 ms**: el riel de combustible tiene una constante de
  tiempo de ~18 ms (ver `modules/fuel.md`). Con Euler explícito, `dt ≪ τ`
  da estabilidad sin integradores sofisticados. La cámara lenta no cambia la
  física, sólo cuántos pasos se dan.
- **UI declarativa**: permite que un agente escriba un módulo completo sin
  tocar el core, y que todos los módulos se vean y se usen igual.
