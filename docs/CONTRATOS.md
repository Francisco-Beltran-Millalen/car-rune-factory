# Contratos

> Extraído de `docs/plans/2026-09-22-plan-maestro.md`. Este archivo es el **vivo**: si cambia la spec, se cambia acá (y se anota en `AHORA.md`).

Las leyes que estos contratos implementan están en `ARCHITECTURE.md` (§n).

## Contratos del core

### 4.1 Descriptor de módulo — `src/modules/<id>/index.ts`
```ts
import { defineModule } from '../../core/types.ts';

export default defineModule<FuelModel>({
  id: 'fuel',                          // coincide con la carpeta y la ruta #/lab/fuel
  title: 'Sistema de combustible',
  summary: 'Cómo llega la bencina desde el estanque a los inyectores.',
  order: 1,
  viewBox: [0, 0, 1200, 700],          // sistema de coordenadas del SVG del escenario
  createModel,                          // () => M
  circuit: FUEL_DEF,                    // (A7) CircuitDef: topología + layout
  present: FUEL_PRESENT,                // (A7) PresentScheme: canales del presenter
  defaultParams,                        // los DEFAULT_PARAMS del modelo
  defaultFaults,                        // los DEFAULT_FAULTS del modelo
  controls,                             // ControlSpec<M>[]
  faults,                               // FaultSpec[]
  readouts,                             // ReadoutSpec<M['state']>[]
  parts,                                // Record<partId, PartInfo>
  narrate,                              // (model: M) => Narration[]
  presets,                              // Preset<M>[] (opcional)
});
```
El tipo exacto es `ModuleDescriptor<M>` en `src/core/types.ts`; el registry lo borra a
`ModuleDescriptor` (una sola vez, vía `defineModule`). `createView?` quedó opcional
desde A7: el renderer genérico dibuja `circuit` y no lo llama.

### 4.2 Modelo — `src/modules/<id>/model.ts`
El tipo es `Model<P, F, S>` de `src/core/types.ts` (`params`, `faults`, `state` de sólo
lectura afuera, `actions`, `time`, `step(dt)`, `reset()`).
- Cada `model.ts` exporta `DEFAULT_PARAMS`, `DEFAULT_FAULTS` y `createXModel(overrides = {})`.
- `reset()` restaura **en el mismo objeto** (`Object.assign(params, DEFAULT_PARAMS)`): la UI guarda referencias a `params`/`faults`/`state` y no se re-cablea.
- `step` debe tolerar cualquier combinación de params/faults sin producir `NaN` ni `Infinity`. Se limita todo con `clamp`.

### 4.3 Vista — `createView(ctx)` (legado; A7 en adelante usan drawers)

`ViewContext<M>` y `View` están en `src/core/types.ts` (`svg`, `model`, `selectPart`; y
`update(dt)`, `highlight?(partId)`, `destroy()`). Desde A7 ningún módulo registrado lo
usa: el equivalente es un drawer por tipo visual (CONTRATOS 6.4), que también dibuja la
geometría una vez y en `update` sólo muta atributos.
- Todo elemento clickeable lleva `data-part="<partId>"`. Los `partId` deben existir en `parts`.
- Ni la vista ni el drawer cablean clics ni hover: el renderer delega sobre `[data-part]`, abre la ficha, muestra el tooltip con el nombre y agrega la clase `.selected` a todos los elementos de esa pieza. `highlight` es opcional, para efectos extra.
- Clases CSS disponibles (`src/styles.css`): `.part-body`, `.pipe-wall`, `.pipe-fluid`, `.fluid-{fuel,coolant,oil,electric,vacuum}`, `.liquid`, `.p-*`, `.lbl`, `.lbl-small`, `.valve-bar`, `.gauge-*`.
- La geometría se dibuja **una sola vez** (en `createView` o en `create` del drawer). En `update` solo cambia atributos (transform, fill, opacity, puntos de partículas).
- Colores **solo vía variables CSS** (`var(--fuel)` etc.) para que funcione el tema oscuro.
- **Trampa conocida (mordió dos veces)**: en SVG, una regla CSS le gana a un atributo de presentación (`fill="none"`, `opacity="…"`). Lo que se cambia en vivo va en `el.style.*`, y un trazo que no debe rellenarse necesita una regla CSS `fill: none` con más especificidad que la clase de color (p. ej. `.pipe .pipe-fluid`). Vale también para los drawers de A7.

### 4.4 Specs declarativas de la UI
```js
// ControlSpec
{ type: 'slider', key: 'rpm', label: 'RPM', min: 0, max: 6500, step: 50, unit: 'rpm', group: 'Motor' }
{ type: 'toggle', key: 'fastConsumption', label: 'Consumo acelerado ×100' }
{ type: 'select', key: 'ignitionKey', label: 'Llave', options: [{ value: 'off', label: 'Apagado' }, ...] }
{ type: 'button', action: 'refill', label: 'Rellenar estanque' }
// Los controles escriben en model.params[key]; los botones llaman model.actions[action]().
// Campo opcional: disabledWhen: (model) => boolean

// FaultSpec: se escribe en model.faults[key]
{ key: 'filterClog', label: 'Filtro tapado', kind: 'severity', description: '...' }   // slider 0..1 (0 = sano)
{ key: 'vacuumHoseOff', label: 'Manguera de vacío suelta', kind: 'toggle' }
{ key: 'relay', label: 'Relé de bomba', kind: 'enum', options: [{ value: 'ok', label: 'Bien' }, ...] }

// ReadoutSpec
{ id: 'pRail', label: 'Presión de riel', unit: 'bar', decimals: 2,
  get: (s) => s.pRail, gauge: { min: 0, max: 8, green: [2.3, 3.8] }, history: true }

// PartInfo (content.ts)
{ name: 'Bomba eléctrica', what: '¿Qué es?', why: '¿Para qué sirve?', how: '¿Cómo funciona?',
  failures: ['Síntoma → causa', ...] }

// Narration (narrate.ts): reglas evaluadas cada ~250 ms
{ level: 'info' | 'warn' | 'bad', text: 'La presión cae con carga: el filtro está restringiendo el paso.' }

// Preset (opcional): escenario guiado
{ id: 'clogged', label: 'Caso: tironea en subida', params: {...}, faults: {...}, note: 'Observa el manómetro al acelerar.' }
```

### 4.5 Bucle — `core/loop.ts`
```js
createLoop({ model, fixedDt = 0.001, maxStepsPerFrame = 4000, onFrame })
// → { tick(realDt), start(), stop(), stepOnce(), setTimeScale(x), setPaused(b), get timeScale, get paused, get running, destroy() }
// onFrame(simDt, steps). El historial: createRecorder(readouts) de core/history.ts, .sample(model) en onFrame.
```
- En cada frame: `realDt = min(ahora - antes, 0.1)`. Luego `acc += realDt * timeScale`. Mientras `acc ≥ fixedDt` (y sin pasar `maxStepsPerFrame`) se llama `model.step(fixedDt)`. Al final, `onFrame(realDt * timeScale)`.
- `timeScale` va de 0.01 a 4, con valores predefinidos: 0.01, 0.05, 0.25, 1, 2, 4. La cámara lenta es clave para ver los inyectores y el ciclo de 4 tiempos.
- El registro de historial (`history.ts`) toma muestras de las lecturas con `history: true` cada 50 ms de tiempo simulado. Guarda los últimos 400 puntos.

### 4.6 Partículas — `core/particles.ts`
```js
createFlow({ path /* SVGPathElement */, layer /* SVGGElement */, spacing = 14, radius = 3, className = 'p-fuel' })
// → { setSpeed(pxPerSec /* puede ser negativo */), setStyle(className), setDensity(0..1), setAir(0..1), update(dt), destroy() }
```
- Las partículas están distribuidas a lo largo del path (`getTotalLength`/`getPointAtLength`) y avanzan con `speed·dt`. La densidad visible = `density` (se ocultan partículas). Así se ven tramos vacíos o con aire.
- Convención visual: **velocidad ∝ caudal**, con escala `PX_PER_LH = 2.5` (100 L/h → 250 px/s). Cada módulo puede cambiar la escala.
- `className` permite `p-fuel`, `p-air` (burbuja hueca), `p-coolant`, `p-oil`, `p-mixture`, `p-exhaust`, `p-electric`.

### 4.7 Helpers SVG — `core/svg.ts`
`el(tag, attrs, parent)`, `group(parent, attrs)`, `pipe(parent, points, { width, className })` (devuelve `{ outer, inner, path }`, con esquinas redondeadas y un path central utilizable por `createFlow`), `box(parent, { x, y, w, h, r, label, part })`, `label(parent, x, y, text, opts)`, `arrowMarkers(svg)`, `gaugeSvg(parent, opts)` (manómetro con aguja: `{ setValue(v) }`). Las opciones de `pipe/box/label/gaugeSvg` son interfaces explícitas en el propio archivo.

### 4.8 Router / shell
- Ruta `#/lab/<id>` (y `#/<id>` redirige ahí), `#/stage/<id>`, `#/` portada. `createRouter` está en `core/router.ts` y el shell en `core/shell.ts`.
- `shell.mount(target)` recibe una unión discriminada: `{ kind: 'lab'; module } | { kind: 'stage'; module; stage; attempt }`. Crea el SVG, el modelo, la vista, el loop y los paneles, y `shell.unmount()` destruye todo sin dejar listeners.

### 4.9 Solver nodal — `src/sim/solver/`
Los tipos exactos son los de `src/sim/solver/types.ts` y la spec viva
(contrato de elemento, unidades, convergencia y benchmark) está en
`docs/modules/solver.md`.

```ts
createSolver({ nodeCount, elements, ground?, gmin?, maxIterations?, maxDelta?, tolerance? }): Solver
// elements[i] = { def: ElementDef, nodes: number[] }  (nodes lo asigna el circuito, A5)
// ground[node]: potencial fijo (Dirichlet); NaN = nodo libre
solver.step(dt) → { ok, iterations }
solver.potential(node) / solver.reaction(node)   // reaction = flujo que sale del nodo fijo
solver.setFixed(node, value) / solver.free(node)
solver.setPotential(node, value)                 // escritura directa de un nodo libre (A13)
solveDense(A, b, n): boolean                     // linalg: false si es singular
```

El elemento (`ElementDef`, §24) declara `ports`, `params`, `control`, `state`,
`capacitance?` (Ĉ por puerto, ya en flujo/(potencial·s)), `init?`,
`eval(pot, out, dt)` (flujo que sale del elemento hacia cada puerto y
`jac[p*k+q] = ∂flow[p]/∂pot[q]`), `commit(pot, dt, reaction)`, `probes?`,
`faults?` (ids §26 `<instancia>.<faultKey>`) y `fixed?(out)` para los nodos
Dirichlet que fija el propio elemento (p. ej. `pressureSource`).

### 4.10 Elementos y circuito — `src/sim/elements/`, `src/sim/circuit/`
Tipos exactos en `src/sim/elements/index.ts` y `src/sim/circuit/types.ts`;
leyes, params y validación en `docs/modules/solver.md` §6 y §7.

```ts
// Elementos (A5): una fábrica por tipo, registradas en ELEMENT_TYPES.
type ElementFactory = (params: Readonly<Record<string, number>>, fluid: Fluid) => ElementDef;
interface ElementTypeInfo { create: ElementFactory; joint?: boolean; multiple?: boolean }
// restrictor, checkValve, leak, volume, tee, electricPump, reliefRegulator,
// orifice, tank, pressureSource, battery, resistor, switch (el resistor lo
// pide el juguete de A5; no estaba en la tabla de P23 §8.2), currentLoad (A12:
// la carga de corriente media del primario de la bobina), junction, hydroNode,
// thermalNode (A12/A13: nudos `joint`/`multiple`), centrifugalPump,
// variableOrifice, displacementPump, linearRestrictor (A14), heatSource,
// temperatureSource, thermalConductance,
// advection y heatCapacity (A13: dominio thermal: °C/W/J/K), flowSource (A16:
// caudal impuesto, jacobiano nulo; los surtidores del carburador) y visual
// (A7: la pieza sólo dibujable; se movió a `sim/elements/` en A11).

// Circuito (A5):
compileCircuit<S extends CircuitState>(options: CompileOptions<S>): CompiledCircuit<S>
validateCircuit(def, types, controllerTypes?): CircuitIssue[]
// CircuitDef: parts, links ('part.port'), controllers, probes, params, faults,
//   fixed ('part.port' → potencial: atm/chasis), initial ('part.port' →
//   potencial de arranque de un nodo libre, A13), fluid
// CompileOptions: types, controllerTypes?, bindings?, init?, state, params?,
//   faults?, actions?, seed?
// CircuitBinding: { source: 'params'|'faults', key, part, input } copia un
//   valor del modelo al `control` del elemento en cada paso
// CompiledCircuit: model (contrato Model), solver, elements, controllers,
//   nodes (count/ports/fixed), portToNode, linkToNodes, issues
// CircuitStateValue = number | string | boolean | readonly unknown[]
// Salida de validate: error | warning (puerto sin conectar es warning)

// Controladores (A5) — src/sim/controllers/:
interface ControllerDef { id; probes?; state?; update(ctx: ControllerContext): void }
interface ControllerContext { dt; read(probe): number; params; faults; elements; rng }
// Corren antes del solver y `read` devuelve el muestreo del paso anterior (§25).
// A6 agrega `engineCore` y `stubs`; el combustible, `ecuFuel`, `alternator` y
// `fuelSupply`.
```

### 4.11 Bus de señales de laboratorio — `src/sim/signals/` (A11)

```ts
// src/sim/signals/bus.ts
export interface SignalBus {
  get(id: string): number;                        // paso anterior (o el mismo si sameStep)
  set(owner: string, id: string, value: number): void;  // valida el dueño (§28)
  commit(): void;                                 // lo escrito pasa a ser lo que se lee
  snapshot(): Readonly<Record<string, number>>;
}
export interface LabBus extends SignalBus {
  bindParams(params: Readonly<ParamRecord>): void;
  step(dt: number): void;                         // avanza los stubs con estado
}
export function createLabBus(options: {
  owner: string;
  publishes: readonly string[];
  stubs: Readonly<Record<string, StubSource>>;    // número | (params) => number | StubState
  sameStep?: readonly string[];                   // señales de fase (plan del vehículo §5.2)
  strict?: boolean;                               // get de una señal desconocida lanza (tests)
}): LabBus;
export function createLabBusController(id: string, bus: LabBus): ControllerDef;

// src/sim/signals/stubs.ts — tabla del plan del vehículo §5.3
export const SIGNAL_STUBS: Readonly<Record<string, StubSource>>;
export function createPhaseStub(): PhaseStub;     // engine.crankAngle/camAngle desde rpm
export function createSignalStubs(overrides?): Record<string, StubSource>;
```

El módulo pone el controlador `labBus` **primero**: en cada paso hace
`commit()` y después `step(dt)`, así las señales publicadas se leen con un paso
de retraso (las `sameStep`, apenas se escriben). A6 no migra el combustible:
sigue con su `FuelSignals`; A15 arma el bus del vehículo con varios dueños
sobre este mismo contrato.

## Shell de la UI

### 5.1 Layout (escritorio ≥ 1024 px)
```
┌──────────── header: título · selector de módulo · timebar (⏸ 0.05× 0.25× 1× 2× ⟲) ────────────┐
│ nav módulos │            ESCENARIO SVG (flex 1)            │ panel lateral (360 px, scroll)     │
│ (colapsable)│                                              │  ▸ Controles (agrupados por group) │
│             │                                              │  ▸ Fallas                          │
│             │                                              │  ▸ Mediciones (readouts)           │
│             │                                              │  ▸ Pieza seleccionada              │
├─────────────┴──────── barra "¿Qué está pasando?" (narración, máx. 3 mensajes) ────────────────┤
```
En pantallas angostas (< 1024 px) el panel pasa debajo del escenario. El SVG usa `preserveAspectRatio="xMidYMid meet"`.

### 5.2 Mediciones
Cada lectura muestra el valor numérico y una sparkline (SVG polyline del historial). Si tiene `gauge`, también un manómetro circular chico. Se pinta de color de alerta cuando sale de `green`.

### 5.3 Tokens CSS (`:root`, con tema oscuro vía `prefers-color-scheme` y `[data-theme]`)
`--bg --panel --fg --muted --line --accent --ok --warn --bad`
Fluidos: `--fuel` (ámbar), `--air` (blanco/gris claro), `--coolant` (verde-azulado), `--coolant-hot` (rojo), `--oil` (marrón dorado), `--mixture` (azul claro), `--burn` (naranja), `--exhaust` (gris), `--electric` (amarillo), `--metal` (gris acero), `--vacuum` (violeta).

## Contratos de juego

### 6.1 Sesión — `src/game/session.ts`

Separa del shell la parte "simulación en marcha", para que modos y tests la usen sin DOM.

```ts
createSession<M extends Model>(o: SessionOptions<M>): Session<M>
```

`SessionOptions` y `Session` están en `src/game/types.ts`: `model`, `loop`, `recorder`,
`tick(realDt)`, `onFrame(cb)`, `start()`, `stop()`, `reset()`, `destroy()`.
`driver: 'external'` significa que alguien llama `session.tick(realDt)` (Phaser, tests).

### 6.2 Intents — `src/game/intents.ts`

Los tipos son una **unión discriminada** por `type` (`IntentPayloads` → `Intent` →
`IntentOf<K>`); los constructores (`intents.setParam(key, value)`) están tipados para que
los typos fallen en los tests.

| type | payload | Emitido por | Lo usan |
|---|---|---|---|
| `setParam` | `{ key, value }` | panel de controles | lab, diagnosis (gratis), assembly (prueba) |
| `setFault` | `{ key, value }` (`key` estilo §26) | panel de fallas | sólo lab |
| `resetFaults` | — | botón "Reparar todo" | lab |
| `applyPreset` | `{ presetId }` | panel de casos | lab |
| `action` | `{ name, args }` | botones (p. ej. `refill`) | lab, diagnosis |
| `selectPart` | `{ partId }` | renderer (clic) | lab (ficha), quiz (respuesta), diagnosis (objetivo de herramienta) |
| `hoverPart` | `{ partId \| null }` | renderer | lab (tooltip) |
| `answer` | `{ choiceId }` | HUD | quiz (opción múltiple) |
| `useTool` | `{ toolId, partId }` | HUD / renderer | diagnosis |
| `removeTool` | `{ toolId }` | HUD | diagnosis |
| `replacePart` | `{ partId }` | HUD | diagnosis |
| `deliver` | — | HUD ("Entregar auto") | diagnosis |
| `markSuspect` | `{ partId, mark: 'suspect'\|'cleared'\|null }` | HUD / renderer | diagnosis (reservado; A3 lo acepta y guarda) |
| `placePart` | `{ partType, x, y }` (no `type`: chocaría con `intent.type`) | renderer (arrastre desde paleta) | assembly |
| `movePart` | `{ partId, x, y }` | renderer | assembly |
| `rotatePart` | `{ partId }` | renderer / tecla R | assembly |
| `deletePart` | `{ partId }` | renderer / tecla Supr | assembly |
| `connect` | `{ from: 'part.port', to: 'part.port' }` | renderer | assembly |
| `disconnect` | `{ linkId }` | renderer | assembly |
| `runTest` | — | HUD | assembly |
| `nextStage` / `retry` / `quit` | — | HUD | todos |

La pausa, la velocidad y el reinicio del reloj **no** son intents: son control del tiempo de la sesión (timebar). En diagnóstico y armado el modo puede deshabilitar la velocidad 4× vía `ModeUi.timebar`.

### 6.3 Modo — `src/game/modes/<id>.ts`

`ModeContext`, `ModeUi`, `ModeEvent`, `GameMode` y `GameStatus` están en
`src/game/types.ts`; `createXMode(ctx)` devuelve, como mínimo:

```ts
{
  id,                        // 'lab' | 'quiz' | 'diagnosis' | 'assembly'
  get ui(): ModeUi,
  handle(intent: Intent | null): ModeEvent[],
  update(simDt: number): ModeEvent[],
  hud(): HudModel | null,    // datos para el panel HUD (6.7)
  onReset?(),                // opcional: lo llama el botón ⟲ en vez de session.reset()
  get status(): 'playing'|'won'|'lost'|'free',
  destroy(),
}
```

El descriptor de módulo (CONTRATOS 4.1) tiene `defaultParams` y `defaultFaults` (los `DEFAULT_PARAMS`/`DEFAULT_FAULTS` que exporta `model.ts`). `resetFaults` hace `Object.assign(model.faults, module.defaultFaults)` sin tocar params ni estado.

`labMode` = comportamiento actual:
- `ui` muestra todo, `narration: 'full'`, `labels: true`.
- `setParam`/`setFault`/`applyPreset`/`action` se aplican tal cual, validando tipo y finitud (§6). La lógica de presets vive en el modo.
- `status: 'free'`.

### 6.4 Renderer — `src/render/<impl>/`

```ts
createRenderer(o: {
  container: HTMLElement;        // .stage
  circuit: CircuitDef;           // layout + topología (A7)
  viewBox: readonly [number, number, number, number];
  module: ModuleDescriptor;
  emit: (intent: Intent) => void; // único canal de salida (§20)
  tooltip?: HTMLElement;
}): Renderer
```

`Renderer` (`src/render/svg/index.ts`):
`update(visual: VisualState, dt)`, `applyUi(ui: ModeUi)`, `highlight(partIds?, style?)`,
`resize()`, `destroy()`; expone el `svg`.

- **`svgRenderer`** (A7): dibuja cada parte con la entrada del catálogo
  `DRAWERS[part.visual ?? part.type]` (`src/render/svg/drawers/index.ts`);
  partículas (`createFlow`) si el enlace declara `visual.flowClass`, con
  velocidad `flow × scale`. `update` sólo lee el `VisualState` (§22).
- **Conexiones (plan V1, `plans/2026-09-26-conexiones-visuales.md`)**:
  - Cada entrada del catálogo es `{ geometry, draw }` (`DrawerEntry`). La
    `geometry(part, def)` es **pura** y devuelve `PartGeometry`: `box` (el
    cuerpo que dibuja el drawer, sin etiquetas), `ports` (absolutos, sobre el
    borde del box), `subparts` (piezas que el drawer dibuja adentro, por id,
    con su caja y puertos), `container` (se dibuja detrás y aloja piezas:
    estanque, múltiple) e `inline` (va sobre un tubo: válvula check, galería).
    El drawer recibe `geo` en su contexto; `Drawer.ports` ya no existe.
  - Un enlace **se dibuja sólo si trae `visual`**. Su trazo es
    `[puerto de from, ...via, puerto de to]`: las puntas salen de la geometría
    (nunca se escriben), `via` son sólo los codos y todos los tramos son
    horizontales o verticales. Punta en un nudo (`tee`, `junction`,
    `hydroNode`, `thermalNode`): su `x/y`; con 3+ tubos dibujados lleva
    `.junction-dot`. Punta en una sub-pieza: el puerto que declara su drawer.
  - `CircuitPartDef.joinedBy`: la conexión de esa pieza (o nudo) la dibuja el
    drawer de otra (inyectores → riel); sus cajas tienen que tocarse.
  - Drawers genéricos para tramos: `hosePoint` (un restrictor que es la
    manguera misma: punto con `part.label`, puertos `a = b`) y `feedLine`.
  - `checkLayout(def, viewBox)` (`src/render/svg/layout.ts`) da los errores
    `visual-sin-drawer`, `extremo-sin-pieza`, `puerto-inexistente`,
    `tramo-diagonal`, `tubo-cruza-pieza`, `nudo-colgando`, `pieza-aislada`,
    `piezas-solapadas`, `tubos-encimados`, `fuera-del-lienzo` y
    `union-lejana`. `tests/render/layout.test.ts` lo corre sobre **todos** los
    descriptores del registro. `npm run layout` escribe una hoja SVG por
    laboratorio en `layout-sheets/` (cajas, puertos con coordenadas, tubos,
    problemas); con `rsvg-convert` se pasa a PNG. Lo que el chequeo **no** ve:
    etiquetas sobre tubos y trazos que un drawer dibuja por su cuenta (cables
    de alta del distribuidor): eso se mira en Firefox.
- **`legacyRenderer`** (A1–A6): eliminado en A7 junto con `fuel/view.ts`.
- **`phaserRenderer`** (A8/A9): igual contrato, drawers Phaser.

### 6.5 VisualState y presenter — `src/presenter/`

```ts
/**
 * @typedef {Object} VisualState
 * @property {Record<string, Record<string, number|string|boolean>>} parts  // partId → canales
 * @property {Record<string, { flow:number, potential:number, air:number }>} links  // linkId → flujo con signo (L/h o A), presión/tensión media, fracción de aire
 * @property {Record<string, string|number|boolean>} global   // p. ej. engineState, rpm
 * @property {string[]} faultCues                     // ids §26 visibles y activos
 */
```

El tipo exacto es `VisualState` en `src/core/types.ts`. `presentCircuit({ scheme,
catalog, state, params, faults, revealedFaults })` evalúa el `PresentScheme` del
módulo (funciones `(PresentContext) => VisualValue` por canal); `presentModel`
hace lo mismo partiendo de un `Model`. `visibleFaultSet` filtra las fallas
activas y visibles (`visibility:'always'` o reveladas por id §26 o clave plana).
Los canales de una animación que delata estado llevan nombre propio
(`pump.flow`, `filter.dirt`, `regulator.open`, `rail.pressure`…) para que un
modo futuro los pueda ocultar; A7 no implementa ese filtro (`ModeUi.instruments`).

### 6.6 Fallas: catálogo, visibilidad y reparación

Cada módulo publica `faultCatalog` en su descriptor:

```js
{ id: 'filter.clog', modelKey: 'filterClog', part: 'filter', kind: 'severity',
  healthy: 0, visibility: 'never',            // 'always' | 'inspect' | 'never'
  repair: { action: 'replace', cost: 25, minutes: 15 },
  symptoms: ['tironea al acelerar', 'pierde fuerza en subida'] }
```

- `faultCues` del presenter y el legacy sólo muestran indicios de fallas con `visibility:'always'` o incluidas en `ModeUi.revealedFaults`. En lab, `revealedFaults` = todas.

### 6.7 HUD — `src/ui/hud.ts`

Panel DOM genérico que pinta un `HudModel` (el tipo está en `src/game/types.ts`):

```ts
{
  title, brief,                              // enunciado de la etapa
  stats: [{ label, value }],                 // puntaje, dinero, tiempo, racha
  prompt?: { text, choices?: [{ id, label }] },   // quiz
  tools?: [{ id, label, active, cost }],     // diagnosis
  actions?: [{ intent, label, disabled }],   // p. ej. Entregar auto, Probar circuito
  suspects?: [{ partId, label, mark: 'suspect'|'cleared'|null }],  // reservado (14.3; A3 lo acepta)
  log: [{ level, text }],                    // últimos 6 feedbacks
}
```

Emite intents al hacer clic (`answer`, `useTool`, `deliver`…).

### 6.8 Etapas y guardado — `src/game/stages/`, `src/game/save.ts`

`Stage` (por ahora `QuizStage`) y `QuizStageConfig` están en `src/game/types.ts`:

```ts
{ id: 'fuel-quiz-1', mode: 'quiz', module: 'fuel', title, brief, seed: 101,
  unlockAfter: [],                   // ids de etapas previas
  config: { questions, types, parts, sameConcept? }   // específico del modo
}
```

- `src/game/campaign.ts` exporta la lista ordenada.
- La portada muestra "Laboratorio" (los módulos de siempre) y "Etapas" (bloqueadas/desbloqueadas).

```ts
/** Save v1 (localStorage 'crf.save.v1') */
{ version: 1,
  stages: { [stageId]: { bestScore, stars /*0-3*/, completedAt /*ISO*/ } },
  mastery: { [partType]: { seen, correct } } }
```

`createSave(storage = safeLocalStorage())` expone `get()`, `recordStage(id, result)`, `recordAnswer(partType, ok)` y `reset()`, con `storage` inyectable (Map en tests). El parseo valida `unknown` con guards (§27).

