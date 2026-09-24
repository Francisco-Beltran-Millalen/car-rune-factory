# Plan: arquitectura para juegos (modos, solver de redes y renderer intercambiable)

Fecha: 2026-09-23. Estado: **revisado** (revisión adversaria 2026-09-23, triaje en la sección 13).
Reemplaza el orden de `plans/2026-09-22-hoja-de-ruta-juego.md` (que queda como
registro de la conversación) y deja en pausa T7–T10 del plan maestro.

> **Para el agente que ejecute:** lee primero `AGENTS.md`,
> `docs/ARCHITECTURE.md` y `docs/CONTRATOS.md`. Este plan agrega leyes (§19–§27,
> sección 3) y contratos (sección 4) que la tarea **A0** copia a esos docs antes
> de escribir código. Cada tarea de la sección 9 dice qué archivos te pertenecen,
> qué no puedes tocar y cómo se acepta.

---

## 1. Contexto y objetivo

El norte (`docs/NORTE.md`) es un **juego de diagnóstico de autos en 2D al
estilo Carmen Sandiego**: llega un caso, se juntan pistas, se descartan
sospechosos y se acusa (y repara) la pieza culpable, como en *Car Mechanic
Simulator*, *Wrench* o *My Summer Car*, pero con diagramas, mouse y texto,
sin personaje. Los sistemas del auto **se entrelazan** (mapa en
`docs/SISTEMAS.md`), y el objetivo final son **casos entre sistemas**
(sección 14). Todo lo anterior son etapas hacia eso. Los tres primeros
jueguitos son:

- **E1 Nombrar piezas** (quiz).
- **E2 Diagnóstico** (falla escondida, herramientas, reemplazo de piezas).
- **E4 Armar circuitos** (arrastrar piezas y conectar puertos).

El usuario se inclina por **Phaser** (hoy `phaser@4.2.1`, verificado con
`npm view phaser` el 2026-09-23) para la etapa de armar circuitos.

Hoy el código es un laboratorio: `src/core/shell.js` arma de una vez modelo,
vista, loop y paneles. Los paneles escriben directo en `model.params` y
`model.faults` (`core/ui/controls.js`, `core/ui/faults.js`, presets en
`shell.js:206-214`). La vista del combustible (`modules/fuel/view.js`) es SVG
dibujado a mano, con coordenadas sueltas, y lee `model.state`, `model.params` y
`model.faults` (líneas 190-191). El modelo (`modules/fuel/model.js`) es un
circuito **fijo** escrito como ecuaciones en serie.

Para llegar al norte hacen falta cuatro cosas que hoy no existen:

1. **Modos de juego**: el mismo sistema simulado se usa como laboratorio, quiz,
   diagnóstico o armado. Cada modo decide qué ve el jugador y qué puede hacer.
2. **Un canal único de entrada** (intents): hoy tres paneles mutan el modelo
   por su cuenta, y un modo no puede ni observar ni vetar esas acciones.
3. **Circuitos como datos + solver genérico**: para armar un circuito, la
   topología tiene que ser un dato que la física lea, no código.
4. **Renderer intercambiable**: dibujar el mismo circuito con SVG (hoy) o con
   Phaser (mañana) sin tocar la física ni los modos.

Objetivo de este plan: dejar diseñada esa arquitectura **a fondo** y partida en
tareas ejecutables por agentes distintos, **sin romper el laboratorio actual**,
que al usuario le gustó.

## 2. Decisiones de diseño (con el porqué)

**D1. Cuatro capas con dependencias en una sola dirección.**

```
  content (datos: catálogo de piezas, circuitos, etapas, textos)
     │
  sim (puro) ── game (puro: sesión, modos, intents, guardado)
     │                │
     └──── presenter (puro: sim → VisualState) ────┐
                                                   │
  render (SVG hoy / Phaser mañana) ── ui (paneles DOM) ── shell (composición)
```

- `sim` no conoce `game`. `game` no conoce `render` ni el DOM.
- `render` no conoce `sim`: sólo recibe `VisualState`.
- Todo lo que no sea `render`/`ui`/`shell` corre en Node y se testea con Vitest.

*Por qué*: permite cambiar de renderer (D6) y testear modos sin navegador,
que además es obligatorio porque la verificación visual es manual (§13).

**D2. Intents como único canal de entrada del jugador** (vocabulario
Brain/Intent que el usuario ya usa en sus otros proyectos). Los paneles DOM y
el renderer **emiten** intents; el modo activo los **recibe** y decide si los
aplica, los cobra o los rechaza. Nadie más escribe en `params`/`faults`.

*Por qué*: en diagnóstico, subir el acelerador es gratis pero cambiar una pieza
cuesta dinero; en el quiz, hacer clic en una pieza es una respuesta; en el
armado, arrastrar crea una pieza. Sin un canal único cada panel tendría que
saber en qué modo está.

**D3. El modo es una máquina de estados pura.** Recibe intents y `simDt`;
expone su estado de juego, una política de UI (`ModeUi`: qué controles,
lecturas y fallas se ven, si la narración va completa, como pistas o
apagada, si se ven las etiquetas) y eventos (feedback, puntaje, fin de
etapa). El laboratorio actual pasa a ser `labMode`, con comportamiento
idéntico.

**D4. Solver nodal implícito genérico (tipo SPICE) para toda red
esfuerzo/flujo.** Nodos con un potencial (presión en bar o tensión en V).
Elementos multipuerto que, dado el potencial de sus puertos, entregan el flujo
que sale por cada puerto y su jacobiano. Integración Euler implícito con
Newton-Raphson por paso.

- Hidráulico y eléctrico comparten el solver. El dominio sólo sirve para
  validar conexiones.
- Elementos acoplados entre dominios (la bomba: puertos eléctricos +
  hidráulicos) entran en el mismo sistema de ecuaciones.
- El ciclo de 4 tiempos (mecanismo) **no** usa el solver.

*Por qué implícito y no el Euler explícito actual*: al armar circuitos
aparecen nodos intermedios sin compliancia (bomba→colador→filtro en serie).
En explícito eso exige compliancias ficticias diminutas y `dt` minúsculo. En
implícito, un nodo sin capacidad es simplemente algebraico. Es la técnica
estándar de los simuladores de circuitos, y además un circuito mal armado
(puerto abierto, nodo flotante) se resuelve con `gmin` en vez de explotar.

**D5. Circuito = datos** (`CircuitDef`): instancias de piezas con tipo,
posición y parámetros, más conexiones entre puertos, controladores y sondas.
Un compilador lo convierte en el sistema del solver. Las piezas conectadas
por una conexión comparten nodo (union-find). **El layout es parte del
circuito**: el mismo dato alimenta la física (topología), el renderer
(posiciones) y el modo armado (lo que el jugador edita).

**D6. Renderer detrás de un contrato; SVG hoy, Phaser evaluado con una prueba
corta (A8).** Los paneles (controles, lecturas, fichas, HUD) **siguen en DOM**
con cualquier renderer: Phaser sólo dibuja el diagrama dentro de `.stage`.

*Por qué*: rehacer sliders y textos en canvas no enseña nada nuevo, y el DOM
ya funciona con tema claro/oscuro. Phaser vale por el arrastre, los tweens,
el audio y el rendimiento con muchas partículas: justo lo que pide armar
circuitos.

**D7. Catálogo visual por tipo de pieza (patrón `VisualCatalog` de
breath-of-freedom).** La identidad de una pieza es su **tipo semántico**
(`filter`, `electricPump`), no un dibujo. Cada renderer tiene un *drawer* por
tipo. El presenter publica **canales** por pieza (p. ej. `rotor`, `level`,
`open`) que el drawer anima.

**D8. El laboratorio actual sigue funcionando en cada tarea.** El modelo a
mano del combustible se conserva como **modelo de referencia**: la versión
sobre el solver se valida contra él (mismos 13 tests + comparación de
trayectorias). La vista a mano se envuelve en un adaptador (`legacyRenderer`)
hasta que el renderer genérico la reemplace (A7).

**D9. El sim sigue a paso fijo de 1 ms (§4) y el loop no manda.**
`createLoop` ya expone `tick(realDt)`. La sesión puede ser impulsada por
`requestAnimationFrame` (SVG) o por el `update(time, delta)` de una escena
Phaser. Un solo reloj de simulación, venga de donde venga el frame.

**D10. Azar del juego con semilla por etapa** (§3). La falla escondida y las
preguntas del quiz salen de `createRng(stage.seed ^ intento)`: reproducible
para tests y para depurar ("la etapa 3, intento 2, me dio X").

**Descartado**:
- Pasar todo a Phaser ya (motivos en D6).
- Un solver explícito con compliancias ficticias (D4).
- Un ECS genérico: con decenas de piezas no aporta, y agrega un vocabulario
  que cada agente tendría que aprender.
- Frameworks de UI: el DOM declarativo actual alcanza.

## 3. Leyes nuevas y enmiendas (A0 las copia a `ARCHITECTURE.md`)

- **§17 (enmienda)** Sin dependencias de runtime, **salvo Phaser** una vez
  aprobado en A8. Phaser vive sólo en `src/render/phaser/` y se carga con
  `import()` dinámico: el laboratorio SVG no lo descarga.
- **§19** Capas: `content → sim → game → presenter → render/ui/shell`. Una
  capa no importa a las de su derecha. `sim`, `game` y `presenter` no tocan
  el DOM.
- **§20** Intents: toda acción del jugador es un intent (`{ type, ...payload }`,
  sección 4.2) que emiten `ui`/`render` y recibe el modo activo. Nada fuera
  del modo (y de los tests) escribe en `params`/`faults`/`actions`.
- **§21** El modo es puro: `handle(intent)` y `update(simDt)` sin DOM, con su
  azar por semilla (§3). Su política de UI (`ModeUi`) es la **única** fuente
  de qué se muestra.
- **§22** El renderer sólo lee `VisualState` (del presenter) y la definición
  del circuito. No lee `model.state`, `model.params` ni `model.faults`.
  (Excepción temporal: `legacyRenderer` de A1 hasta A7.)
- **§23** Identidad por tipo: una pieza se identifica por `type` + `id` de
  instancia. El dibujo se resuelve por tipo en el catálogo de cada renderer.
  Ninguna lógica depende de un nombre de archivo ni de una coordenada.
- **§24** Solver: los elementos son funciones puras de (potenciales de sus
  puertos, entradas de control, su estado interno) → (flujos, jacobiano). No
  escriben en nodos. El estado interno se actualiza sólo en `commit()`,
  después de converger.
- **§25** Los controladores (lógica discreta: ECU, relé, motor) corren
  **antes** de resolver cada paso y leen los valores del paso anterior (un
  paso de retraso = 1 ms, documentado). Sólo escriben entradas de control de
  elementos.
- **§26** Los ids de fallas son API pública estable: `<partId>.<falla>` (p.
  ej. `filter.clog`). Etapas, guardado y tests los usan. Renombrar uno exige
  migración.
- **§28** Señales del vehículo con **un solo dueño**: cada señal compartida
  entre sistemas (`engine.rpm`, `engine.state`, `engine.coolantTemp`,
  `fuel.mixture`, `ignition.spark`…) tiene exactamente un sistema que la
  escribe. Los demás la leen con un paso de retraso (§25). Un test fija el
  dueño de cada señal.
- **§29** Todo sistema corre aislado: cuando un sistema está solo (el
  laboratorio o un caso de un solo sistema), las señales que leería de otros
  las entrega un **stub ideal** (chispa siempre buena, 90 °C, 13,5 V…). El
  mismo sistema funciona dentro del vehículo sin cambios.
- **§30** Los fluidos no se mezclan salvo por un elemento de falla explícito
  (p. ej. `headGasket.breach`). Nunca por una conexión accidental entre
  redes de dominios distintos (lo impide `validate`).
- **§27** Guardado versionado (`crf.save.v1`), leído con try/catch y con
  valores por defecto si falta o está corrupto. Nunca bloquea el juego.

## 4. Contratos (A0 los agrega a `CONTRATOS.md` como sección "Juego")

Todos con JSDoc en `src/core/types.js` (o en un archivo `types.js` de cada
capa si crece: `src/game/types.js`, `src/sim/types.js`).

### 4.1 Sesión — `src/game/session.js`

Separa del shell la parte "simulación en marcha", para que modos y tests la
usen sin DOM.

```js
/**
 * @param {Object} o
 * @param {() => Model} o.createModel
 * @param {ReadoutSpec[]} o.readouts
 * @param {'raf'|'external'} [o.driver]  'external': alguien llama session.tick(realDt)
 * @param {(cb)=>number} [o.raf]  inyectable (tests)
 * @returns {Session}
 */
createSession(o) → {
  model,            // Model (CONTRATOS 4.2)
  loop,             // createLoop existente; con driver 'external' nunca llama raf
  recorder,         // createRecorder existente
  tick(realDt),     // avanza loop + recorder; devuelve pasos
  onFrame(cb),      // suscripción: cb(simDt) después de cada tick; devuelve unsubscribe
  start(), stop(), reset(), destroy(),
}
```

### 4.2 Intents — `src/game/intents.js`

Constantes + constructores (`intents.setParam(key, value)`) para que los typos
fallen en los tests.

| type | payload | Emitido por | Lo usan |
|---|---|---|---|
| `setParam` | `{ key, value }` | panel de controles | lab, diagnosis (gratis), assembly (prueba) |
| `setFault` | `{ key, value }` (`key` estilo §26) | panel de fallas | sólo lab |
| `resetFaults` | `{}` | botón "Reparar todo" | lab |
| `applyPreset` | `{ presetId }` | panel de casos | lab |
| `action` | `{ name, args }` | botones (p. ej. `refill`) | lab, diagnosis |
| `selectPart` | `{ partId }` | renderer (clic) | lab (ficha), quiz (respuesta), diagnosis (objetivo de herramienta) |
| `hoverPart` | `{ partId \| null }` | renderer | lab (tooltip) |
| `answer` | `{ choiceId }` | HUD | quiz (opción múltiple) |
| `useTool` | `{ toolId, partId? }` | HUD / renderer | diagnosis |
| `removeTool` | `{ toolId }` | HUD | diagnosis |
| `replacePart` | `{ partId }` | HUD | diagnosis |
| `deliver` | `{}` | HUD ("Entregar auto") | diagnosis |
| `placePart` | `{ type, x, y }` | renderer (arrastre desde paleta) | assembly |
| `movePart` | `{ partId, x, y }` | renderer | assembly |
| `rotatePart` | `{ partId }` | renderer / tecla R | assembly |
| `deletePart` | `{ partId }` | renderer / tecla Supr | assembly |
| `connect` | `{ from: 'part.port', to: 'part.port' }` | renderer | assembly |
| `disconnect` | `{ linkId }` | renderer | assembly |
| `runTest` | `{}` | HUD | assembly |
| `nextStage` / `retry` / `quit` | `{}` | HUD | todos |

La pausa, la velocidad y el reinicio del reloj **no** son intents: son control
del tiempo de la sesión (timebar). En diagnóstico y armado el modo puede
deshabilitar la velocidad 4× vía `ModeUi.timebar`.

### 4.3 Modo — `src/game/modes/<id>.js`

```js
/**
 * @typedef {Object} ModeContext
 * @property {Session} session
 * @property {ModuleDescriptor} module      // el sistema (fuel…)
 * @property {Stage|null} stage             // null en lab
 * @property {ReturnType<typeof createRng>} rng
 * @property {SaveApi} save
 *
 * @typedef {Object} ModeUi                 // lo lee el shell/ui cada ~100 ms
 * @property {string[]|'all'} controls      // keys de ControlSpec visibles
 * @property {string[]|'all'|'none'} faults
 * @property {string[]|'all'} readouts      // ids de ReadoutSpec visibles
 * @property {'full'|'hints'|'off'} narration
 * @property {boolean} labels               // etiquetas de texto del diagrama
 * @property {boolean} tooltips
 * @property {boolean} infoPanel
 * @property {boolean} presets
 * @property {{ maxScale:number }} timebar
 * @property {{ draggable:boolean, connectable:boolean, palette:string[] }} edit
 * @property {string[]} revealedFaults      // fallas cuyo indicio visual se muestra (§4.6)
 *
 * @typedef {Object} ModeEvent
 * @property {'feedback'|'score'|'stageEnd'|'uiChanged'} type
 * @property {'info'|'good'|'bad'} [level]
 * @property {string} [text]
 * @property {Object} [data]
 */
createXMode(ctx) → {
  id,                        // 'lab' | 'quiz' | 'diagnosis' | 'assembly'
  get ui(): ModeUi,
  handle(intent): ModeEvent[],
  update(simDt): ModeEvent[],
  hud(): HudModel,           // datos para el panel HUD (4.7)
  get status(): 'playing'|'won'|'lost'|'free',
  destroy(),
}
```

El descriptor de módulo (CONTRATOS 4.1) suma `defaultParams` y
`defaultFaults` (los `DEFAULT_PARAMS`/`DEFAULT_FAULTS` que ya exporta
`model.js`). `resetFaults` hace `Object.assign(model.faults, module.defaultFaults)`
sin tocar params ni estado (hoy `faults.js:59` toma una foto al montar, lo que
sólo funciona porque el modelo recién se creó).

`labMode` = comportamiento actual:
- `ui` muestra todo, `narration: 'full'`, `labels: true`.
- `setParam`/`setFault`/`applyPreset`/`action` se aplican tal cual. Mueve aquí
  la lógica de presets de `shell.js:206-214`.
- `status: 'free'`.

### 4.4 Renderer — `src/render/<impl>/`

```js
/**
 * @param {Object} o
 * @param {HTMLElement} o.container          // .stage
 * @param {CircuitDef|null} o.circuit        // null con legacyRenderer
 * @param {ModuleDescriptor} o.module
 * @param {(intent)=>void} o.emit            // único canal de salida (§20)
 */
createRenderer(o) → {
  update(visual /* VisualState */, dt),
  applyUi(ui /* ModeUi */),                  // etiquetas, tooltips, edición, fallas reveladas
  highlight(partIds /* string[] */, style /* 'selected'|'correct'|'wrong'|'target' */),
  resize(),
  destroy(),
}
```

- **`legacyRenderer`** (A1): envuelve `module.createView` existente. Traduce
  los clics a `selectPart` (hoy lo hace `shell.js:152-155`). Con
  `labels:false`, `applyUi` oculta **sólo** los elementos con clase
  `part-label` (y apaga el tooltip). Hasta que A2 ponga esa clase a los
  nombres, no oculta nada. Nunca se ocultan por `.lbl`/`.lbl-small`, porque
  los valores (`tankText`, `ecuText` en `view.js:72,85`) también llevan
  `lbl-small`. Es el único autorizado a leer el modelo (§22, excepción
  temporal).
- **`svgRenderer`** (A7): genérico desde `CircuitDef` + drawers SVG.
- **`phaserRenderer`** (A8/A9): igual contrato, drawers Phaser.

### 4.5 VisualState — `src/presenter/`

```js
/**
 * @typedef {Object} VisualState
 * @property {Record<string, Record<string, number|string|boolean>>} parts  // partId → canales
 * @property {Record<string, { flow:number, potential:number, air:number }>} links  // linkId → flujo con signo (L/h o A), presión/tensión media, fracción de aire
 * @property {Record<string, string|number>} global   // p. ej. engineState, rpm
 * @property {string[]} faultCues                     // indicios visibles ya filtrados por ModeUi.revealedFaults
 */
```

- `presentCircuit(compiled, simState, ui)` → `VisualState` (genérico, A7).
- Para el combustible a mano, `legacyRenderer` no usa `VisualState` hasta A7.

### 4.6 Fallas: catálogo, visibilidad y reparación

Cada módulo publica `faultCatalog` en su descriptor. Hasta A6 el combustible
mapea sus claves planas actuales a ids §26:

```js
{ id: 'filter.clog', modelKey: 'filterClog', part: 'filter', kind: 'severity',
  healthy: 0, visibility: 'never',            // 'always' | 'inspect' | 'never'
  repair: { action: 'replace', cost: 25, minutes: 15 },
  symptoms: ['tironea al acelerar', 'pierde fuerza en subida'] }
```

| id | modelKey | pieza | visibilidad | reparación (costo, min) |
|---|---|---|---|---|
| `filter.clog` | filterClog | filter | never (no se ve adentro) | cambiar 25, 15 |
| `strainer.clog` | strainerClog | strainer | inspect | cambiar 15, 45 (hay que bajar la bomba) |
| `pump.wear` | pumpWear | pump | never | cambiar 180, 60 |
| `relay.state` | relay | relay | never | cambiar 12, 5 |
| `regulator.state` | regulator | regulator | never | cambiar 60, 30 |
| `vacuumHose.off` | vacuumHoseOff | vacuumHose | inspect | reconectar 0, 2 |
| `injector2.leak` | injectorLeak | injector2 | inspect | cambiar 70, 40 |
| `feedLine.leak` | lineLeak | feedLine | always (charco) | cambiar 40, 30 |

- `faultCues` del presenter y el legacy sólo muestran indicios de fallas con
  `visibility:'always'` o incluidas en `ModeUi.revealedFaults`. En lab,
  `revealedFaults` = todas.
- Hoy `view.js` dibuja la suciedad del filtro (`filterDirt`, desde
  `f.filterClog`) y la manguera suelta (desde `f.vacuumHoseOff`). A3 cambia
  esas lecturas por "¿está revelada?".

### 4.7 HUD — `src/ui/hud.js`

Panel DOM genérico que pinta un `HudModel`:

```js
{
  title, brief,                              // enunciado de la etapa
  stats: [{ label, value }],                 // puntaje, dinero, tiempo, racha
  prompt?: { text, choices?: [{ id, label }] },   // quiz
  tools?: [{ id, label, active, cost }],     // diagnosis
  actions?: [{ intent, label, disabled }],   // p. ej. Entregar auto, Probar circuito
  log: [{ level, text }],                    // últimos 6 feedbacks
}
```

Emite intents al hacer clic (`answer`, `useTool`, `deliver`…).

### 4.8 Etapas y guardado — `src/game/stages/`, `src/game/save.js`

```js
/** Stage */
{ id: 'fuel-quiz-1', mode: 'quiz', module: 'fuel', title, brief, seed: 101,
  unlockAfter: [],                   // ids de etapas previas
  config: { … }                      // específico del modo (secciones 6-8)
}
```

- `src/game/campaign.js` exporta la lista ordenada.
- La portada muestra "Laboratorio" (los módulos de siempre) y "Etapas"
  (bloqueadas/desbloqueadas).

```js
/** Save v1 (localStorage 'crf.save.v1') */
{ version: 1,
  stages: { [stageId]: { bestScore, stars /*0-3*/, completedAt /*ISO*/ } },
  mastery: { [partType]: { seen, correct } } }
```

`createSave(storage = safeLocalStorage())` expone `get()`, `recordStage(id,
result)`, `recordAnswer(partType, ok)` y `reset()`, con `storage` inyectable
(Map en tests).

## 5. Shell nuevo (A1) — composición

`shell.mount(target)` donde `target = { module, stage|null }`:

1. `session = createSession({ createModel: module.createModel, readouts: module.readouts })`.
2. `mode = modes[stage?.mode ?? 'lab'](ctx)`.
3. `renderer = createLegacyRenderer({ container: stage, module, emit })`
   (desde A7: `svgRenderer` si `module.circuit` existe).
4. Paneles DOM construidos con `emit` en vez de `model`:
   - `createControlsPanel(container, specs, getValue, emit)`: `getValue(key)`
     lee params para mostrarlos, y los cambios hacen
     `emit(intents.setParam(key, value))`.
   - Lo mismo con fallas, presets, HUD e info.
5. `emit(intent)` → `events = mode.handle(intent)` → HUD/feedback/highlight.
6. `session.onFrame(simDt)` → `mode.update(simDt)` → renderer, lecturas y
   narración según `mode.ui`.
7. Cada 100 ms el shell compara `mode.ui` con el anterior (igualdad
   superficial por clave). Si cambió, re-aplica la visibilidad en paneles y
   `renderer.applyUi`.

Rutas: `#/lab/<moduleId>` (y `#/<moduleId>` redirige ahí, compatibilidad),
`#/stage/<stageId>`, `#/` portada. `router.parseHash` devuelve
`{ kind: 'lab'|'stage'|'home', id }`.

## 6. E1 — Quiz "Nombrar piezas" (A2)

`config`:
`{ questions: 10, types: ['find','name','purpose'], parts: 'all' | string[] }`.

- **find**: "Haz clic en: *Regulador de presión*". `selectPart` correcto →
  `highlight([id],'correct')`. Incorrecto → `highlight([clicked],'wrong')` +
  feedback con el nombre de lo que tocó.
- **name**: el renderer resalta una pieza (`'target'`) y el HUD ofrece 4
  nombres.
- **purpose**: el HUD muestra el `why` de una pieza (sin nombrarla) y 4
  nombres.
- Distractores: otras piezas del mismo módulo, con `rng`. Los inyectores
  1..4 cuentan como un solo concepto: nunca son distractores entre sí, y para
  `find` vale cualquiera.
- `ui`:
  - `labels:false`, `tooltips:false`, `infoPanel:false`, `controls:[]`,
    `faults:'none'`, `readouts:[]`, `narration:'off'`, `presets:false`;
  - el sim corre con `ignitionKey: 'run'` para que el diagrama se vea vivo.
- Al terminar: puntaje = aciertos ×10 + bono de racha. Estrellas: ≥90 % → 3,
  ≥70 % → 2, ≥50 % → 1. `save.recordStage` y `save.recordAnswer` por pieza.
- Etapas: `fuel-quiz-1` (sólo find, 8 piezas principales) y `fuel-quiz-2`
  (los 3 tipos, todas).
- **Riesgo que cubrir**: textos del diagrama que delatan la respuesta. Los
  del legacy (`view.js` líneas 55-155: 'Batería', 'Bomba', 'Filtro',
  'Regulador'…) llevan clase `lbl`/`lbl-small`. Las etiquetas de **valor**
  (`battText` '12,6 V', `tankText`, `ecuText`) también usan esas clases
  (`engineTagText` ya usa sólo `tag-text`). A2 **agrega** la clase
  `part-label` a cada etiqueta de nombre (sin quitar las existentes) y no
  toca las de valor. `legacyRenderer` (A1) ya oculta por `.part-label`. A7
  debe reproducir la misma separación en los drawers.

## 7. E2 — Diagnóstico (A3)

`config`:

```js
{ complaint: 'El auto tironea cuando acelero en subida.',
  faultPool: [{ id: 'filter.clog', value: 0.9, weight: 3 }, { id: 'pump.wear', value: 0.8, weight: 1 }],
  budget: 300, tools: ['manometer','ammeter','returnFlow','vacuum','inspect'],
  startParams: { ignitionKey: 'off' } }
```

- **Al empezar**: `rng` elige una falla del pool y el modo la aplica con la
  misma ruta que un intent interno (`modelKey` ← `value`).
- **Datos del diagnóstico por módulo**: `src/modules/fuel/diagnosis.js`
  (archivo nuevo, dueño A3), expuesto en el descriptor como `diagnosis`:

  ```js
  export const diagnosis = {
    perceptibles: [                        // lo que se percibe sin herramientas; el HUD lo muestra como stats de texto
      { id: 'engine', label: 'Motor', get: (s) => ENGINE_LABEL[s.engineState] },
      { id: 'pumpHum', label: 'Bomba', get: (s) => (s.relayOn && s.qPump > 5 ? 'zumba' : 'silencio') },
      { id: 'fuelGauge', label: 'Indicador de bencina', get: (s) => `${Math.round(s.tankLevel / 50 * 4)}/4` },
    ],
    tools: {                               // toolId → ids de ReadoutSpec que revela (deben existir en specs.js)
      manometer: ['pRail', 'dpRail'], ammeter: ['pumpCurrent'], returnFlow: ['qReturn'], vacuum: ['pMan'],
    },
    symptoms: (s) => [...],                // frases de síntoma para narration:'hints' (sin nombrar la causa)
  };
  ```

  Los perceptibles **no** son `ReadoutSpec`: son texto para el HUD (el panel
  de lecturas formatea números con `fmt`, `readouts.js:66-67`).
- **Lo que el jugador ve sin herramientas**: los perceptibles. Los controles
  de llave, acelerador y rpm son gratis.

  Fallas, presets y ficha técnica: ocultos. La narración va como
  `narration:'hints'`, que muestra sólo `diagnosis.symptoms(state)`.
- **Herramientas** (`useTool` → agregan lecturas a `ModeUi.readouts`; cada
  uso suma minutos al reloj del taller):

  | toolId | revela | costo |
  |---|---|---|
  | manometer | `pRail`, `dpRail` + manómetro en el diagrama | 5 min |
  | ammeter | `pumpCurrent` | 5 min |
  | returnFlow | `qReturn` | 10 min |
  | vacuum | `pMan` | 5 min |
  | inspect + `partId` | agrega a `revealedFaults` las fallas `visibility:'inspect'` de esa pieza | 3 min |

- **Reparar** (`replacePart` / reconectar): cobra el costo de la tabla 4.6 y
  suma minutos. Si la pieza tiene la falla activa, se restaura a `healthy`.
  Si no, igual se cobra (castigo por cambiar a ciegas).
- **Entregar** (`deliver`):
  - todas las fallas sanas → gana. Puntaje =
    `1000 − 2·costo − minutos − 150·entregasFallidas`, con mínimo 0.
    Estrellas según umbrales de la etapa.
  - si no → "el cliente vuelve": +1 entrega fallida y sigue.
- Si el dinero no alcanza para una reparación → `lost`.
- **Etapas**:
  - `fuel-diag-1`: filtro o fugas; fácil, con pistas;
  - `fuel-diag-2`: regulador, manguera o bomba;
  - `fuel-diag-3`: cualquiera, sin pistas.

## 8. Solver, circuitos y armado (A4–A9)

### 8.1 Solver — `src/sim/solver/`

- `linalg.js`: `solveDense(A: Float64Array, b: Float64Array, n)` con
  eliminación gaussiana y pivoteo parcial en su lugar. Devuelve `false` si la
  matriz es singular (pivote < 1e-14).
- `nodal.js`: `createSolver({ nodeCount, elements, ground })`, con
  `step(dt) → { ok, iterations }`. Por paso:
  1. Parte del potencial del paso anterior.
  2. Por iteración (máx. 25):
     - arma el residuo `F(x)` = suma de flujos que salen de cada nodo +
       término capacitivo `Ĉ_i·(x_i − x_i^prev)/dt`. `Ĉ_i` es la suma de
       las `capacitance` declaradas por los elementos, **ya expresadas en
       unidades de flujo del nodo por unidad de potencial por segundo**
       (hidráulico: L/h por bar/s, o sea `C[L/bar]·3600`). `nodal.js` no
       conoce dominios ni hace conversiones;
     - arma el jacobiano `J` = Σ stamps locales de los elementos + `Ĉ_i/dt`
       + `gmin` (1e-9) en la diagonal;
     - sólo los nodos libres son incógnitas. Los **nodos de potencial fijo**
       (Dirichlet: atmósfera, estanque, chasis, la fuente del múltiple)
       salen del sistema: su potencial es un dato (`fixed[node] = valor`,
       que un controlador puede cambiar entre pasos). El solver informa su
       **reacción** (el flujo neto que entra o sale) con
       `reaction(node)`;
     - resuelve `J·Δx = −F`;
     - amortigua: `|Δx|` ≤ 1 bar (o 1 V) por iteración;
     - converge cuando `max|Δx| < 1e-7` y, por nodo,
       `|F_i| < 1e-6 + 1e-6·Σ|flujos del nodo|` (tolerancia relativa).
  3. Si no converge: revierte al potencial previo, cuenta
     `stats.failures++` y devuelve `ok:false`. **Los tests exigen
     `failures === 0`** en todos los escenarios del combustible.
- Unidades internas:
  - hidráulico: bar y L/h, con `C` en L/bar → término `C·3600/dt`;
  - eléctrico: V, A, F.

  Cada elemento declara el dominio de cada puerto. No hay conversión
  implícita entre dominios: la bomba acoplada hace su propia cuenta.
- Nodos fijos por defecto: `atm` (hidráulico, 0 bar: destino de fugas y
  derrames; la bencina que llega aquí **se pierde**) y `chassis` (eléctrico,
  0 V). El estanque tiene su **propio** nodo fijo `tank` (0 bar), distinto
  de `atm`: el nivel se integra con `−reaction(tank)`, así el retorno vuelve
  al estanque y las fugas no.
- **Stamping**: cada elemento tiene k puertos. `eval` escribe
  `flow[k]` (flujo que sale del elemento **hacia** cada puerto, con signo)
  y `jac[k·k]` local (`∂flow_i/∂pot_j`). `nodal.js` los suma en las filas
  y columnas de los nodos de cada puerto; los puertos en nodos fijos
  aportan a la reacción, no a `J`.
- **Rendimiento**: 20 nodos → matriz de 20×20. Hay que **medir** en A4
  (test de benchmark que **imprime** ms por 1000 pasos, sin umbral inventado)
  y anotar el número en `docs/modules/solver.md`. El umbral de aceptación se
  fija después de medir: presupuesto 4× tiempo real = 4000 pasos por segundo
  de reloj.

### 8.2 Elementos — `src/sim/elements/`

Contrato (§24):

```js
{
  ports: [{ id: 'in', domain: 'hydraulic' }, …],
  params, control: {},                            // entradas que escriben los controladores
  state: {},                                      // interno (p. ej. corriente de una inductancia)
  capacitance?: { [portId]: Ĉ },                  // aporte al nodo, YA en unidades de flujo/(potencial·s) (8.1)
  init?(overrides),                               // estado inicial (p. ej. tank.level desde overrides.tankLevel)
  eval(pot /* Float64Array(k) */, out /* { flow: Float64Array(k), jac: Float64Array(k*k) } local */, dt),
  commit(pot, dt),                                // actualiza state tras converger
  probes: { [name]: (pot) => number },            // valores medibles (caudal, corriente…)
  faults: { [faultKey]: FaultSpec },              // §26: id público = `${instanceId}.${faultKey}`
}
```

Biblioteca mínima para portar el combustible (A5), cada una con tests
analíticos:

| tipo | puertos | ley | fallas |
|---|---|---|---|
| `restrictor` | a,b (hidr) | `q = sgn(Δp)·√(|Δp|/k)` regularizada cerca de 0: `q = Δp / √(k·(|Δp| + ε))`, ε = 1e-4 bar | `clog` (k·(1+F·s), F por instancia: filtro 1000, colador 150) |
| `checkValve` | in,out | diodo suave: conductancia `g_on` si Δp > 0, `g_off` = 1e-6·g_on, transición suave de 0,02 bar | `stuckOpen` (futuro) |
| `electricPump` | e+,e− (elec), in,out (hidr) | `q = Qm(V)·(1 − Δp/Pm(V))⁺·(1 − control.air)` con `V = e+ − e−` (misma curva que `fuel/model.js` paso 4 sin la parte en serie: las resistencias son elementos aparte); corriente `I = (1,5 + 5,5·max(Δp,0)/(Pm + εP))·V/13,5` con εP = 0,01 bar. **Guarda obligatoria** (equivale a `model.js:159,169`): si `V < 0,5 V`, `q = 0` e `I = V/R_bobinado` (R = 1 Ω). Así nunca se divide por ~0 con la llave apagada y el riel presurizado. Test: `V = 0` con Δp = 3 bar → flujos y jacobiano finitos | `wear` |
| `reliefRegulator` | in, ret, ref | `q = kReg·max(0, p_in − (p_ref + set))` suavizado | `state` ok/stuckOpen/stuckClosed |
| `orifice` (inyector) | in, out | `q = control.open ? Kinj·√(Δp⁺) : leak`, regularizado | `leak` |
| `leak` | a (a tierra) | `q = k·s·√(p⁺)` | `leak` (s) |
| `volume` | a | sólo `capacitance` (el riel: C = 0,005) | — |
| `pressureSource` | a | declara su nodo como **fijo** (Dirichlet) con potencial `control.p` (sin conductancias grandes: ver 8.1) | — |
| `tank` | out, ret | los dos puertos van al nodo fijo `tank` (0 bar); en `commit` integra `level −= reaction·dt/3600` (con `fastConsumption`); probes `level`, `pickupAir = 1 − clamp(level/1, 0, 1)`. Nivel inicial en `init(overrides.tankLevel ?? 40)` | — |
| `battery` | +,− | `V = control.v − R·I`, R = 0,02 Ω | — |
| `switch` | a,b (elec) | `R_on = 0,01`, `R_off = 1e7` según `control.closed` | `relay.state` via controlador |

**Paridad con el modelo de referencia.** El modelo a mano calcula la bomba con
las resistencias en serie en forma cerrada. Sobre el solver eso sale igual
(mismo equilibrio algebraico) porque las resistencias son elementos entre
nodos intermedios sin capacidad. Las diferencias esperadas (tensión en la
bomba = batería − caídas en el relé y la batería, ~0,05 V) se documentan con
su medición.

### 8.3 Controladores — `src/sim/controllers/`

```js
{ id, inputs: { probes: string[] }, update(dt, read /* (probeId)=>number */, params, faults, elements /* por id */, rng) }
```

- `rng`: `createRng(overrides.seed ?? 12345)` del **modelo** (lo usa el relé
  intermitente, como hoy `model.js:73,136`). Es independiente del rng de
  juego (D10).
- Corren antes de `solver.step` (§25). El retraso de un paso aplica sólo a
  lo que leen con `read` (sondas del paso anterior, p. ej. los caudales de
  inyección para `mixtureRatio`). Su **estado interno** (ángulo de
  cigüeñal, temporizadores) lo avanzan ellos mismos al inicio de `update`,
  y con eso deciden la apertura de los inyectores **del mismo paso**, igual
  que `model.js` paso 7. A6 mide el efecto en la paridad de caudales a
  800 rpm.
- Para el combustible: `ecuFuel` (cebado de 2 s, relé, ancho de pulso,
  apertura de inyectores por ángulo, enriquecimiento de arranque),
  `engineFuel` (máquina de estados `engineState`, rpm efectivas, ángulo de
  cigüeñal, `mixtureRatio` con los mismos filtros τ = 0,2 s,
  `pMan` → `control.p` de la fuente del múltiple), `alternator`
  (+1,4 V en marcha, −2 V en arranque → `battery.control.v`) y
  `fuelSupply` (lee `tank.pickupAir` → `pump.control.air`).
- Es la misma lógica de los pasos 1, 5, 7 y 8 de `fuel/model.js`, movida sin
  cambios de números.

### 8.4 Circuito — `src/sim/circuit/`

```js
/** CircuitDef */
{
  id: 'fuel-return', title,
  parts: [{ id: 'filter', type: 'restrictor', x: 560, y: 330, rot: 0, params: { k: 1e-5, clogFactor: 1000 }, label: 'Filtro' }],
  links: [{ id: 'feedA', from: 'check.out', to: 'filter.in', route: [[220,330],[520,330]] }],  // route opcional
  controllers: [{ id: 'ecu', type: 'ecuFuel', params: {…} }],
  probes: { pRail: { node: 'rail.a' }, qReturn: { element: 'regulator', probe: 'q' } },
  params: DEFAULT_PARAMS, faults: 'derivadas del catálogo de elementos'
}
```

- `compile(def, elementTypes, controllerTypes) → { model, nodes, elements, portToNode, linkToNodes }`.
- `model` cumple el contrato `Model` existente (params, faults, state, step,
  reset, actions, time): sesión, modos y UI no notan la diferencia.
- **Fábrica con la misma forma que hoy**: `fuel/circuit.js` exporta
  `createCompiledFuelModel(overrides = {})`, que acepta exactamente lo que
  usan los tests actuales: `{ params, faults, seed, tankLevel }` (ver
  `tests/fuel/model.test.js` test 10). `params`/`faults` se mezclan sobre
  los defaults, `seed` va al rng de controladores y `tankLevel` al
  `init` del tanque. Las acciones `refill`/`setTank` escriben el nivel del
  tanque. Los `faults` usan las **claves planas actuales** (`filterClog`…);
  el compilador las traduce a `<parte>.<falla>` con el `modelKey` de
  `fuel/faults.js` (A3). Así los tests no cambian y los ids §26 siguen
  siendo los del catálogo.
- `state` expone: las sondas por nombre, el estado de los controladores y
  los mismos campos que `fuel/model.js` §6.5. **Así los 13 tests actuales
  corren sin cambios contra el modelo compilado.**
- `validate(def, types) → Issue[]`:
  - puerto inexistente;
  - dominios distintos en una conexión;
  - puerto con más de una conexión (salvo tipo `tee`);
  - puerto sin conectar (**aviso, no error**: en el armado es una fuga o
    un circuito abierto, y es didáctico).
- Nodos: union-find de puertos por conexión. Cada puerto sin conectar es su
  propio nodo con `gmin` (flotante). Un puerto hidráulico abierto se trata
  como descarga a atmósfera con `leak` grande: la bencina se derrama, y ese
  es el mensaje didáctico.

### 8.5 Renderer SVG genérico — `src/render/svg/` (A7)

- `createSvgRenderer(o)` arma el `<svg>` con el `viewBox` del circuito. Por
  cada parte: `drawers[type].create(g, inst, theme) → { update(channels, dt), ports: {id:[x,y]} }`.
- Por cada conexión, `pipe()` con la `route`, o una ruta ortogonal
  automática (L con un codo) si no hay.
- Partículas con `createFlow` (ya existe) sobre cada conexión, con velocidad
  según `links[id].flow`.
- La vista del combustible **se reproduce** con drawers + `CircuitDef` con
  las coordenadas actuales de `view.js`, que pasan a `fuel/circuit.js`
  (cumple el "seguro barato" del layout como dato).
- Paridad visual: la verifica el usuario con la checklist de `AHORA.md`
  (§13).

### 8.6 Prueba con Phaser (A8)

Rama `spike/phaser`, `npm i phaser@^4.2.1` (volver a verificar la versión
antes). Preguntas con respuesta concreta, anotadas en `docs/decisiones/0001-phaser.md`:

1. ¿Se dibuja `fuel-return` desde `CircuitDef` + `VisualState` con ~300
   partículas a 60 FPS en la máquina del usuario? (Medido con el contador
   de FPS de Phaser; el usuario lo mira.)
2. Arrastrar una pieza con snap a grilla de 10 unidades y resaltar el puerto
   compatible más cercano (radio de 16).
3. Crear una conexión arrastrando de puerto a puerto y borrarla.
4. Canvas dentro de `.stage` junto a los paneles DOM, con redimensionado de
   ventana.
5. Tema: colores leídos de las variables CSS con `getComputedStyle` al
   montar y al cambiar de tema.
6. La sesión impulsada desde `scene.update(time, delta)` con
   `session.tick(delta/1000)`, `driver: 'external'`.
7. Tamaño del bundle antes y después (`vite build`), con carga dinámica.

**Criterio**:
- si 1–6 salen bien y el arrastre se siente mejor que en SVG → se adopta
  Phaser para el armado (A9) y el laboratorio sigue en SVG;
- si no → el armado se hace en SVG (con arrastre por pointer events).

Se decide con el usuario.

### 8.7 E4 — Armar circuitos (A9, diseño a confirmar tras A8)

- **Etapa**:
  `{ palette: ['electricPump','restrictor:filter',…], given: CircuitDef parcial, goal: [{ probe:'dpRail', when:'idle', range:[2.9,3.2] }, { probe:'leakTotal', max:0.05 }, …], budget }`.
- **Intents de edición** (4.2). El circuito editado se valida en vivo
  (`validate`) y los avisos se muestran en el HUD.
- `runTest`: recompila y ejecuta una **secuencia de prueba sin tiempo real**
  (`contacto 2,5 s → arranque 1,5 s → ralentí 3 s → fondo 3 s`) sobre un
  modelo nuevo, evalúa `goal` y devuelve un informe por criterio. Después
  puede reproducirse en vivo.
- Errores didácticos que el solver debe mostrar solos (con tests):
  - sin retorno → presión al máximo de la bomba;
  - check invertido → no hay caudal;
  - puerto abierto → derrame;
  - filtro ausente → funciona pero "sin filtrar" (aviso del validador, no
    de la física).

## 9. Tareas para agentes

Reglas comunes:
- Cada tarea termina con `npm test` y `npm run build` en verde, un bloque
  CERRADO en `AHORA.md` y un commit.
- Si es visual, deja además una checklist manual para el usuario (§13).
- Si el contrato no alcanza, se anota en `docs/core-requests.md` y **no** se
  improvisa.

| # | Tarea | Depende | Archivos propios | Aceptación |
|---|---|---|---|---|
| **A0** | Docs: leyes §17 (enmienda) y §19–§30 en `ARCHITECTURE.md`; sección "Juego" en `CONTRATOS.md` (4.1–4.8); actualizar `AHORA.md`, `NORTE.md` y `SISTEMAS.md` | — | `docs/**` | Docs consistentes; `ARCHITECTURE.md` ≤ 200 líneas |
| **A1** | Sesión + intents + labMode + shell nuevo + `legacyRenderer` + paneles que emiten intents + router con rutas nuevas | A0 | `src/game/{session,intents,types}.js`, `src/game/modes/lab.js`, `src/render/legacy/`, `src/core/{shell,router}.js`, `src/core/ui/*` (firmas nuevas), `src/modules/fuel/index.js` (sólo `defaultParams`/`defaultFaults`), `tests/game/**` | Los 54 tests actuales pasan. Tests nuevos: sesión con driver externo, intents, labMode (params/fallas/presets), `parseHash`. **El laboratorio se ve y se usa igual** (checklist). Ningún `model.params[...] =` fuera de modos/tests (`grep` en la checklist de cierre) |
| **A2** | E1 Quiz + HUD + guardado + campaña + portada con Etapas + separar las etiquetas de nombre en la vista del combustible | A1 | `src/game/modes/quiz.js`, `src/game/{save,campaign}.js`, `src/game/stages/fuel-quiz-*.js`, `src/ui/hud.js`, `src/core/shell.js` (portada), `src/modules/fuel/view.js` (sólo clases de etiquetas), `tests/game/quiz*.js` | Tests: generación de preguntas con semilla, distractores válidos (sin inyectores entre sí), puntaje/estrellas, save con storage en memoria y storage corrupto. Checklist: las 2 etapas jugables, sin etiquetas delatoras |
| **A3** | E2 Diagnóstico + `faultCatalog` del combustible + herramientas + visibilidad de indicios en la vista del combustible | A2 | `src/game/modes/diagnosis.js`, `src/game/stages/fuel-diag-*.js`, `src/modules/fuel/faults.js` (catálogo), `src/modules/fuel/diagnosis.js` (perceptibles, herramientas, síntomas), `src/modules/fuel/index.js` (sumar `faultCatalog` y `diagnosis`), `src/modules/fuel/view.js` (lectura de fallas reveladas), `tests/game/diagnosis*.js` | Tests: la falla elegida por semilla es la esperada; las herramientas agregan lecturas; reparar la pieza correcta sana el modelo; entregar sano gana / con falla penaliza; el presupuesto agotado pierde; la suciedad del filtro no se revela sin estar en `revealedFaults`. Checklist: las 3 etapas |
| **A4** | Solver nodal + linalg | A0 (independiente de A1–A3: **puede ir en paralelo**) | `src/sim/solver/**`, `tests/sim/solver*.js`, `docs/modules/solver.md` | Tests analíticos: divisor de tensión, RC (carga al 63 % en τ), RL, dos restrictores en serie vs. fórmula cerrada, nodo flotante sin NaN (gmin), matriz singular detectada. Benchmark impreso y anotado |
| **A5** | Elementos + circuito (compile/validate) + controladores base | A4 | `src/sim/elements/**`, `src/sim/circuit/**`, `src/sim/controllers/{index,base}.js`, `tests/sim/**` | Un test por elemento (ley + jacobiano contra diferencias finitas, error relativo < 1e-4). `validate` detecta cada tipo de problema de 8.4. Un circuito de juguete (batería-switch-resistencia; bomba-restrictor-tanque) compila y da el valor analítico |
| **A6** | Combustible sobre el solver: `fuel/circuit.js` + controladores del combustible; `model.js` → `reference-model.js` | A5 **y A3** (usa `fuel/faults.js` para traducir claves) | `src/modules/fuel/{circuit,controllers,reference-model,index}.js`, `tests/fuel/**` | La suite de los 13 tests parametrizada con `describe.each([reference, compiled])` pasa para ambos. Test de trayectoria: 8 escenarios (tabla de `fuel.md` §9b), diferencia en `pRail` ≤ 0,05 bar y en caudales ≤ 3 % en régimen. `solver.failures === 0`. Fuzz §6 contra el compilado **reducido** (200 combinaciones × 1000 pasos; el de 1000 × 2000 sigue sólo para la referencia), con el tiempo medido anotado. El descriptor usa el compilado; lab, quiz y diagnóstico siguen funcionando (checklist) |
| **A7** | Presenter + renderer SVG genérico + drawers; coordenadas de `view.js` → `fuel/circuit.js`; el combustible deja el legacy | A6 | `src/presenter/**`, `src/render/svg/**`, `src/modules/fuel/{circuit,index}.js`, `tests/presenter/**` | Tests del presenter (canales y flujos por conexión desde un estado conocido; filtrado de indicios). Paridad visual con la checklist del combustible (el usuario). `legacyRenderer` queda sin uso y se borra junto con `fuel/view.js` |
| **A8** | Prueba con Phaser (rama aparte) | A7 | rama `spike/phaser`, `docs/decisiones/0001-phaser.md` | Las 7 preguntas de 8.6 respondidas con mediciones. Decisión tomada **con el usuario** |
| **A9** | E4 Armar circuitos | A8 | según la decisión | Diseño detallado en un plan propio (`docs/plans/`) antes de programar |
| **A10** | **Plan** del vehículo y los casos entre sistemas (sección 14): contratos de `VehicleDef`, señales y `engineCore`; tabla de dueños de señales; formato de caso; análisis del tamaño del solver por componente conexa | A6 (y conviene A3 jugado) | `docs/plans/AAAA-MM-DD-vehiculo.md` | Plan con el mismo nivel de detalle que éste, con revisión adversaria. **Sin código** |
| A11+ | Sistemas 2–5 (4 tiempos, encendido, refrigeración, lubricación) sobre el solver, cada uno con su stub de señales (§29), y luego el vehículo y los casos | A10 | por sistema | Por plan propio |

Paralelismo: `A0 → A1 → A2 → A3` y, en paralelo, `A0 → A4 → A5`. Las dos
ramas se juntan en `A6 → A7 → A8 → A9`. **Con un solo agente**, el orden es
A1 → A2 → A3 → A4 → … (primero lo jugable). Las ramas paralelas no
comparten archivos: `src/sim/**` vs. `src/game/**`, `src/core/**`,
`src/render/legacy/**`, `src/modules/fuel/**`.

## 10. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Newton no converge por las no linealidades (raíces, válvulas) | Regularización ε, amortiguación de Δx, `gmin`, arranque desde el paso previo. `failures` contado y exigido en 0 por los tests. Jacobianos verificados contra diferencias finitas (A5) |
| El solver es más lento que el modelo a mano | Benchmark medido en A4. Matrices `Float64Array` reutilizadas. Si no alcanza 4×, bajar `maxScale` del timebar a 2× en esos módulos antes de optimizar |
| El compilado se desvía de la referencia sin que nadie lo note | Suite duplicada + test de trayectorias con tolerancias explícitas (A6) |
| El diagrama delata respuestas (etiquetas, indicios de falla) | `ModeUi.labels` / `revealedFaults`, clases separadas (A2, A3), tests del presenter |
| A1 rompe el laboratorio | A1 no cambia la física ni la vista; los 54 tests más la checklist manual del lab |
| Dos relojes (rAF y Phaser) | Sesión con `driver: 'external'` (D9); el loop existente ya tiene `tick` |
| El tema oscuro en canvas | La prueba A8 lo verifica explícitamente (pregunta 5) |
| Alcance: diseñar el armado antes de probar Phaser | A9 sólo tiene diseño general; su plan detallado se escribe después de A8 |
| El fuzz sobre el solver dispara el tiempo de la suite | Fuzz reducido para el compilado (A6); tiempo medido y anotado |
| División por ~0 y jacobianos infinitos en elementos | Guardas explícitas (bomba con V < 0,5 V; εP; ε del restrictor) + test "llave apagada con riel presurizado" por elemento |

## 11. Verificación de este plan

- Tras A1: laboratorio idéntico (checklist del combustible en `AHORA.md`).
- Tras A2 / A3: se juegan las etapas (checklists propias).
- Tras A6: las dos suites en verde y las tablas de paridad anotadas en
  `docs/modules/fuel.md`.
- Tras A7: paridad visual confirmada por el usuario.
- Tras A8: decisión escrita.

## 12. Preguntas de diseño de juego abiertas (no bloquean A0–A7)

Valores por defecto para no bloquear; el usuario puede cambiarlos:
- **Progresión**: campaña lineal simple con desbloqueo por etapa previa; el
  laboratorio siempre abierto.
- **Economía del diagnóstico**: presupuesto por etapa (no acumulado entre
  etapas).
- **Castigo**: entrega fallida −150; cambiar una pieza sana se cobra igual.
- **Estilo del diagnóstico**: E2 ya se diseña con el vocabulario de la
  sección 14.3: reclamo, perceptibles, herramientas, sospechosos, orden de
  trabajo. Así crece hacia los casos entre sistemas sin rehacerlo. Lo que E2
  **no** tiene todavía: la entrevista, el mapa del auto y los rangos.

## 13. Revisión adversaria (2026-09-23) — triaje

Revisor: subagente Sonnet sin contexto previo. Verificó contra el código
(citas de línea, `tick()`, 54 tests) y corrió la suite.

| # | Hallazgo | Veredicto | Dónde se corrigió |
|---|---|---|---|
| 1 | Factor de unidades del término capacitivo contradictorio | CONFIRMADO | 8.1 (Ĉ preescalado por el elemento), 8.2 |
| 2 | `electricPump`: división por `Pm→0` con la llave apagada | CONFIRMADO | 8.2 (guarda V < 0,5 V, εP) |
| 3 | Controladores sin rng (relé intermitente, test 11) | CONFIRMADO | 8.3 |
| 4 | Falta la fábrica con overrides `seed`/`tankLevel` | CONFIRMADO | 8.4 |
| 5 | Ocultar `.lbl,.lbl-small` ocultaría los valores | CONFIRMADO | 4.4, 6 (sólo `.part-label`) |
| 6 | `pumpHum` y el mapa herramienta→lecturas sin dueño | CONFIRMADO | 7 (`fuel/diagnosis.js`, dueño A3) |
| 7 | "Reparar todo" sin valores sanos en el descriptor | CONFIRMADO | 4.3 (`defaultParams`/`defaultFaults`) |
| 8 | Jacobiano local vs. global ambiguo | CONFIRMADO | 8.1 (stamping), 8.2 |
| 9 | `pickupAir` del tanque → bomba sin controlador | CONFIRMADO | 8.3 (`fuelSupply`) |
| 10 | Retraso de 1 paso en inyectores | PARCIAL: el ángulo es estado interno del controlador y no tiene retraso; sólo las sondas | 8.3 (aclarado; A6 lo mide) |
| 11 | Fuente con conductancia 1e6 + tolerancia absoluta | CONFIRMADO | 8.1 (nodos fijos Dirichlet, tolerancia relativa) |
| 12 | Fuzz de 2 M pasos sobre el solver | CONFIRMADO | A6, riesgos |
| 13 | `engineTagText` ya usa sólo `tag-text` | CONFIRMADO (menor) | 6 |
| 14 | Regularización del restrictor | Verificada correcta | — |
| 15 | Mover el solver después de Phaser | DESCARTADO: el solver no depende del renderer (D6); el armado lo necesita en SVG o en Phaser, y refrigeración/lubricación también. Se acepta la prioridad con un solo agente | 9 (orden con un agente) |

Además, del triaje: el estanque con dos puertos y "presión 0" se resuelve con
el nodo fijo `tank`, distinto de `atm` (8.1), así el retorno vuelve y las
fugas se pierden.

## 14. Vehículo: sistemas entrelazados y casos entre sistemas (diseño general; detalle en A10)

### 14.1 Por qué importa desde ya

"El auto no parte" tiene sospechosos en cuatro sistemas: batería, arranque,
combustible y encendido. Un caso al estilo Carmen Sandiego necesita que esos
sistemas **coexistan y se afecten** en una misma simulación. Si cada módulo
decide solo si el motor "anda" (hoy `fuel/model.js` tiene su propio
`engineState`), no hay forma de componerlos. Lo que se decide ahora para no
cerrarse esa puerta:

1. **Tres tipos de acople** (mapa en `docs/SISTEMAS.md`):
   - **Red eléctrica compartida (fuerte).** Es una sola red para todo el
     vehículo. En el solver, las piezas eléctricas de cada sistema cuelgan
     de nodos de **bus** con nombre (`bus.12v`, `bus.chassis`). El
     compilador del vehículo une los buses de todos los sistemas en los
     mismos nodos.
   - **Señales (débil).** Rpm, estado del motor, temperatura, mezcla y
     chispa van por un **bus de señales** con dueño único (§28), leído con
     un paso de retraso.
   - **Calor y giro del eje.** Son señales. El calor de combustión es una
     entrada del sistema de refrigeración; las bombas movidas por correa
     leen `engine.rpm`.
2. **`engineCore`**: un controlador a nivel vehículo, **dueño** de
   `engine.state` y `engine.rpm`. Decide si el motor parte, falla, se
   detiene o se daña con **todos** los aportes:
   - `fuel.mixture` (combustible);
   - `ignition.spark` (encendido);
   - `air.flow` (admisión);
   - `engine.compression` (4 tiempos);
   - `lubrication.pressure`;
   - `engine.coolantTemp`;
   - `electrical.crankVoltage` (el arranque gira sólo si hay tensión).

   El `engineState` que hoy está en `fuel/model.js` es una **versión de un
   solo aporte** de `engineCore`. En el laboratorio del combustible queda
   igual (con stubs ideales para los otros aportes, §29), y cuando exista el
   vehículo pasa a `engineCore` sin cambiar los tests del combustible.
3. **Los fluidos no se mezclan** (§30). Los cruces por falla (empaquetadura
   de culata, inyector que diluye el aceite) son elementos de falla que
   conectan redes a propósito y generan pistas: aceite con refrigerante, humo
   blanco.

### 14.2 Contratos a detallar en A10 (bosquejo)

```js
/** VehicleDef */
{ id: 'hatch-1', title: 'Hatchback 1.6',
  systems: [{ id: 'fuel', circuit: 'fuel-return' }, { id: 'ignition', circuit: 'cop-4' }, …],
  buses: { '12v': 'electric', chassis: 'electric' },          // nodos compartidos
  signals: { 'engine.rpm': { owner: 'engineCore', unit: 'rpm' }, 'fuel.mixture': { owner: 'fuel', unit: '' }, … },
  engineCore: { params: { … } } }
```

- `compileVehicle(def)` compila cada circuito, une los buses y arma **un
  solver por componente conexa**. Hidráulico-combustible + eléctrico quedan
  en una componente (por la bomba); refrigeración y aceite en otras. Así
  ningún sistema lineal crece a cien nodos densos.

  *Riesgo*: 100×100 denso cuesta ~27 veces más que 30×30. A10 lo mide con
  el benchmark de A4. Si no alcanza: un solver disperso, o cortar el acople
  bomba↔red eléctrica con un paso de retraso.
- **Stub por sistema** (§29): `stubs.js` con los valores ideales de cada
  señal que el sistema lee.

### 14.3 El bucle de juego "Carmen Sandiego" (diseño general)

| Carmen Sandiego | Aquí |
|---|---|
| El caso (el robo) | **Orden de ingreso**: el reclamo del cliente, con su propia voz ("tironea en subida", "no parte en las mañanas") |
| Pistas de testigos | **Entrevista** (preguntas cerradas: ¿desde cuándo?, ¿en frío o en caliente?) y **prueba de manejo** (mover los controles y mirar los perceptibles) |
| Viajar entre ciudades | **Mapa del auto**: un diagrama general de los sistemas. Entrar a un sistema cuesta tiempo; dentro se usan herramientas (manómetro, multímetro, escáner, inspección) |
| El dossier de sospechosos | **Sospechosos**: piezas candidatas que el jugador marca y descarta. El juego **no** las descarta solo |
| La orden de arresto | **Orden de trabajo**: el jugador escribe (elige) la pieza y la reparación **antes** de cobrar. Con una orden equivocada, el cliente vuelve |
| El reloj | Tiempo del taller + presupuesto del cliente |
| Rangos (detective → jefe) | **Rangos del taller**: aprendiz → mecánico → maestro → jefe de taller. Desbloquean sistemas, herramientas y casos entre sistemas |

- **Pistas honestas**: los síntomas los produce la simulación, no un
  guion.
- **Conocimiento como datos**: la relación síntoma ↔ sistemas ↔ fallas
  (`content/diagnostics.js`) sirve para generar casos, dar pistas
  graduadas y evaluar si una orden de trabajo "tenía sentido" (hubo pistas
  que la justificaban).
- La matriz de `SISTEMAS.md` define qué pistas **descartan** sistemas: un
  síntoma de frenos no incrimina al encendido. Los casos con "pista falsa"
  útil (servo de frenos → ralentí inestable) salen de las celdas `○` entre
  sistemas lejanos.
- **Progresión** (E2 del plan es la primera versión, dentro de un solo
  sistema):
  - casos de un sistema (combustible);
  - casos de un sistema con sospechosos de dos sistemas (la bomba no
    funciona: ¿relé, fusible o batería?);
  - casos entre sistemas sobre el vehículo.
