# Plan: A7 — presenter + renderer SVG genérico del laboratorio

Fecha: 2026-09-26. Tarea A7 de `FICHAS.md` (P23 §2 D6/D7, §8.5, fila A7 de
§9). Reemplaza al `legacyRenderer` y a `fuel/view.ts`. La paridad visual la
verifica el usuario con la checklist del combustible de `AHORA.md`.

## 1. Qué se construye

```
modelo compilado ──presenter──▶ VisualState ──render/svg──▶ SVG + partículas
        ▲                              ▲
   fuel/circuit.ts                fuel/present.ts (esquema de canales)
```

- `src/presenter/`: `presentCircuit()` genérico. Convierte
  `{ scheme, catalog, state, params, faults, revealedFaults }` en `VisualState`
  (CONTRATOS 6.5): canales por pieza, flujos por conexión, globales e
  indicios de falla ya filtrados por visibilidad.
- `src/render/svg/`: `createSvgRenderer()` genérico. Dibuja el `CircuitDef`
  por **tipo visual** con *drawers*; las conexiones con `route` (o ruta
  automática); las partículas con `createFlow`.
- `fuel/circuit.ts`: el layout completo (posiciones, `visual`, rutas y
  metadatos de trazo), el registro de tipos del módulo (incluye el elemento
  no-op `visual`) y `FUEL_DEF` exportado.
- `fuel/present.ts` (nuevo): el **esquema** de canales del combustible.
- `fuel/index.ts`: descriptor con `circuit`, `present`; sin `createView`;
  importa `fuel.css`.
- `core/shell.ts`: monta `createSvgRenderer` y llama al presenter una vez por
  frame.
- Se borran `src/render/legacy/**` y `src/modules/fuel/view.ts`.

## 2. Contratos nuevos (aditivos)

En `core/types.ts` (tarea de core, se anota en el CERRADO):

```ts
export interface PresentContext {
  state: Readonly<Record<string, unknown>>;
  params: Readonly<Record<string, unknown>>;
  faults: Readonly<Record<string, unknown>>;
  visibleFaults: ReadonlySet<string>;   // ids §26 visibles
}
export type PresentFn = (ctx: PresentContext) => number | string | boolean;
export interface PresentScheme {
  parts: Record<partId, Record<channel, PresentFn>>;
  links?: Record<linkId, { flow?: PresentFn; potential?: PresentFn; air?: PresentFn }>;
  global?: Record<string, PresentFn>;
}
export interface VisualState {
  parts: Record<partId, Record<channel, number|string|boolean>>;
  links: Record<linkId, { flow: number; potential: number; air: number }>;
  global: Record<string, number|string|boolean>;
  faultCues: readonly string[];          // ids §26 visibles y activos
}
```

`ModuleDescriptor` suma (opcionales, para no romper `_demo`):

- `circuit?: CircuitDef` — lo dibuja el renderer y es la fuente del layout.
- `present?: PresentScheme` — datos; el core no evalúa funciones de render.
- `createView?` — pasa a opcional (legacy hasta esta tarea).

En `sim/circuit/types.ts` (aditivo, datos de layout D5):

```ts
interface CircuitPartDef { ...; visual?: string }        // drawer; default type
interface CircuitLinkVisual {
  owner?: string;        // partId del trazo (clic/resaltado); sin owner no es clickeable
  pipeClass?: string;    // fluid-*
  flowClass?: string;    // p-*; sin esto no lleva partículas
  scale?: number;        // px/s por unidad de caudal (default PX_PER_LH)
  spacing?: number; radius?: number; width?: number;
  opacity?: number;      // opacidad fija del fluido si no hay potential
}
interface CircuitLinkDef { ...; visual?: CircuitLinkVisual }
```

El elemento `visual` del fuel es un no-op sin puertos (`noEval`/`noCommit`):
permite que piezas sólo visuales (`ecu`, `injectorWires`, `checkValve`,
`returnLine`) vivan en el `CircuitDef` sin pasar por el solver.

## 3. Presenter

`src/presenter/present.ts`:

- `visibleFaultSet(catalog, faults, revealedFaults)`: falla **activa**
  (`faults[modelKey] !== healthy`) y **visible** (`visibility === 'always'` o
  su id §26 está en `revealedFaults`). Devuelve ids §26.
- `presentCircuit({ scheme, catalog, state, params, faults, revealedFaults })`:
  evalúa cada `PresentFn` con `PresentContext` (incluye el set de visibles),
  arma `parts`/`links`/`global` (defaults 0) y `faultCues` (activas y
  visibles). Si el esquema no define un enlace, no aparece en `links`.

`revealedFaults` pasa a ser la lista de **ids §26** (estable, §26). `labMode`
usa `faultCatalog` (se agrega a `ModeModule` en `game/types.ts`); el quiz ya
usa `[]`.

## 4. Renderer SVG

`src/render/svg/index.ts` — `createSvgRenderer({ container, circuit,
viewBox, module, emit, tooltip })`:

- `<svg class="stage-svg <module.id>">` + `arrowMarkers` + capas en el orden
  del legacy: `pipes`, `behind`, `particles`, `parts`, `fx`.
- Por parte: `drawers[part.visual ?? part.type]`; el drawer crea su grupo con
  `data-part` en la capa que le toca y expone `{ update(channels, dt),
  ports?, destroy? }`.
- Por enlace: si tiene `route` o `visual`, `pipe()` con los puntos
  (route o ruta ortogonal por puertos); si `flowClass`, un `createFlow`.
  `update`: velocidad = `flow × scale`, densidad por umbral, aire, opacidad
  (`visual.opacity` o `pressureOpacity(potential)`).
- `applyUi(ui)`: oculta `.part-label` y el tooltip (igual que el legacy).
- `highlight`, clic (`selectPart`, con el toggle de `infoPanel`),
  `hoverPart` y tooltip: misma lógica que el legacy.
- Sin DOM en tests: los drawers son la única frontera.

## 5. Drawers por tipo visual (fuel)

`src/render/svg/drawers/`: `battery`, `key`, `relay`, `ecu`, `tank`,
`strainer`, `pump` (rotor), `checkValve`, `filter` (suciedad), `rail` (tubo
con partículas propias + manómetro), `injector` (aguja, spray y goteo),
`wires` (pulso por cruce de ángulo), `manifold` (etiqueta del motor),
`regulator` (diafragma y resorte), `vacuumHose` (suelta/ok), `lineLeak`
(gotas). Los nombres/las posiciones de los inyectores salen del `CircuitDef`
(§23), no de constantes sueltas.

Rutas (en `fuel/circuit.ts`, del `view.ts` actual): cables, aspiración,
alimentación A/B, retorno, vacío y arnés; el riel lo dibuja su drawer.

## 6. Esquema del combustible (`fuel/present.ts`)

- `battery.v`, `key.position`, `relay.closed`, `ecu.rpm`, `tank.level`,
  `pump.flow`, `checkValve.flow`, `filter.dirt` (con visibilidad de
  `filter.clog`), `rail.pressure` y `rail.flow`, inyectores `open`/`crank`/
  `rpm`/`mixture`/`leak` (inyector 2), `wires.crank/rpm/mixture`,
  `manifold.engineState`, `regulator.open`, `vacuumHose.off` (con
  `vacuumHose.off`), `lineLeak.flow` (con `feedLine.leak`).
- Enlaces visibles: cables (`p-electric`, escala 60/18), aspiración,
  alimentación, retorno y riel con sus caudales, aire (`pickupAir`) y
  potencial (`pPumpOut`/`pRail`).
- `FUEL_FAULTS` suma `visibility` (tabla de P23 §4.6) para el filtrado.

## 7. Cierre

- `tests/presenter/present.test.ts`: `visibleFaultSet` (activa/visible/oculta),
  `presentCircuit` con un esquema de juguete, y el esquema del fuel sobre un
  estado conocido (canales del compilado, flujo del retorno, suciedad tapada
  sin revelar, `faultCues`).
- `npm run check` verde; `CERRADO` y checklist de Firefox en `AHORA.md`
  (checklist del combustible + quiz 1 y 2 + tema oscuro).
- Se anota en `fuel.md` §7 que el layout vive en `circuit.ts` y los canales en
  `present.ts`.
