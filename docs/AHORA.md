# Ahora — el trabajo presente

Trabajo vivo entre sesiones (≤500 líneas). Lo cerrado se recorta y queda en
git. Reglas en `ARCHITECTURE.md`, visión en `NORTE.md`, plan original en
`plans/2026-09-22-plan-maestro.md`.

## EN CURSO — Fase 1: sistema de combustible

Cada tarea la hace un agente distinto, dueño de sus archivos (§12). Las
tareas en paralelo trabajan en worktrees aislados y se integran con merge.
Cada una cierra con `npm test` + `npm run build` en verde y un commit.

| # | Tarea | Depende de | Estado |
|---|---|---|---|
| T0-a | Docs (este set) | — | ✅ |
| T0-b | Scaffold (git, Vite, Vitest) | T0-a | ✅ |
| T1 | Core de simulación (`types, rng, math, loop, history, particles, svg, dom`) | T0-b | ✅ |
| T2 | Shell de la UI + módulo `_demo` | T0-b | ✅ |
| T3 | Modelo de combustible + 11 tests | T1 | ✅ |
| T4 | Vista de combustible | T1, T2 | ✅ (falta revisión visual del usuario) |
| T5 | Contenido de combustible (fichas, narración, presets, descriptor) | T0-b | ✅ |
| T6 | Integración + verificación visual del combustible | T3, T4, T5 | ✅ probado por el usuario el 2026-09-22 ("me gustó mucho"). La checklist de abajo queda para una pasada detallada |

Orden: T0-a → T0-b → {T1, T2} → {T3, T4, T5} → T6.

Detalle de archivos y criterios de aceptación de cada tarea: sección 12 de
`plans/2026-09-22-plan-maestro.md`.

## EN CURSO — TypeScript estricto (plan 2026-09-24) — va ANTES de A3

Plan: `plans/2026-09-24-typescript-estricto.md` (leerlo entero: versiones,
tsconfig, reglas de lint por ley, diseño de tipos y fases). Todo en
`main` (sin ramas), un commit por fase, cada una cierra con `npm run check`
(existe desde TS0). Portar ≠ refactorizar: la física y el comportamiento no
cambian.

| # | Tarea | Depende de | Estado |
|---|---|---|---|
| TS0 | Herramientas: tsconfig, ESLint con leyes, knip, checker, `npm run check`, test de las leyes | — | ✅ |
| TS1 | Core puro (`types, math, rng, loop, history`, `format` nuevo) | TS0 | ✅ |
| TS2 | Core con DOM + paneles + router | TS1 | ✅ |
| TS3 | Juego (`game/**`, `ui/hud`), intents como unión discriminada | TS2 | ⏳ |
| TS4 | Módulos (`fuel`, `_demo`, registry) + comparación de estado idéntico | TS3 | ⏳ |
| TS5 | Shell, legacy, main; `allowJs: false`; docs (§1, §7, §18, §31–§33) + checklist en Firefox | TS4 | ⏳ |

Se usa **TS 6.0 + ESLint** (opción A, decidida el 2026-09-24; comparación en
§2.1 del plan). **TS 7 queda pendiente:** al empezar cada tarea A, correr
`npm view typescript-eslint peerDependencies`. Si acepta TS 7, la migración
es una tarea chica (plan §12, camino 1): se agrega a la tabla.

Mientras dure esta sección, §18 ("tipos con JSDoc") está en transición:
el código nuevo va en `.ts`. Las listas de archivos del plan 2026-09-23 dicen
`.js`: después de TS5, léanse como `.ts`.

## EN CURSO — Arquitectura de juego (plan 2026-09-23)

Plan: `plans/2026-09-23-arquitectura-juego.md`, con el orden de A7–A9
enmendado por `plans/2026-09-24-motor-y-juice.md` (leerlo antes de A3).
Orden: TS0–TS5 → A3 (prototipo SVG) → **G1** (checkpoint de juego del
usuario) → A8 (prueba de juice, en paralelo con A4–A6) → **D-motor**
(decisión del usuario) → A7 → A9. A4 → A5 → A6 no dependen del motor.
A3 emite eventos con `partIds` y propone `data.cue` (plan motor-y-juice §6).

| # | Tarea | Depende de | Estado |
|---|---|---|---|
| A0 | Docs: leyes §17, §19–§30 en ARCHITECTURE, contratos de juego 6.1–6.8 | — | ✅ |
| A1 | Sesión + intents + labMode + shell nuevo + legacyRenderer + paneles DOM + router | A0 | ✅ |
| A2 | Quiz (E1) + HUD + guardado + campaña + etiquetas de nombre separadas | A1 | ✅ (checklist manual abajo) |
| A3 | Diagnóstico (E2) + faultCatalog combustible + herramientas + visibilidad + `cue` en eventos | A2, TS5 | ⏳ |
| G1 | Checkpoint de juego: el usuario juega E2 en Firefox y responde las 5 preguntas (plan motor-y-juice §3) | A3 | ⏳ |
| A4 | Solver nodal + linalg | A0 | ⏳ |
| A5 | Elementos + circuito (compile/validate) + controladores base | A4 | ⏳ |
| A6 | Combustible sobre el solver | A5, A3 | ⏳ |
| A8 | Prueba de juice: candidato (Phaser) vs. SVG, 10 preguntas → `docs/decisiones/0001-motor.md` | G1 | ⏳ |
| D-motor | Decisión del usuario sobre el motor (plan motor-y-juice §5) | A8 | ⏳ |
| A7 | Presenter + renderer del motor elegido | A6, D-motor | ⏳ |
| A9 | Armar circuitos (E4) | A7 | ⏳ |
| A10 | Plan del vehículo y casos entre sistemas | A6 | ⏳ |

**Siguiente paso:** TS3 (juego: `game/**` y `ui/hud` a `.ts`, intents como unión discriminada). Después de TS5: A3 (Diagnóstico E2 + `faultCatalog` del combustible + herramientas + visibilidad de indicios).

## CERRADO 2026-09-25 — TS2 core con DOM y UI

- `src/core/{dom,svg,particles,router}.js` → `.ts`, `src/core/ui/*.js` → `.ts`, y
  `tests/core/{particles,ui-pure}.test.js`, `tests/game/router.test.js` → `.ts`
  (aserciones intactas; `_demo`, que sigue en JS hasta TS4, se ve por su forma de uso
  con `unknown` + cast en el test).
- `dom.ts`/`svg.ts` según el plan §8.5: `h`/`el` genéricos por `HTMLElement/SVGElementTagNameMap`,
  `Attrs` como `unknown`, `Reflect.set`, e interfaces explícitas de `pipe`, `box`, `label`
  y `gaugeSvg`. `router.ts` según §8.6 con `HashWindow`/`HashLocation` mínimas: el test
  pasa su doble sin cast.
- Paneles con `ControlSpec`/`FaultSpec`/`ReadoutSpec` de `types.ts`. `spec` se declara al
  crear el item y `disabledWhen` se evalúa contra `AnyModel` (fallback con Proxy si no hay
  `modelContext`), como pide el plan.
- `emit` de los paneles: tipo genérico `I extends IntentLike` para que el shell TS5 infiera
  `Intent` sin cast en el llamado; dentro hay un cast frontera porque `game/intents.js`
  sigue en JS (D9: el modo valida).
- Desviaciones/decisiones anotadas:
  - `IntentLike` (`{ type: string }`) en `types.ts` hasta que TS3 traiga la unión real.
  - `no-unnecessary-type-parameters` desactivada inline (con motivo) en los dos paneles, §33.
  - `unbound-method` off sólo en tests (matchers de vitest sobre métodos de dobles).
  - `append` de `dom.ts` recursivo (`.flat()` no tipaba el `Child` recursivo) y `setAttrs`
    no stringifica objetos que no sean `dataset`/`style`; `infoPanel` usa `append` de dom
    (acepta `null`) en vez de `container.append(...null)`.
- `npm run check` verde: typecheck, lint 0 warnings, knip, 122 tests y build. `npm run dev`
  arranca con el checker en 0 errores (la paridad visual del laboratorio la mira el usuario
  en Firefox, §13).


## CERRADO 2026-09-25 — TS1 core puro

- `src/core/{types,math,rng,loop,history,format}.js` → `.ts` y `tests/core/{math,rng,loop,history}.test.js`
  → `.ts` (aserciones intactas; sólo anotaciones y extensiones). `format.ts` ya existía desde el
  arreglo de TS0.
- `types.ts` según el plan §8.1: `Model<P,F,S>`, `ReadoutSpec`, `ModuleDescriptor`, `ViewContext`,
  `View`, `ControlSpec`, `FaultSpec`, `PartInfo`, `Narration`, `Preset` y `defineModule`
  (identidad, `@public` para TS4). Callbacks que reciben tipos del módulo con sintaxis de método
  (nota de varianza).
- `rng.ts` exporta `Rng`; `loop.ts` exporta `Loop`, `LoopOptions` y `SteppableModel` (lo mínimo
  que el loop usa del modelo: sólo `step`); `history.ts` exporta `Recorder`, `RingBuffer` y
  `HistoryReadout`. Los tipos mínimos evitan casts y `!` innecesarios en los tests, que no
  construyen modelos completos.
- Imports y JSDoc de los `.js` que faltan pasan a `.ts` (`allowImportingTsExtensions`, D4);
  `game/types.js` sigue en JS hasta TS3.
- Adaptaciones de tipo, sin cambio de física:
  - `TIME_SCALES` se arma con `TIME_SCALE_MIN/MAX` nombrados: `noUncheckedIndexedAccess` no puede
    probar `TIME_SCALES[TIME_SCALES.length - 1]`.
  - `rng.pick` lanza `invariante: …` con arreglo vacío (antes devolvía `undefined`); los llamadores
    lo usan con arreglos no vacíos.
  - Se quitó el `Number(...)` redundante del recorder y el `!!` de `setPaused`
    (`no-unnecessary-type-conversion`); el guard `|| 0` de NaN queda.
- `npm run check` verde: typecheck, lint 0 warnings, knip, 122 tests y build.


## CERRADO 2026-09-25 — TS0 herramientas (plan 2026-09-24-typescript-estricto)

- `tsconfig.json` (sección 3 del plan, con `allowJs: true`/`checkJs: false` hasta TS5),
  `eslint.config.js` flat con las leyes por archivo (§1, §3, §7, §11, §17, §18, §19,
  §20, §21, §22) y bloque de transición para el JS, `knip.json`, `vite.config.ts` con
  `vite-plugin-checker` y scripts nuevos (`typecheck`, `lint`, `knip`, `check`).
- Versiones instaladas (verificadas con `npm view`): `typescript@6.0.3` (`latest` es 7.0.2,
  pero `typescript-eslint@8.70.1` pide `<6.1.0`; D1), `eslint@10.11.0`, `@eslint/js@10.0.1`,
  `typescript-eslint@8.70.1`, `@eslint-community/eslint-plugin-eslint-comments@4.8.1`,
  `globals@17.12.0`, `@types/node@26.6.2`, `knip@6.38.0`, `vite-plugin-checker@0.14.5`.
- `tests/tooling/lint-laws.test.ts`: 12 casos con rutas virtuales que prueban que cada
  regla de ley dispara y que las excepciones no (`new Date` en `save.ts`, `import type`,
  Phaser y `class` en `render/phaser/`).
- Desviaciones del plan, anotadas:
  - `no-restricted-imports` de ESLint 10 (la de typescript-eslint está deprecada desde
    8.64) con `regex` + `allowTypeImports`, que es lo que pide la tabla 5.2.
  - `@typescript-eslint/no-empty-function` apagado sólo para los stubs no-op del
    contrato (`emit = () => {}`, `highlight() {}`, `sync() {}`, `resize() {}`): el
    preset strictTypeChecked lo marca y el patrón factory los declara vacíos.
  - El checker lintea `./src/**/*.{js,ts}` mientras quede JS; en TS5 basta `.ts`.
  - `process.env['VITEST']` (corchetes) por `noPropertyAccessFromIndexSignature`.
  - knip: `src/modules/_demo/{index,view}.js` ignorados (ejemplo que este AHORA
    conserva y knip ve muerto; TS4 decidirá), y `@public` en `PX_PER_LH` y `box`
    porque son contratos de `CONTRATOS.md` 4.6/4.7 sin uso todavía.
- Violaciones reales que encontró el lint, en commit aparte (`683ca90`): `narrate.js`
  importaba `fmt` de `core/dom.js` (§1) → `fmt` pasa a `core/format.js`; inicializadores
  pisados en `shell.route()`; parámetro sin usar en `labMode.update`.
- `npm run check` verde: typecheck, lint sin warnings, knip, **122 tests** (+12 de leyes)
  y build. En `npm run dev` el checker reporta 1 error de tipos al agregar a mano
  `src/checker-probe.ts` y vuelve a 0 al borrarlo (se revirtió; el overlay lo mira el
  usuario).

**Revisar en Firefox** (cuando el usuario quiera, §13):
1. `npm run dev` → portada con "Etapas" y "Laboratorio", lab del combustible y quiz 1/2
   se ven y se usan igual que antes (TS0 no tocó comportamiento).
2. F12 sin errores de consola.
3. Con el dev server corriendo, agregar a mano un error de tipos en un `.ts` de `src/`
   → aparece el overlay de `vite-plugin-checker`; borrarlo → desaparece.


## CERRADO 2026-09-24 — A2 Quiz E1, HUD, guardado y campaña

- `src/game/save.js`: `crf.save.v1` versionado, storage inyectable (localStorage/Map/memoria);
  corrupto, con forma rara o que lanza → defaults y se juega sin persistir (§27). Sanea entradas.
- `src/game/campaign.js` + `src/game/stages/fuel-quiz-1.js` (sólo `find`, 8 piezas) y
  `fuel-quiz-2.js` (`find`/`name`/`purpose`, todas). Desbloqueo por `unlockAfter`.
- `src/game/modes/quiz.js`: preguntas con semilla por etapa (D10); inyectores 1..4 como un solo
  concepto; distractores de todo el módulo; `purpose` descarta los `why` que nombran la pieza.
  Puntaje = aciertos×10 + 5 por acierto consecutivo extra (la fórmula no estaba fijada en el
  plan); estrellas ≥90/≥70/≥50 %; `recordAnswer` por pieza y `recordStage` al cerrar; `onReset`
  reinicia la partida y deja el motor en marcha. Etapa vacía cierra una vez y se registra.
- `src/ui/hud.js`: pinta el HudModel 6.7 (stats, prompt + choices, tools, actions, suspects,
  log) y emite `answer`/`useTool`/`removeTool`/`markSuspect` y las acciones del modo.
- `src/core/shell.js`: portada con "Etapas" (candado, estrellas y mejor puntaje) + "Laboratorio";
  ruta `#/stage/<id>` con desbloqueo; semilla `seed ^ intento` en cada reintento; retry/quit/
  nextStage desde el HUD; aplica los eventos `highlight` del modo.
- `fuel/view.js`: `part-label` en las 13 etiquetas de **nombre**; los valores (Apagado, 12,6 V,
  rpm, litros, tag del motor, números de inyector) no lo llevan.
- Contrato: `ModeEvent` suma `highlight` (`{partIds, style}`) en `CONTRATOS.md` §6.3. Lo pide el
  plan §6 y el modo es puro (§21): el shell es quien llama al renderer.
- Fuera de la lista de archivos de A2 (§12, anotado): `render/legacy/index.js` (limpia los 4
  estilos de highlight antes de aplicar uno, y sólo hace toggle de deselección con `infoPanel`,
  o sea en el lab) y `styles.css` (HUD, portada y `.correct/.wrong/.target`).
- Tests: 109 en verde (+32: quiz con semilla, distractores, puntaje/racha, estrellas, save con
  memoria/Map/corrupto/roto, campaña, etiquetas). `npm run build` en verde.
- Diferido a A6/A7 (identidad por tipo §23): `recordAnswer` usa el `partId` como clave de
  maestría (los inyectores suman por instancia).
- Conocido: el feedback del quiz dura 1 s de tiempo **simulado**; a 0.05× se estira (contrato
  `update(simDt)`).

**Revisar en Firefox** (`npm run dev`):
1. Portada: "Etapas" con la 1 jugable y la 2 con candado; "Laboratorio" con la tarjeta de
   combustible. Abrir a mano `#/stage/fuel-quiz-1`.
2. Etapa 1: no se leen nombres en el diagrama (nada de "Bomba", "Filtro", "Regulador"…); sí los
   valores (12,6 V, litros, rpm, tag del motor). El motor se ve en marcha desde el arranque.
3. Responder un `find`: acierto → pieza en verde y HUD "¡Correcto! · Aciertos/Puntos"; error →
   la tocada en rojo y el texto dice cuál era. La pregunta avanza sola tras ~1 s.
4. `name`: la pieza objetivo queda con contorno azul punteado y hay 4 botones de nombre.
   `purpose`: el HUD muestra la función entre comillas y 4 nombres.
5. Clic repetido en la misma pieza en un `find` debe responder igual (ya no hace falta el
   segundo clic).
6. Terminar: estrellas, "Reintentar", "Siguiente etapa" y "Volver al taller". Reintentar cambia
   las preguntas; "Siguiente" abre la etapa 2; volver muestra la etapa 1 con estrellas y mejor
   puntaje en la portada.
7. ⟲ reinicia la partida (pregunta 1, 0 aciertos) y deja el motor andando. Pausa y velocidad
   funcionan.
8. F12 sin errores; en la consola `window.__sim.mode.hud()` y `window.__sim.save.get()`
   responden. Repetir el quiz completo mejora el récord de la portada.

## FIX 2026-09-24 — los cables de los inyectores son una pieza propia

Lo notó el usuario jugando el quiz: el cable ECU→inyector llevaba `part: injectorN`
(`view.js:76`), así que tooltip, ficha y clic del quiz decían "Inyector N". Ahora los 4 cables
son `injectorWires` ("Arnés de los inyectores", `content.js`), con ficha y fallas propias; el
inyector sigue siendo sólo su cuerpo. Como el arnés no tiene `.part-body`, en `fuel.css` se
agregaron sus reglas de resaltado (`.signal-wire.selected/.target/.correct/.wrong`). En el
quiz, clicar el cable ya no acierta una pregunta de inyector, y en la etapa 2 el arnés puede
ser una pregunta más (`parts:'all'`). Docs: `modules/fuel.md` §1. Tests: 110 en verde (+1: el
arnés no se agrupa con los inyectores).

**Revisar en Firefox** (`#/lab/fuel` y `#/stage/fuel-quiz-2`):
1. Hover sobre un cable ECU→inyector → tooltip "Arnés de los inyectores"; clic → su ficha
   ("¿Qué es? / ¿Para qué sirve? / ¿Cómo funciona?"). El cuerpo del inyector sigue siendo
   "Inyector N".
2. En el quiz, pregunta de inyector: clic en el cable → incorrecto; clic en el cuerpo (o su
   número) → correcto.
3. En la etapa 2 el arnés puede aparecer como pregunta u opción; si toca `purpose`, el texto
   no lo nombra.

## Checklist de verificación manual de A1 (Firefox)

`npm run dev` → abrir la URL de Vite:

1. **Rutas y redirección**:
   - Abrir `#/fuel` → la URL debe cambiar automáticamente a `#/lab/fuel` y cargar el sistema de combustible.
   - Navegar a `#/` → se ve la portada con la tarjeta de combustible cuyo enlace apunta a `#/lab/fuel`.
2. **Laboratorio idéntico**:
   - El escenario SVG carga con el estanque, bomba, filtro, riel, 4 inyectores, retorno y manómetros.
   - **Controles**: cambiar RPM, llave a "Contacto" (las partículas amarillas recorren cables, manómetro sube a ~3 bar), "Arranque" y "Marcha". Mover el acelerador.
   - **Fallas**: mover slider de filtro a 90 %, verificar que el botón "Reparar todo" se habilita. Clic en "Reparar todo" → vuelve a 0 % y se deshabilita.
   - **Presets**: clic en "Caso: tironea en subida" → aplica el preset, se ve la nota explicativa y la simulación responde.
   - **Selección de pieza**: clic en el filtro o la bomba → se resalta con contorno azul (`.selected`), el panel "Pieza seleccionada" se abre mostrando su nombre y ficha. Clic fuera o en la misma pieza → se deselecciona.
   - **Hover**: pasar el mouse sobre una pieza → aparece el tooltip con su nombre.
   - **Timebar**: botón ⏸ o espacio pausa la simulación; ⏭ da un paso de 1 ms; botones de velocidad 0.05× a 4× aceleran/desaceleran; ⟲ reinicia todo a los valores iniciales.
   - **Tema**: botón ◐ alterna entre auto/claro/oscuro y se ve correctamente.
   - **Consola**: abrir F12, sin errores de consola. En la consola ejecutar `window.__sim.model.state` y verificar que el estado del modelo es accesible.
   - **Verificación de invariante**: ejecutar `grep -rn "params.*=" src/` y comprobar que no hay escrituras directas a `model.params` fuera de `src/game/modes/` ni constructores.

## CERRADO 2026-09-24 — revisión: NaN, reset con overrides, ⟲ y preset

Plan: `plans/2026-09-24-fix-revision-robustez.md`.
- `clamp(NaN)` → `min` (`core/math.js`, tocado como arreglo de revisión §12).
  Antes, `throttle = NaN` o `filterClog = NaN` dejaba `pRail = NaN` para siempre.
- `labMode` rechaza `setParam`/`setFault` con NaN/Infinity o con otro tipo.
- `createFuelModel().reset()` vuelve a los overrides de creación.
- `labMode.onReset()` reinicia la sesión y olvida `activePreset`.
- Tests: 77 en verde (+4: NaN en el modelo, overrides en reset, validación de
  intents, onReset; los 4 fallan sin el arreglo). `npm run build` en verde.

**Revisar en Firefox** (`npm run dev` → `#/lab/fuel`):
1. Clic en un caso de "Casos para probar" → aparece su nota. Clic en ⟲ → la
   nota desaparece, fallas en 0 y llave en "Apagado".
2. Mover sliders de fallas y controles → responden igual que antes.
3. F12, sin errores. En la consola:
   `window.__sim.mode.handle({type:'setParam', key:'throttle', value:NaN})`
   y luego `window.__sim.model.params.throttle` → sigue siendo el valor anterior.

## FIX 2026-09-23 — triángulos cafés entre las tuberías (bug de T4)

Lo reportó el usuario al probar. Las tuberías con codo se rellenaban como
polígonos: `.fluid-fuel { fill }` le gana al atributo `fill="none"` de
`svg.pipe()`. Corregido con `.pipe .pipe-fluid, .pipe .pipe-wall { fill: none }`
en `styles.css`. Trampa anotada en `CONTRATOS.md` (vista). **Revisar**: ya
no deben verse triángulos en la alimentación ni en el retorno; el líquido del
estanque sigue relleno.

## REVISIÓN 2026-09-23 — A0 + A1 (segundo agente)

Resultado: bien encaminado. Leyes y contratos copiados, cero escrituras a
`params`/`faults` fuera de modos, 54 tests originales intactos + 19 nuevos.
Corregido en la revisión:
- **`[hidden]` no ocultaba**: `.ctl { display: grid }` le ganaba al
  atributo. Regla global `[hidden] { display: none !important }` en
  `styles.css`.
- **`hoverPart` en cada `pointermove`**, con re-sincronización de paneles:
  ahora sólo se emite al cambiar de pieza, y el hover no dispara `syncAll`.
- **`placePart`**: el contrato decía `{ type }` (choca con `intent.type`);
  el código ya usaba `partType`. Se corrigió el doc y el plan (el error era
  del plan).
- **⟲ borraría la falla escondida del diagnóstico**: el shell ahora llama
  `mode.onReset()` si existe. A3 debe implementarlo (plan §7).
- Pendiente conocido para A2/A3: el shell pasa `rng: null, save: null` al
  modo, y `narration: 'hints'` todavía se trata como `'full'`.

## CERRADO 2026-09-23 — A1 sesión, intents, labMode, legacyRenderer

- `src/game/{types,intents,session}.js`: tipos JSDoc, catálogo de intents y constructores puros, sesión desacoplada del shell con soporte para driver `raf` y `external`.
- `src/game/modes/lab.js`: máquina de estados del laboratorio que centraliza la aplicación de `setParam`, `setFault`, `resetFaults`, `applyPreset` y `action`. Único escritor en `params`/`faults`.
- `src/render/legacy/index.js`: adaptador `legacyRenderer` sobre `module.createView` con soporte para delegación de clics (`selectPart`), hover (`hoverPart`), `highlight` y ocultamiento de `.part-label` cuando `labels: false`.
- `src/core/router.js`: `parseHash` devuelve `{ kind: 'lab'|'stage'|'home', id }` con compatibilidad y redirección para URLs antiguas `#/<id>`.
- `src/core/ui/*`: `controls.js` y `faults.js` migrados para emitir intents vía `emit(intent)` en lugar de mutar `model.params` / `model.faults` directamente. Métodos `setVisible()` agregados a controles, fallas y lecturas. `timebar.js` suma `setMaxScale()`.
- `src/core/shell.js`: composición según contrato A1: sesión + modo + legacyRenderer + paneles DOM con intents.
- `src/modules/fuel/index.js`: exporta `defaultParams` y `defaultFaults`.
- Tests: 73 tests en verde (los 54 tests existentes + 19 tests nuevos en `tests/game/` cubriendo sesión, intents, labMode y router). `npm run build` en verde.
- Invariante comprobada: cero escrituras a `model.params[...] =` fuera de `src/game/modes/` y constructores de modelo.

## CERRADO 2026-09-23 — A0 docs de arquitectura de juego

- `docs/ARCHITECTURE.md`: enmienda a §17 (Phaser en A8) y leyes §19–§30
  (capas, intents, modo puro, renderer y VisualState, catálogo por tipo,
  solver, controladores, ids §26, guardado v1, dueño único de señales, stubs
  ideales, no mezclar fluidos). 134 líneas (≤ 200).
- `docs/CONTRATOS.md`: sección "Contratos de juego" agregada con contratos
  6.1–6.8 (Session, Intents, ModeUi/Mode, Renderer, VisualState, faultCatalog,
  HUD, Etapas y Save v1).
- `docs/NORTE.md` y `docs/SISTEMAS.md` verificados con respecto al plan
  `plans/2026-09-23-arquitectura-juego.md`.


## Fase 2 original (en pausa)

T7 ciclo de 4 tiempos, T8 encendido, T9 refrigeración, T10 lubricación.
Antes de programar, cada agente amplía su `docs/modules/<id>.md` al nivel de
detalle de `fuel.md` (tablas de params, fallas, física, estado y tests) y lo
guarda como plan en `docs/plans/`. **Nuevo**: las coordenadas de la vista
van en un `layout.js` del módulo (ver `HORIZONTE_JUEGO.md`, "Seguro barato").

## Checklist detallada del combustible (opcional, usuario, Firefox)

`npm run dev` → abrir la URL que imprime Vite → tarjeta "Sistema de
combustible". Anotar aquí lo que se vea mal (captura si se puede) para
corregirlo en la siguiente sesión.

1. **Reposo**: se ve el estanque con bencina (~40 L), la bomba dentro, el
   filtro, el riel con 4 inyectores, el regulador, el múltiple y la línea de
   retorno. La etiqueta del múltiple dice "Motor detenido". No hay
   partículas.
2. **Contacto**: partículas amarillas (corriente) en los cables. El relé
   cierra, el rotor de la bomba gira, las partículas ámbar suben por la
   alimentación, el manómetro sube a ~3 bar y el riel se ve más saturado. A
   los 2 s el relé se abre, las partículas se detienen y la aguja se queda
   en ~3 (presión residual).
3. **Arranque → Marcha**: "Arrancando…" y luego "En marcha". Hay flujo de
   retorno. En "Riel − múltiple" se leen ~3,08 bar y en la presión de riel
   ~2,4.
4. **Inyectores** a 0,05×: los conos de spray aparecen en orden 1-3-4-2 y el
   cable de señal de cada uno se pinta amarillo. A 1× y 6000 rpm parpadean
   todos.
5. **Acelerador a fondo**: el caudal inyectado sube (~29 L/h), el retorno
   baja (~38 L/h) y la presión sube a ~3,0 (el vacío desaparece).
6. **Cada falla** (sección Fallas) y lo que debería pasar:
   - filtro 90 % + fondo → "Falla (mezcla)", mensaje del filtro, el filtro
     se ve sucio;
   - manguera de vacío suelta → la manguera se dibuja suelta y la presión en
     ralentí sube ~0,6;
   - regulador pegado cerrado → la aguja se va a ~6,7 y el retorno queda
     vacío;
   - regulador pegado abierto → gira y no parte;
   - relé muerto → no hay cebado;
   - inyector 2 gotea → goteo bajo el inyector 2 y la presión residual cae
     con la llave en Contacto;
   - fuga en la línea → gotas cerca de x = 390;
   - estanque casi vacío (preset "Me quedé sin bencina") → burbujas huecas
     en la aspiración y luego "Se detuvo".
7. **Casos para probar**: los 5 presets cargan y muestran su nota.
8. **Clic en cada pieza** → ficha correcta + contorno azul. Hover → nombre.
9. **Tema oscuro** (◐) legible. Con < 1024 px el panel pasa debajo.
10. Consola del navegador (F12) sin errores. Ir a la portada y volver no
    acelera la animación.

## CERRADO 2026-09-22 — T4 vista de combustible

- `fuel/view.js` + `fuel/fuel.css` (estilos propios del módulo) +
  `fuel/index.js` (descriptor). `registry.js` ahora lista `fuel`. `_demo`
  sale del registro pero se queda en el repo como ejemplo mínimo de módulo
  (su test sigue).
- Los pulsos de inyección se detectan por **cruce de ángulo del cigüeñal
  entre frames**, no sólo por `injectors[i].open`: a 1× un pulso de 2,5 ms
  cae entre dos frames y no se vería.
- La opacidad por presión va en `style.opacity`: un atributo de
  presentación pierde contra la regla CSS `.pipe-fluid`.
- Test nuevo: todo `data-part` de la vista tiene ficha y toda pieza de la
  spec se dibuja (54 tests).

## CERRADO 2026-09-22 — T5 contenido de combustible

- `fuel/content.js` (fichas de las 19 piezas), `fuel/narrate.js`
  (`createNarrator()`, con memoria para detectar que cae la presión
  residual), `fuel/specs.js` (controles, fallas, lecturas, 5 presets).
  `tests/fuel/content.test.js`: 10 tests (claves válidas, narración por
  escenario). 53 tests en total.
- Cambio de física: umbral de mezcla pobre 0.75 → 0.8 (ver
  `modules/fuel.md` §9b). Sin él, el preset "tironea" no fallaba nunca.
- Los specs quedaron en `specs.js` en vez de dentro de `index.js`, para
  que `index.js` sea sólo el ensamblado.

## CERRADO 2026-09-22 — T3 modelo de combustible

- `src/modules/fuel/model.js` + `tests/fuel/model.test.js`: los 11 criterios
  de `modules/fuel.md` §9, más reset e inyección en orden 1-3-4-2 (13
  tests). Pasaron sin tocar constantes.
- Valores medidos y decisiones de implementación en `modules/fuel.md` §9b.
  El preset "tironea" pasa de filtro 0.8 a 0.9.

## CERRADO 2026-09-22 — T2 shell de la UI

- `src/main.js`, `styles.css`, `core/{router,shell}.js`,
  `core/ui/{controls,faults,readouts,infoPanel,timebar}.js`,
  `modules/registry.js`, `modules/_demo/`. 30 tests (se suman los de la
  lógica pura de la UI y `_demo`).
- El shell delega los clics y el hover sobre `[data-part]`: la vista no
  cablea eventos (documentado en `CONTRATOS.md` 4.3).
- Tema claro/oscuro/auto con el botón ◐ (guardado en `localStorage`, con
  try/catch). Espacio = pausa. `window.__sim.model.state` para depurar desde
  la consola.
- **Checklist de revisión manual** (quedó cubierta por la de T6; `_demo`
  ya no está en el registro. Para verlo, agrégalo a `registry.js`):
  1. La portada muestra la tarjeta "Demo: estanque". Al hacer clic se ve el
     estanque con líquido, la válvula y el manómetro.
  2. Partículas ámbar recorren la tubería de salida. El nivel baja y el
     manómetro y las sparklines de "Mediciones" se mueven.
  3. Slider de válvula a 0 → las partículas se detienen. "Llenado abierto" →
     partículas en la tubería de entrada y se habilita "Caudal de llenado".
  4. Fallas → "Salida tapada" 80 % → el caudal cae y el rótulo se pinta
     rojo; "Reparar todo" lo restablece.
  5. Clic en el estanque → ficha en "Pieza seleccionada" + contorno azul.
     Hover → tooltip con el nombre.
  6. Timebar: ⏸ (y la barra espaciadora) pausa; ⏭ avanza en pausa; 0,05× es
     cámara lenta; ⟲ reinicia.
  7. Barra inferior "¿Qué está pasando?" cambia con las fallas.
  8. ◐ cambia de tema y todo se lee bien en oscuro. Con la ventana a
     < 1024 px el panel pasa debajo.
  9. Ir a la portada y volver no acelera la animación (no se duplican
     loops). La consola no muestra errores.

## CERRADO 2026-09-22 — T1 core de simulación

- `src/core/{types,rng,math,loop,history,dom,svg,particles}.js`. 25 tests en
  `tests/core/` (loop, history, rng, math, parte pura de particles/gauge).
- `loop.tick(realDt)` es público: sirve para tests y para el paso a paso.
  `stepOnce()` avanza 1 ms aunque esté en pausa. Tolerancia `EPS` en el
  acumulador: sin ella 0.02 s daba 19 pasos y no 20.
- `history.createRecorder(readouts)` muestrea cada 50 ms simulados; el shell
  llama `recorder.sample(model)` en `onFrame`.
- `particles.createFlow` suma `setAir(f)` (fracción de burbujas), que no
  estaba en el contrato: la necesita el aire en la aspiración de
  combustible. Precalcula la tabla de puntos del path (sin
  `getPointAtLength` por frame).
- `svg.pipe` devuelve `{ g, outer, inner, path }`: `outer` = pared
  (`.pipe-wall`), `inner` = fluido (`.pipe-fluid .fluid-*`).
- Las partes DOM (svg/particles/dom) se verifican en el navegador en T2/T4.

## CERRADO 2026-09-22 — T0-b scaffold

- `git init` (rama `main`). Node 26.8, **Vite 8.3**, **Vitest 5.0**.
- `npm test` → `vitest run` sobre `tests/**/*.test.js` (`passWithNoTests`).
  `npm run build` OK. `src/main.js` es un placeholder que T2 reemplaza.

## CERRADO 2026-09-22 — plan maestro + docs

- Plan aprobado y guardado en `plans/2026-09-22-plan-maestro.md`.
- Docs vivos creados: `AGENTS.md`, `NORTE.md`, `ARCHITECTURE.md` (§1-§18),
  `CONTRATOS.md`, `SISTEMAS.md`, `modules/*.md`.
- Las constantes del modelo de combustible se revisaron a mano contra los
  rangos de los tests (ver `modules/fuel.md` §4, "Comprobación a mano").
