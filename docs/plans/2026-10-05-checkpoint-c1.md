# Plan — Checkpoint C1: los laboratorios se entienden

Fecha: 2026-10-05. Autor: agente planificador (a pedido del usuario: "un plan
detallado para seguir avanzando; ¿cuál es el siguiente checkpoint prudente?").
Se lee de arriba abajo. Para las tareas H1 y H2 **reemplaza** a las secciones
correspondientes de `plans/2026-09-29-legibilidad-y-foco.md`. V2 y V3 siguen
en ese plan, con los ajustes de §4 de este.

## 1. Dónde estamos (verificado hoy, no de memoria)

- `main` + la rama `claude/friendly-rubin-cpnaoh` (commit `2758c5c`):
  `npm run check` verde, 498 tests. El bloque S (A4–A16, A15) está cerrado:
  12 rutas (10 laboratorios sueltos y 2 vehículos).
- Esta sesión arregló: ⟲ que no reiniciaba del todo, el solver que no
  convergía al apagar la llave, el vehículo que ignoraba `initial`, el
  feedback del quiz con tiempo simulado (era **L0** del plan del 09-29), el
  acumulador del loop y el guardado (`AHORA.md`, CERRADO 2026-10-05).
- **Revisiones en Firefox pendientes** desde hace varias tareas: A14, V1,
  A16, A15, los dos FIX de flujo y ahora el CERRADO 2026-10-05.
- **La revisión del usuario del 2026-09-29 se hizo con el panel de controles
  vacío** (regresión de la migración a TS, arreglada en `a23e1a9`). El
  hallazgo "los sliders no dan feedback" se anotó cuando no había sliders en
  pantalla: hay que volver a mirarlo antes de diseñar más sobre él.
- Lo que el usuario vio y sigue sin resolver: el vehículo se ve diminuto
  (escala ~0,41 contra ~1,06 de un laboratorio suelto: cuenta en `AHORA.md`),
  no hay feedback de qué toca cada control, y el vehículo no parece un auto.
- Deuda que va a estorbar: `core/shell.ts` tiene 503 líneas (`mount()` sola
  son ~245), y **ningún test arma un panel de la UI** (por eso la regresión
  de `a23e1a9` llegó al usuario).

## 2. El siguiente checkpoint y por qué

**Checkpoint C1 = "los 10 laboratorios sueltos se entienden y están
revisados".** Se da por logrado cuando, en Firefox, en cada laboratorio
suelto:

1. al tocar un control se ilumina lo que modifica;
2. al tocar o activar una falla se ve dónde está y dónde se nota;
3. un control cuyo efecto es lento o condicional lo dice;
4. el usuario recorrió los 10 laboratorios y el quiz con la checklist, y lo
   que falló quedó anotado o arreglado.

Los vehículos quedan para **C2** (V2 cámara + V3 chasis).

**Por qué C1 y no otra cosa** (lo que se descartó y la razón):

- **Seguir con S2 (A17 eléctrico, A18 admisión…)**: descartado por ahora.
  Cada sistema nuevo agrega un laboratorio más que nadie revisó, y otro
  sistema a un vehículo que ya no se puede leer. Además, si H1 entra
  después, hay que volver a cada sistema nuevo a declarar `affects`. Con H1
  primero, cada plan de S2 lo trae de entrada (§4, D-C6).
- **Empezar por el vehículo (V2/V3)**: es lo que más se nota, pero es lo más
  grande y lo más riesgoso (capas del renderer, cámara, dibujo del chasis), y
  V3 espera respuestas del usuario (§7). Además se apoya en H1: la cámara se
  enfoca con el control que se toca (D4b del plan del 09-29). Hacerlo
  primero sería construir sobre dos cosas sin verificar.
- **C1** cubre los 10 laboratorios (donde el usuario aprende un sistema a la
  vez), es incremental, cada paso se verifica solo, y deja a C2 la base
  (`affects`, foco, resaltado) que necesita.

## 3. Definición de "hecho" de C1

- `npm run check` verde en cada tarea (§32), con su CERRADO en `AHORA.md`.
- Los 10 laboratorios: todo control slider/toggle/select declara `affects`
  (o `[]` con motivo), y toda entrada del catálogo de fallas apunta a piezas
  que existen (test, §10).
- El quiz (etapas 1 y 2) sigue jugable y una falla oculta no se delata
  (test).
- Hay tests que arman los paneles de la UI en un DOM de test (el de
  `a23e1a9` habría fallado).
- `core/shell.ts` por debajo de ~300 líneas (§16), sin cambio de conducta.
- El usuario hizo la revisión R1 (§5) y lo que salió quedó en `AHORA.md`.

## 4. Decisiones nuevas o que corrigen el plan del 09-29

**D-C1 — L0 queda cerrado; el `realDt` del renderer pasa a V2.**
Lo que pedía L0 para el quiz ya está hecho (`GameMode.update(simDt, realDt)`).
Lo que falta, `renderer.update(visual, simDt, realDt)`, sólo lo necesita la
cámara de V2: H1 anima con CSS (tiempo real del navegador) y mantiene el
resaltado con un temporizador del panel (capa DOM). Se agrega a V2. Las
partículas siguen con `simDt` (representan el caudal a la velocidad de la
simulación: con 0,05× deben ir lento).

**D-C2 — `renderer.highlight` limpia sólo el estilo que pone (corrige D2).**
Hoy `highlight(ids, style)` (`render/svg/index.ts`) borra **todos** los
estilos (`selected`, `correct`, `wrong`, `target`) antes de poner el suyo. Con
el plan del 09-29 tal cual, pasar el mouse por un control (`affected`)
borraría la pieza seleccionada y el `target` de la pregunta del quiz. Se
cambia a: `highlight(ids, style)` reemplaza sólo las piezas de **ese**
estilo. Los llamadores que hoy cuentan con el borrado total (`resetAll`, el
feedback del quiz) pasan a limpiar explícitamente lo suyo. Test en DOM.

**D-C3 — DOM de test: `happy-dom` como dependencia de desarrollo.**
§17 prohíbe dependencias de **runtime**; ésta es sólo de desarrollo, como
`vitest`. Se activa por archivo (`// @vitest-environment happy-dom`), así los
tests de simulación siguen en Node puro (§1) y a la misma velocidad. Se
elige `happy-dom` (20.x) y no `jsdom` (30.x) por liviano y rápido; si le
falta algo que el shell usa (`CSS.escape`, `requestAnimationFrame`,
`performance.now`, `localStorage`, SVG), se agrega un doble mínimo en el
setup del test y se anota en el CERRADO. **Pregunta al usuario (§7.1)**:
`package.json` es core (§12, §33).

**D-C4 — Partir `core/shell.ts` antes de H1, sin cambiar conducta.**
H1 le agrega foco y resaltado, y V2 la cámara: con 503 líneas, cada tarea lo
empeora. Se parte primero, con los tests de U1 como red (si un test de U1
pasa antes y después, el corte no rompió nada).

**D-C5 — En el vehículo, el motivo del control deshabilitado sale del
vehículo, no del laboratorio.**
`scopedControls` (`modules/vehicle/index.ts`) hoy **borra** `disabledWhen`
("nunca deshabilita en el vehículo"), así que H2 no puede usarlo tal cual.
Se agrega a `VehicleDef` una lista de claves que el vehículo pisa, con el
motivo (`overridden: { 'cooling:load': 'La calcula el motor (engine.load)'
… }`), y `scopedControls` la convierte en `disabledWhen: () => true` +
`disabledReason`. Un test cruza esa lista con `paramsView`
(`modules/vehicle/compile.ts`): toda clave que `paramsView` pisa (`rpm`,
`load`) y que algún sistema expone como control tiene motivo.

**D-C6 — Desde C1, todo plan de S2 trae `affects` y su catálogo con
`affects`.** El test de H1 recorre el registro, así que un laboratorio nuevo
sin `affects` no pasa `npm run check`. Las fichas de A17–A25 lo dicen.

**D-C7 — `vehicleSpeedKmh` e `ignition:humidity` se quedan (responde la
pregunta 3 del plan del 09-29 con evidencia).** No son controles muertos:
- `vehicleSpeedKmh` entra al aire del radiador (`modules/cooling.md` §5,
  `vehicleSpeedKmh/3,6 + aire_ventilador`; `cooling/controllers.ts:184`), pero
  el efecto es térmico y tarda minutos. La medición del 09-29 sólo corrió
  2 s simulados.
- `humidity` sólo actúa con la tapa del distribuidor fisurada
  (`ignition.md` §4, tabla de fallas: `capCracked·(0,3 + 0,7·humidity)`;
  `ignition/core.ts:310`). Sin esa falla no hace nada, como en un auto real.

Lo que falta es **decirlo**: `ControlSpec.hint?: string` ("Se nota en
minutos: activa «Calentamiento ×20»"; "Sólo importa con la tapa fisurada"),
que el panel muestra bajo el control. Con la tapa sana, `humidity` va
atenuado con ese motivo (`disabledWhen` en el laboratorio).

## 5. Tareas, en orden

`R0 → U1 → H1 → H2 → R1`. Un agente a la vez. Cada tarea de código cierra
con `npm run check`, CERRADO en `AHORA.md` y commit.

### R0 — Revisión del usuario en Firefox (sin código, ~45 min)

Antes de escribir más, mirar lo que ya existe con el panel de controles
arreglado. El agente no hace nada salvo anotar lo que el usuario diga en
`AHORA.md`, bajo "REVISIÓN EN FIREFOX", tal cual.

`npm run dev` y, en este orden:

1. **Los 10 laboratorios sueltos** (`#/lab/fuel`, `four-stroke-ohv`,
   `four-stroke-dohc`, `ignition-points`, `ignition-cop`, `cooling-viscous`,
   `cooling-electric`, `lubrication-gauge`, `lubrication-lamp`,
   `carburetor`). En cada uno:
   - ¿Aparecen todos los controles? Mover cada slider de punta a punta: ¿se
     ve **algún** cambio en el diagrama en ~2 s? Anotar los que no (sin
     juzgar todavía si es bug).
   - Llave a "Marcha" (donde haya llave), esperar, ⟲: ¿vuelve todo a como
     estaba al abrir?
   - Un caso de "Casos para probar": ¿la nota se entiende? ¿se ve el
     síntoma que la nota promete?
2. **El quiz**: las dos etapas, una vez a 1× y otra a 0,05×. A 0,05× la
   siguiente pregunta debe aparecer a ~1 s.
3. **La checklist del CERRADO 2026-10-05** (en `AHORA.md`).
4. **Los vehículos**, sólo para confirmar que siguen igual (todavía no se
   arreglan; es C2).

Salida: una lista en `AHORA.md`. **Si R0 encuentra un bug de física o de
dibujo en un laboratorio, se arregla antes de U1**, con su test, como una
tarea FIX aparte (no se mezcla con H1).

### U1 — Tests de UI en DOM y `shell.ts` partido (core, sin cambio visible)

**Archivos**: `package.json` (devDependency `happy-dom`), `vite.config.ts`
(nada que cambiar si se usa el comentario por archivo), `core/shell.ts`,
dos archivos nuevos en `core/`, `render/svg/index.ts` (D-C2), tests nuevos en
`tests/core/`.

Pasos:

1. `npm i -D happy-dom` (versión fija en `package.json`). `knip` debe seguir
   verde.
2. **Tests de los paneles primero, contra el código de hoy** (deben pasar
   antes de tocar nada):
   - `tests/core/controls-panel.test.ts`: `createControlsPanel` con las specs
     del combustible → hay un `input` por slider/toggle y un grupo de botones
     por select, **dentro del contenedor** (el test que faltó en
     `a23e1a9`); disparar `input` en un slider emite `setParam` con el valor
     numérico; `sync()` refleja `params`; `setVisible([])` oculta todo y los
     `fieldset` vacíos.
   - `tests/core/faults-panel.test.ts`: lo mismo para `createFaultsPanel`
     (`setFault`, "Reparar todo" emite `resetFaults` y se habilita sólo con
     alguna falla activa).
   - `tests/core/shell.test.ts`: `createShell` sobre un `div`; `route` a
     `lab/fuel` monta el SVG con piezas `[data-part]`, el panel de controles
     con inputs y la barra de tiempo; mover la llave por el DOM cambia
     `window.__sim.model.params.ignitionKey`; ⟲ deja el modelo con
     `time === 0`; `route` a la portada desmonta (sin `window.__sim`, sin
     SVG). Ruta de una etapa del quiz: el HUD aparece y los controles no.
     `session` en `driver: 'external'` no aplica acá (el shell crea la
     sesión): se usa un `requestAnimationFrame` falso que no avanza solo, y
     el test avanza con `window.__sim.session.tick(dt)`.
3. **D-C2**: `highlight(ids, style)` limpia sólo `style`. Revisar cada
   llamada (`grep -n "highlight(" src`) y hacer explícita la limpieza que
   hoy es implícita. Test en `shell.test.ts`: con una pieza seleccionada,
   `highlight(['x'], 'target')` no le quita `.selected`.
4. **Partir el shell** (D-C4), moviendo código sin reescribirlo:
   - `core/shell.ts`: layout, tema, navegación, portada, `route`, `mount`/
     `unmount` como orquestador (~200 líneas).
   - `core/mount.ts` (nuevo): `mountTarget(ctx)` = sesión, modo, renderer,
     `emit`, `applyEvents`, el ciclo de frame, y `destroy()` (~180).
   - `core/ui/sidePanels.ts` (nuevo): las secciones (`section()`),
     controles, presets, fallas, mediciones, ficha y `applyUi` de paneles
     (~120).
   - De paso, el ciclo de frame usa el `realDt` que ya entrega la sesión en
     vez de recalcularlo con `performance.now()` (hoy hay dos relojes).
5. Los tests del paso 2 pasan **igual** antes y después del corte.

**Aceptación**: `npm run check` verde; los tests de U1 fallan si se borra
el `container.append(fs)` de `createControlsPanel` (probarlo y anotarlo en el
CERRADO); `shell.ts` ≤ ~300 líneas.
**Firefox**: un laboratorio y una etapa del quiz se ven y se usan igual que
antes (es un refactor).

### H1 — `affects` y resaltado de controles y de fallas

Retoma D1, D1b y D2 del plan del 09-29 (cada control y cada falla declara
qué piezas toca; resaltar no es un intent porque no escribe nada) con las
correcciones de §4. **Todo lo que hace falta está acá**; no hace falta leer
el plan del 09-29 para esta tarea.

1. **Tipos** (`core/types.ts`): `ControlSpec.affects?: readonly string[]`,
   `ControlSpec.disabledReason?: string`, `ControlSpec.hint?: string`
   (D-C7), `FaultCatalogEntry.affects?: readonly string[]`.
2. **Paneles** (`core/ui/controls.ts`, `core/ui/faults.ts`): opción
   `onFocus(partIds: readonly string[] | null)`. Disparo: `pointerenter`/
   `focusin` → piezas; `pointerleave`/`focusout` → `null`, salvo que haya
   habido un `input`/`change` en los últimos 1,5 s: entonces el `null` se
   difiere hasta cumplirlos (un temporizador por panel, que `destroy`
   limpia). Muestran `disabledReason` y `hint` como texto chico bajo el
   control y como `title`.
3. **Shell/mount**: `onFocus` → `renderer.highlight(ids ?? [], 'affected')`
   (gracias a D-C2 no toca `selected` ni `target`). Fallas: además, la pieza
   dueña.
4. **Renderer**: `affected` y `fault-cue` en los estilos. `update` lee
   `visual.faultCues` (ids §26) y, con `module.faultCatalog`, pone
   `.fault-cue` en la pieza dueña de cada uno y la quita cuando el cue
   desaparece. Pulso de activación: cuando un id entra a `faultCues`, se pone
   `.affected` a la dueña y a sus `affects` durante 1,5 s (temporizador del
   renderer; tiempo real, no `simDt`).
5. **CSS** (`styles.css`): `.affected` = anillo con `var(--accent)` y
   animación CSS de pulso; `.fault-cue` = aro fijo con `var(--bad)`. Los dos
   visibles en tema claro y oscuro, y distintos de `.selected` y `.target`.
6. **Datos, los 10 laboratorios**: `affects` en los 66 controles
   slider/toggle/select (5–10 por laboratorio) y `affects` de síntomas en
   las entradas del catálogo donde el síntoma se ve en otra pieza (111
   fallas en total; muchas no lo necesitan). Cada `affects` se decide
   **leyendo el controlador o la física** que usa el parámetro, no por el
   nombre (AGENTS.md, regla 2): si `throttle` cambia `pMan` y el ancho de
   pulso, afecta a la mariposa, al múltiple y a los inyectores.
7. **Vehículo**: `scopedControls` antepone el prefijo a cada `affects`; un
   control compartido (`ignitionKey`, `throttle`, `rpm`, `vehicleSpeedKmh`)
   une los `affects` de **todos** los sistemas que lo declaran, cada uno con
   su prefijo. Ojo: hoy `scopedControls` deduplica un control compartido
   quedándose con la spec del **primer** sistema que lo trae; hay que juntar
   los `affects` de todos antes de deduplicar. `scopedFaultCatalog` prefija
   `affects` igual que `part`.
8. **Tests**:
   - `tests/core/affects.test.ts` (Node): para cada módulo del registro, todo
     control slider/toggle/select tiene `affects` no vacío, o `[]` junto con
     `disabledReason`; cada id está en `parts` (§10); lo mismo para
     `FaultCatalogEntry.part` y `affects`; en los vehículos, un control
     compartido afecta a piezas de cada sistema que lo usa.
   - `tests/presenter/present.test.ts`: con una política que oculta una falla,
     `faultCues` no la trae (la falla oculta del juego no se delata).
   - En DOM (U1): `pointerenter` en el slider del acelerador pone
     `.affected` en sus piezas y no quita `.selected`; al salir sin haber
     movido nada, se apaga; tras un `input`, sigue 1,5 s (temporizadores
     falsos de vitest).

**Firefox** (cada laboratorio suelto, tema claro y oscuro): al arrastrar un
slider se ilumina la pieza correcta y se apaga ~1,5 s después de soltar; al
pasar el mouse por una falla del panel se iluminan su pieza y sus síntomas;
al activarla hay un pulso y queda un aro rojo fijo en la pieza rota, que
desaparece al repararla; con una pieza seleccionada, tocar un control no le
quita la selección; en el quiz no aparece ningún aro rojo.

### H2 — Controles con efecto lento, condicional o pisado

1. **Laboratorios** (D-C7): `hint` en `vehicleSpeedKmh` y `ambientC`
   (refrigeración: efecto térmico lento), `humidity` (sólo con
   `capCracked > 0`: además `disabledWhen` + `disabledReason` en
   `ignition-points`). Revisar el resto de la lista de R0 con el mismo
   criterio: leer la spec y el controlador; si actúa, `hint`; si no actúa y
   la spec dice que debería, es un bug: se arregla con un test con rango
   (§14); si la spec no le da efecto, se quita el control y se anota en la
   spec.
2. **Vehículo** (D-C5): `VehicleDef.overridden` con motivo para
   `cooling:load`, `ignition:compression`, `fuel:fastConsumption`, y en
   `vehicle-2000` `ignition:batteryV` y `cooling:batteryV` (batería fundida:
   "La batería es la del sistema eléctrico del auto"). Antes de escribir la
   lista, confirmarla leyendo `paramsView` y el `buses[].provider` de cada
   `VehicleDef`, no copiándola de `AHORA.md`.
3. **Tests**: el de D-C5 (toda clave pisada por `paramsView` que aparece como
   control tiene motivo) y, en `affects.test.ts`, que un control con
   `disabledReason` en el vehículo tenga `affects: []`.
4. CERRADO con qué se decidió en cada control y la cuenta o la línea de la
   spec que lo justifica.

**Firefox**: en `ignition-points`, `humidity` atenuado con su motivo hasta
que se fisura la tapa; en refrigeración, el texto bajo la velocidad; en los
vehículos, los controles pisados se ven atenuados con su motivo.

### R1 — Revisión de cierre de C1 (usuario, ~30 min)

La misma ronda de R0, punto 1, ahora con H1 y H2. Se mira sobre todo: ¿se
entiende qué hace cada control y cada falla **sin leer la ficha**? Lo que
salga se anota. Con eso C1 está hecho y se decide C2 o S2 (§6).

## 6. Después de C1

- **C2 — el vehículo se entiende**: V2 (regiones, cámara, atenuado; ahora
  con el `realDt` del renderer, D-C1) y V3 (chasis y vista de conjunto),
  del plan del 09-29. V3 necesita las respuestas de §7.2.
- **S2 — resto del auto**: A17 (eléctrico) primero, porque saca el stub de
  `electrical.crankVoltage` y la batería fundida pasa a tener dueño.

Recomendación: **C2 antes de S2**. El vehículo es la promesa del proyecto
(`NORTE.md`) y hoy no se puede leer. Meterle nueve sistemas más antes de
arreglarlo agranda el problema. Pero si el usuario prefiere aprender
sistema por sistema por un tiempo, S2 sobre laboratorios sueltos (con
`affects` desde el día uno) también es un camino sano.

## 7. Preguntas para el usuario

1. ¿Se acepta `happy-dom` como dependencia **de desarrollo** para los tests
   de UI (D-C3)? Sin ella, U1 se reduce a tests de lógica pura y el shell se
   parte sin red.
2. (Del plan del 09-29, sigue abierta; sólo bloquea V3.) ¿Sedán para los 70
   y compacto para 2000, o prefieres otra silueta?
3. ¿Seguimos trabajando en la rama `claude/friendly-rubin-cpnaoh` con PR a
   `main` por checkpoint (pediste seguir en la rama; `AGENTS.md` regla 8
   dice "todo en `main`")? Si es así, conviene cambiar esa regla para que
   el próximo agente no la contradiga.

## 8. Riesgos

- **`affects` mal elegidos** (iluminar la pieza equivocada enseña mal). Por
  eso el paso 6 de H1 exige leer el controlador, y R1 los mira todos.
- **`happy-dom` incompleto** para el shell (SVG, `CSS.escape`): dobles
  mínimos en el setup, anotados. Si son demasiados, los tests de shell se
  reducen a montar y desmontar, y los de paneles quedan completos.
- **El corte del shell rompe algo que los tests no cubren** (tema, timebar):
  la checklist de Firefox de U1 lo cubre; el corte es mover código, no
  reescribirlo.
- **Tiempo**: H1 es la tarea grande (datos de 10 laboratorios). Si se
  alarga, se cierra por partes (combustible + encendido primero) con un
  CERRADO por parte, sin dejar el test de `affects` en rojo: se marca qué
  módulos ya están obligados a cumplirlo.
