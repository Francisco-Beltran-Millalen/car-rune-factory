# Informe — migración a TypeScript estricto (TS0–TS5)

Fecha: 2026-09-25. Ejecuta el plan `plans/2026-09-24-typescript-estricto.md`
(aprobado por el usuario el 2026-09-24: "vamos con lo de typescript primero").
Este documento es **registro histórico**: cuenta qué se hizo y qué errores
aparecieron. Lo vivo sigue siendo `ARCHITECTURE.md`, `AHORA.md` y
`CONTRATOS.md`.

Estado: **cerrado**. `src/` y `tests/` son `.ts`, `npm run check` verde
(typecheck, lint sin warnings, knip, 123 tests y build) y el usuario verificó
el laboratorio y las etapas del quiz en Firefox: "funciona sin errores".

## 1. Qué se hizo

Un commit por fase, todos directo en `main`.

| Fase | Commit | Alcance |
|---|---|---|
| TS0 | `d15899c` | `tsconfig.json` estricto, `eslint.config.js` con las leyes §1–§22 citadas, `knip.json`, `vite.config.ts` con `vite-plugin-checker`, scripts (`typecheck`, `lint`, `knip`, `check`) y `tests/tooling/lint-laws.test.ts` (12 casos). |
| TS1 | `c5e15b5` | Core puro: `types`, `math`, `rng`, `loop`, `history` y `format` a `.ts` + sus tests. |
| TS2 | `09d4923` | Core con DOM y UI: `dom`, `svg`, `particles`, `router`, `core/ui/*` (paneles), `core/format` ya existía; tests de partículas, UI pura y router. |
| TS3 | `6dca54c` | Juego: `game/**` (intents como unión discriminada, modos, sesión, guardado, campaña, etapas) y `ui/hud`. |
| TS4 | `a68dcc3` | Módulos: `registry`, `_demo/*`, `fuel/*` y sus tests; comparación de estado idéntico. |
| TS5 | `fc562c2` | Composición (`shell`, `render/legacy`, `main`), `allowJs: false`, docs (§31–§33) y checklist de Firefox. |

Previo a TS0, en el mismo día, quedó `683ca90` con tres correcciones que el
lint de TS0 destapó (ver §2.1).

Detalles por fase (los CERRADO completos, con desviaciones, están en el
historial de `AHORA.md` y en git):

- **TS0**: 14 dependencias de desarrollo (verificadas con `npm view`).
  `npm run check` es el criterio de cierre de toda tarea desde entonces.
- **TS1**: `types.ts` con `Model`, `ModuleDescriptor`, `defineModule` y los
  tipos de UI; `Rng`, `Loop`, `Recorder` como tipos nombrados. `loop.ts` y
  `history.ts` usan interfaces mínimas (`SteppableModel`, `HistoryReadout`)
  para que los tests no necesiten casts.
- **TS2**: `h`/`el` genéricos por tag map, `Attrs`/`SvgAttrs`, interfaces de
  opciones de `pipe/box/label/gaugeSvg`; `HashWindow`/`HashLocation` para
  inyectar dobles en tests; APIs de panel (`ControlsPanel`, `FaultsPanel`,
  `ReadoutsPanel`, `InfoPanel`, `NarrationBar`).
- **TS3**: `IntentPayloads` → `Intent` → `IntentOf<K>`; `ModeEvent` como
  unión; `SaveData`/`SaveApi` exactos; `ModeModule` mínimo (lo que los modos
  usan de verdad); `LabMode`/`QuizMode` con `activePreset`/`hud()` no nulos.
- **TS4**: `FuelParams/Faults/State`, `FuelModel`, `FuelOverrides`;
  `defineModule<FuelModel>` en `fuel/index.ts`; `state` completo desde
  `initialState()` y `time` como getter (el `Model.time` es readonly).
- **TS5**: `mount` con unión discriminada
  `{ kind: 'lab' } | { kind: 'stage' }`; `window.__sim` con
  `declare global`; `index.html` → `/src/main.ts`.

## 2. Errores y hallazgos

### 2.1 Violaciones reales de las leyes (commit `683ca90`)

Las encontró el lint de TS0, no una revisión:

1. **§1 violada en `modules/fuel/narrate.js`**: importaba `fmt` de
   `core/dom.js`, o sea que un archivo puro arrastraba el DOM. Se movió `fmt`
   a `core/format.js` (era el plan de TS1; se adelantó para no dejar la ley
   en rojo).
2. **`core/shell.js` `route()`**: `let kind = 'lab'` y `let id = null` se
   pisaban siempre en los dos ramos (`no-useless-assignment`). Sin cambio de
   comportamiento: se quitaron los inicializadores.
3. **`game/modes/lab.js` `update(simDt)`**: parámetro sin usar; se renombró
   `_simDt` (§20: `update` existe, ignora el dt).

### 2.2 Conflictos de tipos y de lint, y cómo se resolvieron

Casi todo fueron **errores de inferencia, no bugs**; la regla fue declarar
tipos, no cambiar lógica.

| Hallazgo | Fase | Solución |
|---|---|---|
| `typescript` latest es 7.0.2 pero `typescript-eslint@8.70.1` pide `<6.1.0` | TS0 | `typescript@~6.0.3` (D1 del plan). TS 7 queda para tarea aparte. |
| `process.env.VITEST` prohibido por `noPropertyAccessFromIndexSignature` | TS0 | `process.env['VITEST']`. |
| `no-restricted-imports` de typescript-eslint está deprecada (8.64) | TS0 | Se usa la regla base de ESLint 10, que ya soporta `regex` + `allowTypeImports`. |
| `no-empty-function` contra los stubs no-op del contrato (`onFrame = () => {}`, `highlight() {}`, `sync() {}`, `resize() {}`) | TS0 | Regla apagada **sólo** en los archivos de contrato, con motivo (no hay opción `allow` para métodos en la versión TS). |
| knip: `_demo/{index,view}` sin uso y `PX_PER_LH`/`box` "muertos" | TS0 | `_demo` ignorado (el ejemplo se conserva por decisión de `AHORA.md`); las constantes se marcaron `@public` (contratos 4.4/4.7 de `CONTRATOS.md`). |
| `TIME_SCALES[TIME_SCALES.length - 1]` no demostrable con `noUncheckedIndexedAccess` | TS1 | Constantes `TIME_SCALE_MIN/MAX` nombradas (mismos valores). |
| `rng.pick([])` devolvía `undefined` | TS1 | Guard `throw new Error('invariante: …')`; los llamadores usan arreglos no vacíos. |
| `Number(...)` redundante y `!!` sobre boolean | TS1 | Simplificados; el guard `\|\| 0` de NaN del recorder se mantiene. |
| `unbound-method` / `no-confusing-void-expression` en defaults del loop | TS1 | Callbacks como propiedades (`onFrame?: (…) => void`) y cuerpos con llaves. |
| `node.append` no existe en `Node`; `String(unknown)` y `.flat()` con `Child` recursivo | TS2 | Firma de `append` sobre `Element`, ramas `typeof` explícitas en `setAttrs`, `append` recursivo. |
| Varianza de `emit` en los paneles | TS2 | Tipo genérico `I extends IntentLike` con un cast frontera interno y disable inline de `no-unnecessary-type-parameters` (documentado). |
| `p.failures?.length` y `list \|\| []` innecesarios | TS2 | Acceso directo (el tipo manda) y guard `null` en `InfoPanel.show`. |
| `unbound-method` en tests por los matchers de vitest | TS2 | Regla apagada sólo en `tests/**`. |
| Payload "vacío" de los intents | TS3 | `Record<never, never>` lo caza `no-generated-empty-object-type` y `void` lo caza `no-invalid-void-type`; se usa `NoPayload = undefined` con tipo condicional. |
| `labMode.handle` devolvía `undefined` con un intent desconocido | TS3 | El `switch` es exhaustivo **y** hay `default: return []` para lo que llegue en runtime (D9). Lo destapó un test. |
| Mocks incompletos de `SaveApi` y `onReset` opcional | TS3 | Mock completo con `get`/`reset`; llamadas con `!` en tests (permitido). |
| `Recorder<M['state']>` no asignable por varianza | TS3 | `Session.recorder` pierde el genérico: sólo se usa `series`. |
| `consistent-type-definitions` choca con el plan §8.1 (`type`, no `interface`, para que `params/faults/state` sean asignables a `Record<string, …>`) | TS4 | Regla apagada **sólo** en `src/modules/*/model.*`, con motivo. |
| `void wireEcu` / `void valve` (variables para descartar) | TS4 | La llamada se hace sin asignar. |
| `QuizMode` importado del módulo equivocado; `dataset.id` sin corchetes; `rng: undefined` con `exactOptionalPropertyTypes`; `createModel: desc.createModel` (método suelto); `readouts ?? []` de más; `presetNote` siempre truthy; `else if (kind === 'stage')` siempre true; `ui.labels === false` | TS5 | Import correcto, corchetes, spread condicional, wrapper `() => desc.createModel()`, acceso directo, `else`, `!ui.labels`. |
| `ParamValue \| undefined` por index signatures (`params[key]`) | TS5 | `GetValue` de los paneles y `InfoPanel.show` aceptan `undefined`/`null`: mismo comportamiento que antes (clave inexistente = vacío). |
| `EventTarget.target.closest` y `Element.dataset` | TS5 | `target instanceof Element` + `closest<SVGElement>()`; `closest<HTMLElement>` para el nav. |
| Dos casts en `loadTheme` (`localStorage`) | TS5 | Uno solo, validado con `THEMES`. |

### 2.3 Comprobación de física (TS4)

Antes de portar los módulos se guardó el `state` completo del combustible a
10 s simulados en 3 escenarios (arranque normal, `filterClog: 0.8`,
`relay: 'dead'`, semilla 12345) en un archivo fuera del repo. Después del
port, la comparación con igualdad exacta (`toEqual`) dio **idéntica**. El
port no cambió la física.

### 2.4 Estado final de fronteras

`grep -rn " as " src | grep -v "as const"` deja **5 casts** (la meta del plan
era <10), todos en fronteras y con comentario:

- `core/dom.ts`: `v as EventListener` (attrs `on*` del helper `h`).
- `core/shell.ts`: `t as Theme` (valor de `localStorage`, validado con `THEMES`).
- `core/ui/controls.ts` y `core/ui/faults.ts`: `emit as Emit` (frontera de
  los constructores de intents) y `partialModel as AnyModel` (fallback de
  `disabledWhen`).

## 3. Lo que queda pendiente (no es de esta migración)

- **TS 7**: al empezar cada tarea A, correr
  `npm view typescript-eslint peerDependencies`; si acepta TS 7, migrar es
  una tarea chica (plan §12).
- **`_demo/{index,view}.ts`**: son código de ejemplo que knip ignora; decidir
  si se borra o se engancha de nuevo al registro no era parte del plan.
- **`eslint.config.js`**: sigue en `.js` con `// @ts-check` y el bloque de
  tipos apagado (a propósito).
- **A3**: `faultCatalog`, herramientas, visibilidad de indicios y el campo
  `data.cue` de los eventos (plan motor-y-juice §6) son la próxima tarea; ya
  se escriben en `.ts`.

## 4. Verificación

- `npm run check` verde en cada fase y al cierre: typecheck, lint 0 warnings,
  knip, **123 tests** (110 originales + 12 de leyes + 1 de intent mal formado)
  y build.
- `git ls-files 'src/**/*.js' 'tests/**/*.js'` → vacío.
- `npm run dev`: `vite-plugin-checker` con 0 errores; el overlay se probó
  metiendo a mano un error de tipos y borrándolo.
- **Firefox (usuario, 2026-09-25)**: laboratorio y etapas del quiz funcionan
  sin errores en consola.
