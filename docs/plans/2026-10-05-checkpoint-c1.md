# Plan — Checkpoint C1: los laboratorios se entienden

Fecha: 2026-10-05 (v2, revisada contra el código el mismo día). Autor: agente
planificador. Se lee de arriba abajo; **todo lo que hace falta para R0, U1,
H1, H2 y R1 está acá**. Reemplaza a las secciones L0, H1 y H2 de
`plans/2026-09-29-legibilidad-y-foco.md`; V2 y V3 siguen en ese plan con el
ajuste D-C1 de éste.

**Cómo se revisó este plan** (v2): cada afirmación sobre el código se
comprobó leyendo el código o corriendo una prueba desechable (borrada
después). Lo medido está marcado con **[medido]**. La v1 tenía siete errores
que la v2 corrige (§9), y la revisión destapó dos bugs del vehículo que ya
están arreglados en `bdadc5f`.

## 1. Dónde estamos

- Rama `claude/friendly-rubin-cpnaoh` (se trabaja en la nube y se mergea a
  `main` por checkpoint). `npm run check` verde, 512 tests.
- Bloque S cerrado: 12 rutas (10 laboratorios sueltos y 2 vehículos).
- Arreglado hoy: ⟲ que no reiniciaba del todo, el solver que no convergía al
  cortar la llave, el vehículo que ignoraba `initial`, el feedback del quiz
  con tiempo simulado (era **L0**), el acumulador del loop, el guardado
  (`2758c5c`); y en el vehículo, las fallas atadas por `bindings` que no
  hacían nada (filtro, colador, bomba, fugas, consumo rápido) y las
  sub-piezas de los drawers sin prefijo, que rompían §10 (`bdadc5f`).
- **`happy-dom` ya está instalado** (dev) y hay un primer test en DOM
  (`tests/render/parts-dom.test.ts`): monta las 12 rutas con el shell real.
- **Revisiones en Firefox pendientes**: A14, V1, A16, A15, los FIX de flujo y
  los CERRADO del 2026-10-05.
- **La revisión del 2026-09-29 se hizo con el panel de controles vacío**
  (regresión arreglada en `a23e1a9`): "los sliders no dan feedback" se anotó
  sin sliders en pantalla. Hay que volver a mirarlo (R0).
- Deuda que estorba a H1: `core/shell.ts` tiene 503 líneas (`mount()` ~245).

## 2. El checkpoint y por qué

**C1 = "los 10 laboratorios sueltos se entienden y están revisados".** Está
logrado cuando, en Firefox, en cada laboratorio suelto:

1. al tocar un control se ilumina lo que modifica;
2. al tocar o activar una falla se ve dónde está y dónde se nota;
3. un control de efecto lento o condicional lo dice;
4. el usuario recorrió los 10 laboratorios y el quiz, y lo que falló quedó
   anotado o arreglado.

Los vehículos quedan para **C2** (V2 cámara + V3 chasis). Por qué este
orden y no otro:

- **S2 ahora (A17…)**: cada sistema nuevo suma un laboratorio sin revisar y
  más carga a un vehículo que no se lee; y habría que volver a cada uno a
  declarar `affects`. Con H1 primero, S2 lo trae de entrada (D-C6).
- **El vehículo primero (V2/V3)**: es lo más grande y riesgoso, V3 espera una
  respuesta del usuario (§8), y la cámara se enfoca con lo que hace H1.
- **C1** es incremental, cada paso se verifica solo y le deja a C2 la base.

## 3. Definición de "hecho"

- `npm run check` verde en cada tarea, CERRADO en `AHORA.md`, commit.
- Todo control slider/toggle/select de los 10 laboratorios declara `affects`
  (o `[]` con `disabledReason`), y cada id de `affects` y de
  `FaultCatalogEntry.part` está **dibujado** (`data-part` en el SVG real).
- El quiz sigue jugable; una falla oculta no se delata (test).
- Los paneles de controles y fallas tienen tests en DOM.
- `core/shell.ts` ≤ ~300 líneas, sin cambio de conducta.
- El usuario hizo R1 y lo que salió quedó en `AHORA.md`.

## 4. Decisiones

**D-C1 — L0 está cerrado; el `realDt` del renderer pasa a V2.** El quiz ya
recibe `realDt` (`GameMode.update(simDt, realDt)`). H1 no lo necesita: el
pulso es animación CSS y los temporizadores de UI son `setTimeout` de la capa
DOM. Las partículas siguen con `simDt` (a 0,05× deben ir lento).

**D-C2 — El resaltado tiene capas (corrige la v1).**
Hoy `renderer.highlight(ids, style)` (`render/svg/index.ts`) borra **todos**
los estilos antes de poner el suyo, y **el quiz depende de eso**
[medido en el código]: al pasar de pregunta emite sólo `target`
(`game/modes/quiz.ts:336-337`) y eso borra el `correct`/`wrong` anterior; al
terminar emite `highlight([], 'selected')` (`:290`) para limpiar todo; y ⟲
llama `renderer.highlight([])` (`core/shell.ts:310`). La v1 proponía "cada
estilo limpia sólo el suyo": eso dejaba marcadas las respuestas viejas del
quiz. Lo correcto:

- **Capa de juego** = `selected`, `correct`, `wrong`, `target`: se comporta
  **exactamente como hoy** (un `highlight` de cualquiera de ellos limpia los
  cuatro). El quiz y el shell no cambian.
- **Capa `affected`** (H1): su propio `highlight(ids, 'affected')` sólo
  limpia `affected`.
- **Capa `fault-cue`** (H1): no pasa por `highlight`; la deriva el renderer
  de `visual.faultCues` en cada `update`.

Test en DOM: con una pieza `selected`, `highlight(['x'], 'affected')` no le
quita `.selected`; `highlight(['y'], 'target')` sí le quita `.correct`.

**D-C3 — DOM de test: `happy-dom` 20.14.5 (dev), ya instalado [medido].**
Monta el shell real en las 12 rutas, el quiz y la portada. Lo único que hay
que reemplazar es `requestAnimationFrame`/`cancelAnimationFrame` (si no, la
sesión avanza sola): `vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1))`
y se avanza a mano con `window.__sim.session.tick(dt)`. `CSS.escape`, SVG,
`localStorage`, clics y eventos `input` funcionan sin dobles. Se activa por
archivo con `// @vitest-environment happy-dom` (la simulación sigue en Node,
§1). Patrón de referencia: `tests/render/parts-dom.test.ts`.

**D-C4 — Partir `core/shell.ts` antes de H1, sin cambiar conducta**, con los
tests de U1 como red.

**D-C5 — Controles que el vehículo pisa: lista medida, motivo en
`VehicleDef`, y un test que la mantiene honesta (corrige la v1).**
La v1 pedía un test que cruzara la lista con `paramsView`; estaba mal:
`paramsView` pisa `rpm`, pero el slider `rpm` del vehículo **sí** actúa
(mueve `engineCore`, que lee los `params` reales). La lista correcta salió de
medir, para cada control, si cambia el estado del sistema entre su mínimo y
su máximo (1,5 s a 3000 rpm y acelerador 0,5), en el laboratorio y en el
vehículo **[medido, después del arreglo de `bindings`]**:

| Control | Vehículo | Laboratorio | Vehículo | Motivo para mostrar |
|---|---|---|---|---|
| `ignition:compression` | los dos | actúa | no | "La da el motor (`engine.compression`)" |
| `cooling:load` | los dos | actúa | no | "La calcula el motor (`engine.load`)" |
| `ignition:batteryV` | 2000 | actúa | no | "La batería es la del sistema de combustible" |
| `cooling:batteryV` | 2000 | (lento) | no | ídem |
| `ignition:camOffset` | 2000 | actúa | no | "La fase la da la distribución del motor" |

(`fuel:fastConsumption`, que estaba en la lista del 09-29, **ya actúa**: era
el bug de `bindings`. `ignition:camOffset` de los platinos en `vehicle-70`
sí actúa.) Mecanismo: `VehicleDef.overridden: Readonly<Record<string,
string>>` (clave con prefijo → motivo). `scopedControls`
(`modules/vehicle/index.ts`) hoy **borra** `disabledWhen` de todo control del
vehículo; para las claves de `overridden` pone `disabledWhen: () => true`,
`disabledReason` y `affects: []`.

Test (`tests/vehicle/controls-parity.test.ts`, mismo método que
`tests/vehicle/faults-parity.test.ts`, que ya existe): para cada control no
compartido de cada sistema, (a) si actúa en el laboratorio y no en el
vehículo, su clave está en `overridden`; (b) toda clave de `overridden` de
verdad no actúa en el vehículo. Así la lista no se desactualiza cuando
llegue A17 (que le dará dueño a la batería).

**D-C6 — Desde C1, todo plan de S2 trae `affects`** en controles y catálogo,
y `hint`/`disabledReason` donde corresponda. Lo exige el test de H1, que
recorre el registro.

**D-C7 — Controles de efecto lento o condicional: se quedan y lo dicen
(responde la pregunta 3 del plan del 09-29 con evidencia).** La medición
del 09-29 corrió sólo 2 s; leyendo spec y código:

| Control | Por qué parece no hacer nada | `hint` |
|---|---|---|
| `vehicleSpeedKmh` (refrigeración) | aire de marcha por el radiador (`cooling.md` §5, `cooling/controllers.ts:184`): térmico, minutos | "Se nota en minutos; activa «Calentamiento ×20»" |
| `ambientC` (refrigeración) | ídem | ídem |
| `humidity` (`ignition-points`) | sólo con la tapa fisurada (`ignition.md` §4: `capCracked·(0,3 + 0,7·humidity)`; `ignition/core.ts:310`) | "Sólo importa con la tapa del distribuidor fisurada" + `disabledWhen` mientras `capCracked === 0` |
| `lateralG` (lubricación) | corre el aceite en el cárter (`lubrication.md` §5, `nivel − 1,5·lateralG`): con nivel normal el chupador sigue cubierto; el dibujo del cárter sí se inclina | "Con poco aceite (≈2,3 L) el chupador aspira aire" |

En el vehículo, `scopedControls` borra `disabledWhen`; el de `humidity` no se
traslada (leería la falla sin prefijo): queda sólo el `hint`.

**D-C8 — `affects` apunta a lo dibujado, no a lo que tiene ficha (nuevo).**
Una pieza puede tener ficha y no tener `data-part` en el SVG
**[medido con happy-dom]**: en los laboratorios sueltos, `rings`, `head` y
`camshaft` (4 tiempos), `scope` (encendido) y `distributor`
(`ignition-points`: el cuerpo no es clickeable, sus sub-piezas sí).
Resaltar una de ésas no mostraría nada. Por eso la validación de `affects` y
de `FaultCatalogEntry.part` se hace **en DOM** contra los `data-part`
visibles, no contra `parts`. En el vehículo, el motor de 4 tiempos es una
sola caja (`data-part="four-stroke"`): `scopedControls` y
`scopedFaultCatalog` reemplazan todo `four-stroke:*` por `four-stroke`
(sistemas `kind: 'mechanism'`).

**D-C9 — API de los paneles: opciones al final y `destroy()` (nuevo).**
`createControlsPanel(container, specs, getValue, emit, modelContext)` y
`createFaultsPanel(container, specs, getValue, emit, defaultFaults)` reciben
hoy argumentos posicionales y no tienen `destroy`. H1 les agrega un último
argumento `options: { onFocus?: (partIds: readonly string[] | null, reason: 'hover' | 'use') => void }`
(`'use'` = `pointerdown`, `input`/`change` o foco por teclado; `'hover'` =
pasar el mouse. En C1 los dos sólo resaltan; C2 mueve la cámara sólo con
`'use'`, para que no salte al recorrer el panel: plan de C2, E4)
(no se cambian los posicionales: hay tests que los usan) y un `destroy()` que
limpia el temporizador de 1,5 s; `mount` lo llama al desmontar.

## 5. Tareas, en orden

`R0 → U1 → H1 → H2 → R1`. Un agente a la vez.

### R0 — Revisión del usuario en Firefox (opcional)

**Decisión del usuario (2026-10-05)**: R0 se salta; la revisión completa se
hace en R1, con H1 y H2 ya hechos ("no entiendo mucho lo que veo; mejor
terminar y después revisar todo"). Lo que ya anotó está en `AHORA.md`, "R0".
U1 puede empezar sin R0. Lo que sigue queda como guía para quien quiera
mirar antes:

El agente sólo anota en `AHORA.md`, bajo "REVISIÓN EN FIREFOX", lo que diga
el usuario, tal cual. `npm run dev` y, en orden:

1. **Los 10 laboratorios sueltos** (`#/lab/fuel`, `four-stroke-ohv`,
   `four-stroke-dohc`, `ignition-points`, `ignition-cop`, `cooling-viscous`,
   `cooling-electric`, `lubrication-gauge`, `lubrication-lamp`,
   `carburetor`). En cada uno:
   - ¿Aparecen todos los controles? Mover cada slider de punta a punta: ¿se
     ve **algún** cambio en el diagrama en ~2 s? Anotar los que no.
   - Llave a "Marcha" (donde haya), esperar, ⟲: ¿vuelve a como estaba?
   - Un caso de "Casos para probar": ¿la nota se entiende? ¿se ve el síntoma?
2. **El quiz**, las dos etapas, a 1× y a 0,05× (a 0,05× la pregunta siguiente
   aparece a ~1 s).
3. **Las checklists de los CERRADO del 2026-10-05** (`AHORA.md`).
4. **Los vehículos**: en `vehicle-70`, clic en los platinos (dentro del
   distribuidor) → aparece su ficha; en `vehicle-2000`, falla "Filtro
   tapado" al máximo → la presión del riel baja. El resto, sólo confirmar que
   sigue igual (la legibilidad es C2).

Un bug de física o de dibujo que salga se arregla **antes de U1**, como FIX
aparte con su test.

### U1 — Tests de UI en DOM y `shell.ts` partido (core, sin cambio visible)

**Archivos**: `core/shell.ts`, `core/mount.ts` (nuevo),
`core/ui/sidePanels.ts` (nuevo), `render/svg/index.ts` (D-C2), tests en
`tests/core/`. `happy-dom` ya está (D-C3).

1. **Tests de los paneles, contra el código de hoy** (deben pasar antes de
   tocar nada; patrón de D-C3):
   - `tests/core/controls-panel.test.ts`: `createControlsPanel` con las specs
     del combustible sobre un `div`: un `input[type=range]` por slider, un
     checkbox por toggle y un grupo `.segmented` por select, **dentro del
     `div`**; un `input` en el slider emite `setParam` con número; `sync()`
     refleja `getValue`; `setVisible([])` oculta todos los ítems y sus
     `fieldset`.
   - `tests/core/faults-panel.test.ts`: lo mismo con `createFaultsPanel`
     (`setFault`; "Reparar todo" emite `resetFaults` y está deshabilitado
     cuando todas las fallas están sanas: `faults.ts:168`).
   - `tests/core/shell.test.ts` (shell real): `route({ kind: 'lab', id:
     'fuel' })` monta el SVG con `[data-part]`, y la sección "Controles"
     (`details` cuyo `summary` dice "Controles") tiene exactamente 4 inputs
     (3 sliders y 1 toggle; la llave es un grupo de botones) **[medido]**. **Contar
     dentro de esa sección, no en todo el `aside`**: el panel de fallas
     también tiene inputs y tapaba la regresión de `a23e1a9` (con el bug,
     el `aside` del combustible baja de 10 a 6 inputs, no a 0 **[medido]**).
     Clic en el botón "Marcha" → `window.__sim.model.params.ignitionKey ===
     'run'`. Clic en el botón con `title="Reiniciar"` → `model.time === 0`.
     `route({ kind: 'stage', id: 'fuel-quiz-1' })` → hay HUD y la sección
     Controles está oculta. `route(null)` → no hay `window.__sim` ni SVG.
2. **D-C2** en `render/svg/index.ts`: `HIGHLIGHT_LAYERS` (juego / `affected`),
   `highlight` limpia la capa del estilo que recibe. Los llamadores de hoy no
   cambian. Test en `shell.test.ts` (los dos casos de D-C2).
3. **Partir el shell** moviendo código, sin reescribirlo:
   - `core/shell.ts`: layout, tema, navegación, portada, `route`, y
     `mount`/`unmount` como orquestador (~200 líneas).
   - `core/mount.ts`: sesión, modo, renderer, `emit`, `applyEvents`, el
     ciclo de frame y su `destroy()` (~180). El ciclo de frame usa el
     `realDt` que entrega la sesión en vez de su propio `performance.now()`
     (hoy hay dos relojes; los intervalos de sync, chispas y narración pasan
     a contar con `realDt`).
   - `core/ui/sidePanels.ts`: `section()`, controles, presets, fallas,
     mediciones, ficha y el `applyUi` de los paneles (~120).
4. Los tests del paso 1 pasan igual antes y después del corte.

**Aceptación**: `npm run check` verde; borrar el `container.append(fs)` de
`createControlsPanel` hace fallar `controls-panel` y `shell` (probarlo y
anotarlo en el CERRADO); `shell.ts` ≤ ~300 líneas.
**Firefox**: un laboratorio y una etapa del quiz se ven y se usan igual.

### H1 — `affects` y resaltado de controles y de fallas

Cada control y cada falla declaran qué piezas tocan; mientras se los usa,
esas piezas se iluminan. Resaltar no escribe `params` ni `faults`, así que no
es un intent (§20): es estado de la vista.

1. **Tipos** (`core/types.ts`): `ControlSpec.affects?: readonly string[]`,
   `ControlSpec.disabledReason?: string`, `ControlSpec.hint?: string`,
   `FaultCatalogEntry.affects?: readonly string[]` (piezas donde se ve el
   síntoma, además de `part`).
2. **Paneles** (D-C9): `onFocus` se dispara con `pointerenter`/`focusin`
   (piezas) y `pointerleave`/`focusout` (`null`), salvo si hubo un
   `input`/`change` en los últimos 1,5 s: entonces el `null` se difiere hasta
   cumplirlos. El panel de fallas pasa la pieza dueña más sus `affects`
   (busca la entrada del catálogo por `modelKey === spec.key`; hay una
   entrada por clave **[medido]**). Ambos muestran `hint` y `disabledReason`
   como texto chico bajo el control y como `title`.
3. **Mount**: `onFocus` → `renderer.highlight(ids ?? [], 'affected')`.
4. **Renderer**: en `update`, `visual.faultCues` (ids §26, ya filtrados por
   activas y visibles en `presenter/present.ts`) → con `module.faultCatalog`,
   `.fault-cue` en la pieza dueña de cada cue; se quita cuando el cue sale.
   Cuando un id **entra** a `faultCues`, `.fault-pulse` 1,5 s en la dueña y
   sus `affects` (un `setTimeout` por cue, que `destroy` limpia).
5. **CSS** (`styles.css`): `.affected` anillo pulsante con `var(--accent)`;
   `.fault-cue` aro fijo con `var(--bad)`; `.fault-pulse` destello con
   `var(--bad)`. Los tres tokens existen en claro y oscuro **[medido]**, y
   deben distinguirse de `.selected` y `.target`.
6. **Datos de los 10 laboratorios**: `affects` en los 66 controles
   slider/toggle/select y en las entradas del catálogo (111) donde el
   síntoma se ve en otra pieza. Se decide **leyendo el controlador o la
   física** que usa el parámetro, no por el nombre (AGENTS.md, regla 2); sólo
   con ids dibujados (D-C8).
7. **Vehículo**: `scopedControls` prefija `affects`; un control compartido
   (`ignitionKey`, `throttle`, `rpm`, `vehicleSpeedKmh`) **une** los
   `affects` de todos los sistemas que lo traen (hoy se deduplica quedándose
   con la spec del primero: juntar antes de deduplicar); `four-stroke:*` →
   `four-stroke` (D-C8). `scopedFaultCatalog` hace lo mismo con `part` y
   `affects`.
8. **Tests**:
   - `tests/render/affects-dom.test.ts` (DOM, patrón de
     `parts-dom.test.ts`): en cada ruta, todo control slider/toggle/select
     tiene `affects` no vacío, o `[]` con `disabledReason`; cada id de
     `affects`, de `FaultCatalogEntry.part` y de sus `affects` tiene un
     `data-part` visible; en los vehículos, un control compartido toca piezas
     de cada sistema que lo declara.
   - `tests/presenter/present.test.ts`: con `revealedFaults: []` y una falla
     `visibility: 'never'` activa, `faultCues` no la trae.
   - DOM: `pointerenter` en el slider del acelerador del combustible →
     `.affected` en sus piezas, sin quitar `.selected`; `pointerleave` sin
     movimiento → se apaga; tras un `input`, sigue 1,5 s
     (`vi.useFakeTimers()`); activar `filterClog` → `.fault-cue` en
     `[data-part="filter"]`, y desaparece con "Reparar todo".

**Firefox** (cada laboratorio suelto, claro y oscuro): al arrastrar un slider
se ilumina la pieza correcta y se apaga ~1,5 s después de soltar; al pasar el
mouse por una falla se iluminan su pieza y sus síntomas; al activarla hay un
destello y queda un aro rojo fijo que desaparece al repararla; con una pieza
seleccionada, tocar un control no le quita la selección; en el quiz no hay
aros rojos.

### H2 — Controles con efecto lento, condicional o pisado

1. **Laboratorios** (D-C7): los `hint` de la tabla, y `disabledWhen` +
   `disabledReason` de `humidity`. Si R0 anotó otros controles "sin efecto",
   el mismo criterio: leer spec y controlador; si actúa, `hint`; si la spec
   dice que debería y no actúa, es un bug (test con rango, §14); si la spec
   no le da efecto, se quita el control y se anota en la spec.
2. **Vehículo** (D-C5): `VehicleDef.overridden` con la tabla de D-C5 y el
   cambio en `scopedControls`.
3. **Tests**: `tests/vehicle/controls-parity.test.ts` (D-C5). Con `hint`,
   ningún test nuevo: es texto.
4. CERRADO con lo decidido en cada control y su justificación.

**Firefox**: en `ignition-points`, `humidity` atenuado con su motivo hasta
fisurar la tapa; en refrigeración y lubricación, el texto bajo el control;
en los vehículos, los controles pisados atenuados con su motivo.

### R1 — Revisión de cierre de C1 (usuario, ~30 min)

La ronda de R0, punto 1, con H1 y H2: ¿se entiende qué hace cada control y
cada falla **sin leer la ficha**? Lo que salga se anota. Después: C2 o S2.

## 6. Después de C1

- **C2 — el vehículo se entiende**: V2 (regiones, cámara, atenuado, con
  `realDt` en el renderer, D-C1) y V3 (chasis y vista de conjunto), plan del
  09-29. La silueta de V3 ya está decidida (§8).
- **S2**: A17 (eléctrico) primero; le da dueño a la batería y cambia la
  tabla de D-C5 (el test de paridad lo va a avisar).

Recomendación: **C2 antes de S2** (el vehículo es la promesa del proyecto y
hoy no se lee).

## 7. Riesgos

- **`affects` mal elegidos** enseñan mal: por eso se decide leyendo el
  controlador, y R1 los mira todos.
- **El corte del shell rompe algo sin test** (tema, timebar): lo cubre la
  checklist de Firefox de U1; es mover código, no reescribirlo.
- **Tiempo de H1** (datos de 10 laboratorios): se puede cerrar por partes
  (combustible y encendido primero), con el test de `affects` limitado a
  los módulos ya hechos y una lista explícita de los que faltan.
- **Tiempo de la suite**: los tests de paridad del vehículo y los de DOM
  suman ~20 s; si `npm run check` se vuelve lento, se separan en un
  `npm run test:slow` que también corre en `check`.

## 8. Preguntas al usuario (todas respondidas)

- `happy-dom`: sí, como dependencia de desarrollo.
- Rama: se trabaja en la rama de la nube y se mergea a `main` por checkpoint
  (`AGENTS.md`, regla 8).
- Silueta del chasis para V3 (2026-10-05): **sedán para los 70 y compacto
  para 2000**, vistos desde arriba (`sedan70`, `compact00`).

## 9. Errores de la v1 que corrige la v2

1. **D-C2**: "cada estilo limpia el suyo" rompía el quiz (respuestas viejas
   quedaban marcadas). Ahora hay capas.
2. **D-C5**: el test contra `paramsView` habría exigido motivo para `rpm`,
   que sí actúa. Ahora la lista y el test salen de medir.
3. **Lista de H2**: `fuel:fastConsumption` no estaba pisado, era un bug (ya
   arreglado); faltaba `ignition:camOffset` en `vehicle-2000`.
4. **D-C8**: la v1 validaba `affects` contra `parts`; varias piezas con
   ficha no están dibujadas, y en el vehículo las sub-piezas no tenían
   prefijo (bug, ya arreglado). Ahora se valida en DOM.
5. **D-C9**: la v1 pedía que `destroy` limpiara los temporizadores de los
   paneles, pero los paneles no tienen `destroy`; y no decía cómo agregar
   `onFocus` sin romper la firma.
6. **U1**: "contar inputs" en todo el `aside` no detecta la regresión de
   `a23e1a9`; hay que contar en la sección Controles.
7. **D-C3**: la v1 temía que a `happy-dom` le faltaran `CSS.escape` o SVG;
   medido, no falta nada salvo reemplazar `requestAnimationFrame`.
