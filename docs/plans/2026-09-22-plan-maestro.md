# Plan maestro: Simulador didáctico de motor por componentes (`car-rune-factory`)

> Este documento es la **especificación de referencia** para varios agentes que construirán el proyecto en paralelo.
> **Primer paso al salir del modo plan (T0-a):** guardar este archivo textual en `docs/plans/2026-09-22-plan-maestro.md` y crear los docs de arquitectura y reglas (sección 3.1), siguiendo el patrón de los otros proyectos de `uneven/` (`golden-sun-godot`, `whispers-of-freedom`, `breath-of-freedom`). Todos los agentes leen esos docs; este plan queda como registro histórico en `docs/plans/`.

---

## 1. Contexto

El usuario quiere entender cómo funciona un auto aislando cada sistema del motor en simulaciones pequeñas y visuales. Por ejemplo: una caja que es el estanque, una bomba que mueve la bencina, y ver por dónde va y hacia dónde.

`/home/francisco/Programming/uneven/car-rune-factory` está **vacío** y **no es repo git**. Se parte de cero.

### Decisiones cerradas (no volver a discutirlas)
| Tema | Decisión |
|---|---|
| Visual | 2D esquemático en **SVG**, estilo diagrama técnico, con partículas de fluido |
| Stack | **JavaScript puro (ES modules) + Vite** (solo dev server/build) + **Vitest**. Sin framework, sin librerías de runtime |
| Interacción | Controles (sliders, toggles, botones) + **fallas provocables** + **explicaciones** por pieza + **valores en vivo** con historial |
| Física | Aproximada pero coherente, **unidades reales** (bar, L/h, V, A, RPM, °C) |
| Módulos | Aislados, con un contrato común que permita un "motor completo" en el futuro |
| Idioma | Textos de la UI en **español**. Identificadores del código en inglés. Comentarios en español |
| Orden | 1) Combustible (inyección con retorno) → 2) Ciclo 4 tiempos → 3) Encendido → 4a) Refrigeración → 4b) Lubricación |

---

## 2. Convenciones de código (obligatorias para todos los agentes)

- ES modules, `const`/`let`, funciones factory (`createX()`) en vez de clases. Indentación de 2 espacios, comillas simples, punto y coma.
- **Tipos con JSDoc** (`@typedef` en `src/core/types.js`). No se usa TypeScript.
- **Modelos puros**: sin DOM, sin `Date`, sin `Math.random` (usar `core/rng.js` con semilla), sin `requestAnimationFrame`. Deben ser deterministas.
- El **estado se muta en su lugar** (por rendimiento). La vista **nunca** escribe en `state`. La UI escribe **solo** en `params` y `faults`, salvo las acciones explícitas (botón "Rellenar estanque" llama a `model.actions.refill()`).
- Unidades en el nombre solo cuando hay ambigüedad. La tabla de unidades de cada módulo (sección 6+) es la fuente de verdad.
- Presiones en **bar relativos (manométricos)** salvo que se diga lo contrario. Caudales en **L/h**. Tiempo en **s**.
- Nada de `innerHTML` con datos dinámicos; usar los helpers de `core/svg.js` / `core/dom.js`.
- Cada módulo vive **solo** en `src/modules/<id>/` y `tests/<id>/`. Un agente de módulo **no toca `src/core/`**. Si necesita algo del core, lo anota en `docs/core-requests.md` y lo resuelve el agente dueño del core.

---

## 3. Estructura del repositorio

```
car-rune-factory/
  AGENTS.md                    # reglas para cualquier agente (ver 3.1)
  docs/
    README.md                  # cómo están organizados los docs
    NORTE.md                   # visión (≤200 líneas)
    ARCHITECTURE.md            # leyes §1-§N + pipeline (≤200 líneas); el código las cita por §
    AHORA.md                   # bitácora de trabajo viva (≤500 líneas); lo cerrado se recorta, queda en git
    SISTEMAS.md                # catálogo de sistemas del auto → módulo, estado ✅/⏳
    CONTRATOS.md               # sección 4 de este plan, textual (detalle técnico de los contratos)
    plans/
      2026-09-22-plan-maestro.md   # este plan, tal cual
    modules/fuel.md            # sección 6
    modules/four-stroke.md     # sección 7
    modules/ignition.md        # sección 8
    modules/cooling.md         # sección 9
    modules/lubrication.md     # sección 10
    core-requests.md           # pedidos de módulos al core (vacío al inicio)
  index.html
  package.json                 # scripts: dev, build, preview, test
  vite.config.js               # vitest: environment 'node' por defecto
  src/
    main.js                    # arranque: registry + router + shell
    styles.css                 # tokens y layout (sección 5.3)
    core/
      types.js                 # typedefs JSDoc de los contratos
      rng.js                   # mulberry32(seed)
      math.js                  # clamp, lerp, smoothstep, approach, wrapDeg
      loop.js                  # bucle a paso fijo
      history.js               # ring buffer para las series de las lecturas
      svg.js                   # helpers SVG
      dom.js                   # helpers DOM (h(tag, attrs, children))
      particles.js             # partículas que recorren paths
      router.js                # router por hash
      shell.js                 # monta/desmonta un módulo en el layout
      ui/controls.js
      ui/faults.js
      ui/readouts.js           # indicadores numéricos, manómetros y sparklines
      ui/infoPanel.js          # ficha de la pieza + narración "¿qué está pasando?"
      ui/timebar.js            # pausa, velocidad, reiniciar
    modules/
      registry.js              # lista ordenada de descriptores de módulos
      fuel/{index.js, model.js, view.js, content.js, narrate.js}
      four-stroke/...          # misma forma
      ignition/...
      cooling/...
      lubrication/...
  tests/
    core/*.test.js
    fuel/model.test.js
    ...
```

### 3.1 Contenido de los docs vivos (T0-a)

**`AGENTS.md`** (mismo tono que `golden-sun-godot/AGENTS.md`):
1. Lee `docs/ARCHITECTURE.md` primero, siempre, antes de tocar código. Después, `docs/AHORA.md` y el `docs/modules/<id>.md` de tu tarea.
2. No asumas qué hace el código por su nombre: lee la lógica real.
3. El usuario se puede equivocar: corrígelo con evidencia. En física, también: si una constante no cuadra, se dice.
4. El checkpoint se mira funcionando (§13): tests en verde no prueban que la simulación se entienda. Abre la página en el navegador y mírala antes de cerrar.
5. Cada plan nuevo se guarda en `docs/plans/AAAA-MM-DD-<tema>.md` antes de implementarlo.
6. Toca solo los archivos de tu tarea (§12). Lo que el core no te da se pide en `docs/core-requests.md`.

**`docs/README.md`**: explica qué es vivo y manda (NORTE / ARCHITECTURE / AHORA / SISTEMAS / CONTRATOS / modules), qué es registro histórico (`plans/`) y que, ante una contradicción, manda lo vivo.

**`docs/NORTE.md`**: qué es el proyecto (laboratorio didáctico personal para entender el motor de un auto sistema por sistema), sus pilares y qué **no** es:
- Pilares:
  1. Aislar un sistema.
  2. Ver el flujo (fluido, electricidad, calor).
  3. Tocar controles.
  4. Romper cosas (fallas) y ver síntomas.
  5. Números reales.
  6. Explicación en español.
- Qué no es: no es un juego de manejo, no es 3D, no busca exactitud CFD, no es multiusuario.
- Orden de módulos con estado.

**`docs/ARCHITECTURE.md` — leyes** (redactadas a partir de las secciones 2 y 4):
- **§1** Modelo ⟂ vista ⟂ UI. El modelo es JS puro: sin DOM, sin `Date`, sin `Math.random`, sin rAF.
- **§2** Único escritor. `state` lo escribe solo `model.step`/`actions`. `params`/`faults` los escriben solo los controles de la UI (y los tests). La vista solo lee.
- **§3** Determinismo: aleatoriedad solo vía `core/rng.js` con semilla. Misma secuencia de entradas ⇒ mismo estado.
- **§4** Paso fijo: la física avanza con `fixedDt = 1 ms`, independiente del framerate. `timeScale` solo cambia cuántos pasos se dan por frame.
- **§5** Unidades reales y explícitas: bar relativos, L/h, V, A, rpm, °C, s. La tabla de estado de cada módulo es la fuente de verdad.
- **§6** Robustez numérica: `step` nunca produce `NaN`/`Infinity`. Todo se limita con `clamp`, y un test de fuzz lo fija.
- **§7** Estados excluyentes son un string enum (`engineState`), nunca varios booleanos.
- **§8** La UI es declarativa: controles, fallas, lecturas y piezas se describen como datos en el descriptor. El core los renderiza, y ningún módulo crea sus propios paneles.
- **§9** La vista dibuja la geometría una vez y en `update` solo muta atributos. Colores solo por variables CSS.
- **§10** Toda pieza clickeable tiene `data-part` con un `partId` que existe en `parts`.
- **§11** Aislamiento de módulos: ningún modelo lee a otro. La integración futura se hace copiando señales entre `state` y `params` desde un orquestador.
- **§12** Propiedad de archivos: un módulo vive en `src/modules/<id>/` y `tests/<id>/`. El core solo se toca en tareas de core.
- **§13** Checkpoint = verificado en el navegador (capturas/checklist), no solo con tests en verde.
- **§14** Los números de física los respalda un test. Si un rango no cuadra, se ajustan las constantes (no el test) y se documenta en `docs/modules/<id>.md`.
- **§15** Comentarios solo para invariantes no obvias, máximo 3 líneas. El porqué largo va a `docs/`.
- **§16** Unas ~300 líneas por archivo es señal de dividir.
- **§17** Sin dependencias de runtime. Solo `vite` y `vitest` como devDependencies.
- **§18** Textos de la UI en español. Identificadores en inglés.

Además: una sección **Pipeline** con el diagrama `input UI → params/faults → loop (step × N) → state → view.update / readouts / narrate`.

**`docs/AHORA.md`**: arranca con "EN CURSO — Fase 1: combustible" y la tabla de tareas T0–T6 con su estado. Cada tarea cerrada agrega un bloque "CERRADO AAAA-MM-DD — …" con lo verificado (como en golden-sun).

**`docs/SISTEMAS.md`**: catálogo de sistemas del auto → módulo → piezas → estado (✅/⏳/💭). Incluye los futuros no priorizados: transmisión/embrague, frenos hidráulicos, carga (alternador), escape/catalizador, turbo, diésel common-rail.

---

## 4. Contratos (el corazón del plan)

### 4.1 Descriptor de módulo — `src/modules/<id>/index.js`
```js
/** @type {import('../../core/types.js').ModuleDescriptor} */
export default {
  id: 'fuel',                          // coincide con la carpeta y la ruta #/fuel
  title: 'Sistema de combustible',
  summary: 'Cómo llega la bencina desde el estanque a los inyectores.',
  order: 1,
  viewBox: [0, 0, 1200, 700],          // sistema de coordenadas del SVG del escenario
  createModel,                          // () => Model
  createView,                           // (ctx: ViewContext) => View
  controls,                             // ControlSpec[]
  faults,                               // FaultSpec[]
  readouts,                             // ReadoutSpec[]
  parts,                                // Record<partId, PartInfo>
  narrate,                              // (model) => Narration[]
  presets,                              // Preset[] (opcional): escenarios guiados
};
```

### 4.2 Modelo
```js
/**
 * @typedef {Object} Model
 * @property {Object} params    // lo que controla el usuario; lo escriben los controles
 * @property {Object} faults    // fallas: boolean | number 0..1 | string enum
 * @property {Object} state     // observable, solo lectura fuera del modelo
 * @property {(dt:number)=>void} step   // avanza dt segundos de tiempo simulado; estable con dt ≤ 0.002
 * @property {()=>void} reset            // vuelve a los DEFAULT_* y al estado inicial
 * @property {Record<string, ()=>void>} actions // acciones puntuales (p. ej. refill, crankOnce)
 * @property {number} time               // tiempo simulado acumulado (s)
 */
```
- Cada `model.js` exporta `DEFAULT_PARAMS`, `DEFAULT_FAULTS` y `createXModel(overrides = {})`.
- `step` debe tolerar cualquier combinación de params/faults sin producir `NaN` ni `Infinity`. Se limita todo con `clamp`.

### 4.3 Vista — `createView(ctx)`
```js
/**
 * @typedef {Object} ViewContext
 * @property {SVGSVGElement} svg          // ya creado por el shell con el viewBox del módulo
 * @property {Model} model
 * @property {(partId:string)=>void} selectPart   // la vista la llama cuando se hace clic en una pieza
 *
 * @typedef {Object} View
 * @property {(realDt:number)=>void} update // se llama en cada frame; lee model.state; realDt en s reales × timeScale
 * @property {(partId:string|null)=>void} highlight
 * @property {()=>void} destroy
 */
```
- Todo elemento clickeable lleva `data-part="<partId>"`. Los `partId` deben existir en `parts`.
- La vista dibuja la geometría **una sola vez** en `createView`. En `update` solo cambia atributos (transform, fill, opacity, puntos de partículas).
- Colores **solo vía variables CSS** (`var(--fuel)` etc.) para que funcione el tema oscuro.

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

// PartInfo (content.js)
{ name: 'Bomba eléctrica', what: '¿Qué es?', why: '¿Para qué sirve?', how: '¿Cómo funciona?',
  failures: ['Síntoma → causa', ...] }

// Narration (narrate.js): reglas evaluadas cada ~250 ms
{ level: 'info' | 'warn' | 'bad', text: 'La presión cae con carga: el filtro está restringiendo el paso.' }

// Preset (opcional): escenario guiado
{ id: 'clogged', label: 'Caso: tironea en subida', params: {...}, faults: {...}, note: 'Observa el manómetro al acelerar.' }
```

### 4.5 Bucle — `core/loop.js`
```js
createLoop({ model, fixedDt = 0.001, maxStepsPerFrame = 4000, onFrame })
// → { start(), stop(), setTimeScale(x), setPaused(b), get timeScale, get paused, destroy() }
```
- En cada frame: `realDt = min(ahora - antes, 0.1)`. Luego `acc += realDt * timeScale`. Mientras `acc ≥ fixedDt` (y sin pasar `maxStepsPerFrame`) se llama `model.step(fixedDt)`. Al final, `onFrame(realDt * timeScale)`.
- `timeScale` va de 0.01 a 4, con valores predefinidos: 0.01, 0.05, 0.25, 1, 2, 4. La cámara lenta es clave para ver los inyectores y el ciclo de 4 tiempos.
- El registro de historial (`history.js`) toma muestras de las lecturas con `history: true` cada 50 ms de tiempo simulado. Guarda los últimos 400 puntos.

### 4.6 Partículas — `core/particles.js`
```js
createFlow({ path /* SVGPathElement */, layer /* SVGGElement */, spacing = 14, radius = 3, className = 'p-fuel' })
// → { setSpeed(pxPerSec /* puede ser negativo */), setStyle(className), setDensity(0..1), update(dt), destroy() }
```
- Las partículas están distribuidas a lo largo del path (`getTotalLength`/`getPointAtLength`) y avanzan con `speed·dt`. La densidad visible = `density` (se ocultan partículas). Así se ven tramos vacíos o con aire.
- Convención visual: **velocidad ∝ caudal**, con escala `PX_PER_LH = 2.5` (100 L/h → 250 px/s). Cada módulo puede cambiar la escala.
- `className` permite `p-fuel`, `p-air` (burbuja hueca), `p-coolant`, `p-oil`, `p-mixture`, `p-exhaust`, `p-electric`.

### 4.7 Helpers SVG — `core/svg.js`
`el(tag, attrs, parent)`, `group(parent, attrs)`, `pipe(parent, points, { width, className })` (devuelve `{ outer, inner, path }`, con esquinas redondeadas y un path central utilizable por `createFlow`), `box(parent, { x, y, w, h, r, label, part })`, `label(parent, x, y, text, opts)`, `arrowMarkers(svg)`, `gaugeSvg(parent, opts)` (manómetro con aguja: `{ setValue(v) }`).

### 4.8 Router / shell
- Ruta `#/<id>`. Si está vacía, se muestra la portada con tarjetas de todos los módulos del `registry`.
- `shell.mount(descriptor)`: crea el SVG, el modelo, la vista, el loop y los paneles. Cablea `selectPart` → `infoPanel.show(parts[id])` y `view.highlight(id)`. `shell.unmount()` destruye todo sin dejar listeners.

---

## 5. Shell de la UI

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

---

## 6. Módulo 1 — Sistema de combustible (inyección con retorno) — **especificación completa**

### 6.1 Piezas (`partId`)
`battery`, `key`, `relay`, `tank`, `strainer` (colador de la bomba), `pump`, `checkValve`, `feedLine`, `filter`, `rail`, `injector1..injector4`, `manifold`, `regulator`, `vacuumHose`, `returnLine`, `ecu` (bloque simple que manda los pulsos a los inyectores).

### 6.2 Parámetros (`DEFAULT_PARAMS`)
| key | tipo/rango | default | significado |
|---|---|---|---|
| `ignitionKey` | `'off' \| 'on' \| 'start' \| 'run'` | `'off'` | `on` = contacto (cebado 2 s); `start` = arranque; `run` = motor en marcha |
| `rpm` | 0–6500 | 800 | RPM pedidas (si el motor está detenido se ignoran) |
| `throttle` | 0–1 | 0 | acelerador → carga y vacío |
| `batteryV` | 10–14.5 | 12.6 | tensión de batería (con el motor en marcha se suma +1.4 V del alternador) |
| `fastConsumption` | bool | false | multiplica ×100 el consumo del estanque para ver el nivel bajar |

Acciones: `refill()` (estanque a 45 L), `setTank(L)`.

### 6.3 Fallas (`DEFAULT_FAULTS`, todas "sano" por defecto)
| key | tipo | efecto en el modelo |
|---|---|---|
| `strainerClog` | 0–1 | `kStrainer *= 1 + 150·s` |
| `filterClog` | 0–1 | `kFilter *= 1 + 1000·s` |
| `pumpWear` | 0–1 | `Qmax *= 1 − 0.7·s`, `Pmax *= 1 − 0.5·s` |
| `relay` | `'ok' \| 'intermittent' \| 'dead'` | `intermittent`: se corta 0.3 s a intervalos pseudoaleatorios (rng con semilla, en promedio cada 2 s); `dead`: nunca cierra |
| `regulator` | `'ok' \| 'stuckOpen' \| 'stuckClosed'` | `stuckOpen`: setpoint 0.8 bar; `stuckClosed`: sin retorno |
| `vacuumHoseOff` | bool | la referencia del regulador pasa a 0 bar (atmósfera) |
| `injectorLeak` | 0–1 | el inyector 2 gotea `0.6·s·√pRail` L/h continuamente hacia el múltiple |
| `lineLeak` | 0–1 | fuga en la línea de alimentación: `2.0·s·√pRail` L/h (se dibuja goteo) |

### 6.4 Física (paso `dt`, orden de evaluación)
Constantes: `Qmax0 = 120 L/h` (a 13.5 V, caudal libre), `Pmax0 = 6.5 bar` (cierre total a 13.5 V), `kStrainer0 = 4e-6`, `kLine0 = 3e-6`, `kFilter0 = 1e-5` (bar/(L/h)²), `C = 0.005 L/bar` (compliancia del riel + mangueras), `kReg = 1000 L/h/bar`, `regSet = 3.0 bar`, `injFlow3bar = 12 L/h` por inyector, `tankCapacity = 50 L`, `pickupLow = 1.0 L`.

1. **Estado del motor y del relé**
   - `off`: relé abierto, `engineState='off'`.
   - Transición a `on`: `primeTimer = 2 s`. El relé queda cerrado mientras `primeTimer > 0`.
   - `start`: relé cerrado. Motor girando a 250 rpm. Pasa a `running` si la mezcla es suficiente (`mixtureRatio ≥ 0.6`) durante 0.5 s acumulados.
   - `run`: relé cerrado solo si `engineState` es `running` o `misfire`. Si el motor está `stalled`, el relé se abre (la ECU corta la bomba sin rpm) y el usuario tiene que volver a `start`.
   - `rpmEff = engineState ∈ {running, misfire} ? params.rpm : (cranking ? 250 : 0)`.
   - Aplicar la falla `relay`.
2. **Tensión de la bomba**: `V = batteryV + (running ? 1.4 : 0) − (cranking ? 2.0 : 0)`, y `vf = clamp(V / 13.5, 0, 1.1)`.
3. **Aire en la aspiración**: `pickupAir = 1 − clamp(tankLevel / pickupLow, 0, 1)`. El caudal efectivo se multiplica por `(1 − pickupAir)`.
4. **Caudal de la bomba (cerrado, sin iterar)**, con `K = kStrainer + kLine + kFilter`, `Qm = Qmax·vf`, `Pm = Pmax·vf`:
   - `c = Qm·(1 − pRail/Pm)`. Si `c ≤ 0` o el relé está abierto → `qPump = 0` (la válvula check impide el retroceso).
   - Si no: `a = Qm·K/Pm`, `qPump = (−1 + √(1 + 4ac)) / (2a)`, y luego `qPump *= (1 − pickupAir)`.
   - `pPumpOut = pRail + K·qPump²` y `dpFilter = kFilter·qPump²`.
   - `pumpCurrent = relé ? (1.5 + 5.5·pPumpOut/Pm)·vf : 0` (A).
5. **Vacío del múltiple**: `pMan = motorGirando ? −0.65 + 0.65·throttle : 0` (bar relativos; ralentí ≈ −0.65, a fondo ≈ 0). `pRef = vacuumHoseOff ? 0 : pMan`.
6. **Regulador**: `set = regulator==='stuckOpen' ? 0.8 : regSet`. `qReturn = regulator==='stuckClosed' ? 0 : kReg·max(0, pRail − (pRef + set))`. `regOpen = clamp(qReturn / 100, 0, 1)` (para la animación del diafragma).
7. **Inyectores** (secuenciales, orden de encendido 1-3-4-2, desfase 0/180/360/540°):
   - `crankAngle += rpmEff/60·360·dt` (mod 720).
   - Ancho de pulso pedido: `pw = 1.8 ms + 10.5 ms·throttle` (+3 ms enriquecimiento si está en arranque).
   - `pwDeg = pw·rpmEff/60·360/1000`. El inyector `i` está abierto si `(crankAngle − offset_i) mod 720 < pwDeg`.
   - `Kinj = injFlow3bar / √3`. El caudal instantáneo de un inyector abierto es `Kinj·√max(0, pRail − pMan)`.
   - `qInjTotal` = suma de los inyectores abiertos (instantáneo). `qInjAvg` = media exponencial con τ = 0.2 s (para mostrar).
   - `mixtureRatio = qInjAvg / qInjExpected`, donde `qInjExpected` es el mismo cálculo con `pRail − pMan = 3.0` (presión correcta).
8. **Estado del motor según la mezcla** (solo si está en marcha): `ratio < 0.4` durante 0.3 s → `stalled`. `ratio < 0.75` → `misfire`. `ratio > 1.35` → `misfire` (mezcla rica). En otro caso → `running`.
9. **Fugas**: `qLeakInj` y `qLeakLine` según las fallas (0 si `pRail ≤ 0`).
10. **Riel**: `pRail += (qPump − qInjTotal − qReturn − qLeakInj − qLeakLine) / 3600 / C · dt` y `pRail = max(0, pRail)`.
11. **Estanque**: `tankLevel −= (qInjTotal + qLeakInj + qLeakLine)/3600·dt·(fastConsumption ? 100 : 1)`. El retorno vuelve al estanque, así que no cuenta. `tankLevel = max(0, …)`.

Estabilidad: con `C = 0.005` y `kReg = 1000`, τ = C/kReg ≈ 18 ms. Con `dt = 1 ms` Euler explícito es estable (dt ≪ 2τ). El test 6.9 lo verifica.

Comprobación a mano de las constantes (para que el agente de T3 parta con números coherentes):
- Ralentí: la bomba entrega ~75 L/h y los inyectores piden ~0.6 L/h. El retorno es ~74 L/h y el regulador sobrepasa el setpoint en 74/1000 ≈ 0.07 bar → `pRail − pMan ≈ 3.07`.
- A fondo a 6000 rpm: duty ≈ 0.62, así que se inyectan ≈ 29.5 L/h. La bomba entrega ~68 L/h → retorno ≈ 38 L/h.
- Filtro tapado 1.0 a fondo: kFilter = 1e-2 → equilibrio con `pRail ≈ 1.45 bar`, mezcla ≈ 0.69 → misfire. En ralentí la bomba todavía entrega ~18 L/h, suficiente.
- `pumpWear=1` + 11 V: Pmax ≈ 3 bar → `pRail ≈ 1.3`, mezcla ≈ 0.66 → misfire.
- Inyector goteando 1.0 con el motor apagado: √p baja 0.0167/s → de 3 a 1 bar en ~44 s.

### 6.5 Estado (`state`), con unidades
`engineState` ('off'|'cranking'|'running'|'misfire'|'stalled'), `relayOn` (bool), `primeTimer` (s), `pumpV` (V), `pumpCurrent` (A), `qPump` (L/h), `pPumpOut` (bar), `dpFilter` (bar), `pRail` (bar), `pMan` (bar), `pRef` (bar), `regOpen` (0–1), `qReturn` (L/h), `qInjTotal` (L/h), `qInjAvg` (L/h), `mixtureRatio` (–), `injectors` ([{open: bool}] ×4), `qLeakInj` (L/h), `qLeakLine` (L/h), `tankLevel` (L), `pickupAir` (0–1), `crankAngle` (°), `rpmEff` (rpm).

### 6.6 Lecturas
Presión de riel (manómetro 0–8, verde 2.3–3.8 relativo al vacío; mostrar también `pRail − pMan`), caudal de la bomba, caudal inyectado (promedio), caudal de retorno, caída en el filtro, corriente de la bomba, nivel del estanque (L y %), vacío del múltiple, mezcla (% de la esperada). Todas con `history: true` menos el nivel.

### 6.7 Vista (viewBox 1200×700, coordenadas aproximadas)
- **Bloque eléctrico** arriba a la izquierda (40–300, 30–150): batería → llave → relé (contacto animado) → cable a la bomba. Cuando hay corriente, partículas `p-electric`.
- **Estanque** abajo a la izquierda (60–380, 400–660). Rectángulo con el líquido (alto ∝ `tankLevel/50`) y una ondulación suave. **Bomba** vertical dentro (rotor que gira con velocidad ∝ `qPump`), **colador** en la base y **válvula check** en la salida.
- **Línea de alimentación**: sube desde la bomba hasta el **filtro** (560, 200; cilindro con una flecha de sentido) y sigue al **riel** (700–1100, 110–150).
- **Inyectores**: 4 cuerpos en x = 760, 860, 960, 1060, colgando del riel hacia el **múltiple de admisión** (680–1120, 250–340). Cuando `open`: aguja levantada y cono de spray (triángulo con opacidad que se desvanece).
- **Regulador** en el extremo del riel (1140, 130): cuerpo con diafragma y resorte (el resorte se comprime según `regOpen`). **Manguera de vacío** punteada `--vacuum` hacia el múltiple. Si `vacuumHoseOff`, la manguera se dibuja suelta.
- **Línea de retorno**: baja por la derecha y vuelve al estanque por arriba (entra al líquido).
- **Codificación visual**:
  - La velocidad de las partículas ∝ caudal (escala 4.6).
  - El color interior de cada tubería se interpola por presión (tenue a 0 bar, saturado a 4 bar).
  - Con `pickupAir > 0`, una fracción de las partículas pasa a `p-air`.
  - Las fugas se dibujan como gotas que caen.
  - El manómetro va montado sobre el riel.
  - `engineState` se muestra como una etiqueta de color en el múltiple.
- **Partículas por tramo**: aspiración→bomba (qPump), bomba→filtro (qPump − qLeakLine después del punto de fuga), filtro→riel (qPump − qLeakLine), riel (∝ qPump − qReturn/2, solo visual), retorno (qReturn).

### 6.8 Narración (reglas; mostrar como máximo 3, por severidad)
- Relé cerrado en cebado → info: "Contacto: la ECU activa la bomba 2 s para presurizar el riel."
- `pRail − pRef` entre 2.7 y 3.3 con el motor en marcha → info: "Presión estable: el regulador devuelve el sobrante al estanque."
- `dpFilter > 0.5` → warn: "El filtro está restringiendo: pierde {dp} bar. Se nota más al acelerar."
- `pickupAir > 0` → bad: "La bomba aspira aire: el estanque está casi vacío."
- `vacuumHoseOff` en ralentí → warn: "Sin referencia de vacío, la presión en ralentí sube ~0.6 bar (mezcla rica)."
- `regulator==='stuckClosed'` → bad: "Sin retorno: la presión sube hasta el límite de la bomba."
- `engineState==='stalled'` → bad: "El motor se detuvo por falta de combustible."
- Motor apagado y la presión cae rápido → warn: "La presión residual no se mantiene: hay una fuga (inyector o línea)."
- `mixtureRatio > 1.35` → warn: "Mezcla rica: entra más combustible del que la ECU calculó."

### 6.9 Tests de física (`tests/fuel/model.test.js`) — criterios de aceptación
Helper: `run(model, seconds)` avanza con `dt = 0.001`.
1. Cebado: `ignitionKey='on'` → a los 1.5 s `pRail ∈ [2.8, 3.3]`. A los 4 s el relé está abierto y la presión se mantiene > 2.5 (presión residual).
2. Ralentí sano (`run`, 800 rpm, throttle 0): `pRail − pMan ∈ [2.95, 3.15]` y `pRail ∈ [2.3, 2.5]`.
3. A fondo (throttle 1, 6000 rpm): `pRail ∈ [2.8, 3.2]`, `qReturn > 0`, `engineState==='running'`.
4. Filtro tapado 1.0 a fondo (6000 rpm): `pRail < 2.0` y `engineState` ∈ {misfire, stalled}. En ralentí sigue `running`.
5. `vacuumHoseOff` en ralentí: `pRail` sube ≥ 0.55 bar respecto al caso 2.
6. `regulator='stuckClosed'`: `pRail > 4.5` y `qReturn === 0`.
7. `pumpWear=1` con batería 11 V a fondo → `engineState !== 'running'`.
8. Motor apagado tras el cebado con `injectorLeak=1` → la presión baja a < 1 bar en ≤ 60 s. Sin fuga se mantiene > 2.5 durante 60 s.
9. `tankLevel=0.2` → `pickupAir > 0.7` y `qPump` baja proporcionalmente.
10. Robustez: 1000 combinaciones aleatorias (rng con semilla) de params y faults × 2 s → nunca `NaN`/`Infinity` y `pRail ∈ [0, 7.5]`.
11. Determinismo: dos modelos con la misma secuencia dan estados idénticos.

Si algún rango no cuadra con las constantes, el agente **ajusta las constantes** (no los tests) y documenta el cambio en `docs/modules/fuel.md`.

### 6.10 Presets
"Arranque normal", "Tironea al acelerar en subida" (filtro 0.8), "Ralentí rico" (manguera suelta), "Cuesta partir en la mañana" (inyector goteando + pierde la presión residual), "Me quedé sin bencina" (estanque 0.5 L + consumo acelerado).

---

## 7. Módulo 2 — Ciclo de 4 tiempos (spec de nivel de diseño; el agente la completa al nivel de la sección 6 antes de programar)
- **Piezas**: `piston`, `rod`, `crank`, `cylinder`, `head`, `intakeValve`, `exhaustValve`, `camshaft`, `timingBelt`, `sparkPlug`, `intakePort`, `exhaustPort`.
- **Geometría**: diámetro 86 mm, carrera 86 mm, biela 143 mm, relación de compresión 10:1. Posición del pistón por biela-manivela: `x = r·cosθ + √(l² − r²·sin²θ)`.
- **Distribución** (grados de cigüeñal): admisión abre 10° APMS y cierra 40° DPMI; escape abre 40° APMI y cierra 10° DPMS. Leva con perfil suave (seno²). La leva gira a la mitad de las rpm y se muestra una correa con relación 2:1.
- **Presión en el cilindro**:
  - Admisión ≈ `pMan` absoluto.
  - Compresión politrópica, n = 1.3.
  - Combustión: función de Wiebe (a = 5, m = 2), que parte en el avance de chispa y dura 50°. Energía ∝ throttle.
  - Expansión, n = 1.3. Escape ≈ 1.1 bar abs.
  - Con las válvulas abiertas la presión se relaja hacia la del puerto (τ corto).
- **Vista**: corte del cilindro. El gas cambia de color según la fase (`--mixture` → `--burn` → `--exhaust`). El nombre del tiempo va en grande. A la derecha, **diagrama P-V en vivo** con el punto actual y la traza del ciclo. Se puede **arrastrar el cigüeñal con el mouse** en modo manual.
- **Params**: `mode` ('auto'|'manual'), `rpm` 60–6000, `throttle`, `sparkAdvance` 0–40°, `showOverlap`.
- **Fallas**: `ringWear` (blow-by: fuga ∝ presión), `burntExhaustValve` (fuga en compresión/expansión), `camTimingOffset` (±3 dientes = ±15°/diente... las válvulas se desfasan y pueden chocar con el pistón → alerta), `noSpark`.
- **Lecturas**: ángulo, tiempo actual, presión, volumen, torque instantáneo, presión máxima de compresión (prueba de compresión), trabajo por ciclo.
- **Tests**: PMS/PMI en 0/180°; compresión pura sin chispa ≈ `p1·10^1.3` ≈ 20 bar con p1 = 1; `ringWear` baja la compresión máxima; trabajo neto > 0 con chispa y ≈ ≤ 0 sin chispa; `timingOffset` grande → evento de choque.

## 8. Módulo 3 — Encendido (spec de nivel de diseño)
- **Tipo**: bobina por cilindro (COP) comandada por la ECU. Sensor de cigüeñal con rueda 60-2.
- **Piezas**: `battery`, `key`, `ecu`, `crankSensor`, `toothWheel`, `igniter` (transistor), `coilPrimary`, `coilSecondary`, `sparkPlug`, `cylinder`.
- **Física**:
  - Primario RL: `i = V/R·(1 − e^{−t/τ})`, con R = 0.5 Ω, L = 3 mH.
  - Tiempo de carga (dwell) configurable, 3 ms por defecto.
  - Al cortar, la energía `½·L·i²` pasa al secundario (relación 1:100). El voltaje disponible es `Vavail ∝ i_corte`, con un máximo de ~35 kV.
  - Voltaje de ruptura: `Vreq = 3 kV + 9 kV·gap_mm·(pCil_bar/10)`.
  - Chispa si `Vavail ≥ Vreq`. Si no → falla de encendido.
  - La presión del cilindro sale de una curva simple de compresión según el ángulo.
- **Vista**: circuito con partículas `p-electric` en el primario, rueda dentada girando con la señal del sensor y un **osciloscopio** de dos canales (corriente del primario y voltaje del secundario) que se congela con cámara lenta.
- **Params**: `rpm`, `dwellMs`, `advanceDeg`, `batteryV`, `plugGapMm` (0.6–1.6), `load`.
- **Fallas**: `plugWear` (aumenta la separación efectiva), `fouledPlug` (deriva: parte de la energía se pierde), `weakCoil` (L y relación menores), `openHTLead`, `crankSensorFail` (sin señal → sin chispa y sin pulsos).
- **Tests**: la corriente llega al 63 % a τ = 6 ms; hay chispa en condiciones sanas; batería de 10 V + dwell 1.5 ms + gap 1.6 + carga alta → falla; sin sensor → cero chispas.

## 9. Módulo 4a — Refrigeración (spec de nivel de diseño)
- **Piezas**: `engineBlock`, `waterPump`, `thermostat`, `radiator`, `fan`, `bypass`, `heaterCore`, `expansionTank`, `pressureCap`, `tempSensor`.
- **Física (modelo de nodos térmicos)**:
  - Calor generado: `Q = 2 kW + 38 kW·load·rpm/6000`.
  - Masas térmicas: bloque + refrigerante (8 kg·3.6 kJ/kgK) y radiador (3 kg).
  - Caudal de la bomba ∝ rpm: 150 L/min a 6000 rpm.
  - Termostato: apertura lineal entre 88 y 100 °C. Bypass cuando está cerrado.
  - Radiador: `Qrad = UA(airflow)·(Trad − Tamb)`, con `airflow` = velocidad del auto + ventilador.
  - Ventilador: histéresis 100/95 °C.
  - Tapa a 1.1 bar: el punto de ebullición sube a ~122 °C. Con baja presión o nivel bajo → ebullición/aire.
- **Params**: `rpm`, `load`, `vehicleSpeedKmh`, `ambientC`, `heaterOn`.
- **Fallas**: `thermostatStuck` ('ok'|'open'|'closed'), `pumpImpellerWear`, `radiatorClog`, `fanFail`, `coolantLeak` (el nivel baja), `capFail`.
- **Vista**: circuito con partículas `p-coolant` coloreadas por temperatura (interpolación azul → rojo), termostato animado y aspas del ventilador.
- **Tests**: calentamiento hasta ~90 °C estable; termostato abierto → no pasa de ~70 °C en tráfico frío; ventilador roto + detenido + carga → sobrecalentamiento; tapa fallada → hierve antes.

## 10. Módulo 4b — Lubricación (spec de nivel de diseño)
- **Piezas**: `sump`, `pickup`, `oilPump` (engranajes), `reliefValve`, `oilFilter`, `filterBypass`, `mainGallery`, `mainBearings`, `rodBearings`, `camBearings`, `pressureSwitch`, `warningLamp`.
- **Física**:
  - Bomba de desplazamiento positivo: `Q = disp·rpm`, ~40 L/min a 6000 rpm.
  - Alivio a 4.5 bar. Bypass del filtro con ΔP > 1 bar.
  - Fuga en los cojinetes: `Q_leak = Σ k·clearance³·p / μ(T)`.
  - Viscosidad `μ(T)` exponencial (aceite frío ⇒ alta presión).
  - Temperatura del aceite como param.
  - Nivel bajo → aire en la aspiración.
  - Luz de advertencia < 0.5 bar.
- **Params**: `rpm`, `oilTempC`, `oilGrade` ('5W-30'|'10W-40'|'20W-50'), `oilLevel`.
- **Fallas**: `bearingWear` (holgura ↑), `filterClog` (bypass abre → aceite sucio), `reliefStuckOpen`, `pickupClog`, `lowOil`.
- **Tests**: presión ∝ rpm hasta el alivio; frío → presión más alta; `bearingWear` → la luz se enciende en ralentí caliente.

## 11. Integración futura ("motor completo")
No se implementa ahora. Queda garantizada por el contrato: todos los modelos leen `rpm`/`throttle`/`load` desde `params`. Un futuro orquestador `src/modules/engine/` va a instanciar varios modelos y copiar señales (`fourStroke.state.rpm → fuel.params.rpm`, `fuel.state.mixtureRatio → fourStroke.faults.mixture`, `ignition.state.sparkOk → fourStroke`, `cooling.state.tempC → lubrication.params.oilTempC`). **Regla para ya**: ningún modelo lee el estado de otro módulo directamente.

---

## 12. Reparto de trabajo por agente

Cada tarea = un agente, con **archivos propios** (no se tocan los de otro). Los agentes en paralelo trabajan con `isolation: "worktree"` y se integra por merge. Cada agente termina con `npm test` y `npm run build` en verde, y hace un commit.

| # | Tarea | Depende de | Archivos propios | Criterio de aceptación |
|---|---|---|---|---|
| **T0-a** | Docs (lo hago yo, apenas se apruebe el plan) | — | `AGENTS.md`, `docs/**` | `docs/plans/2026-09-22-plan-maestro.md` = este plan textual. NORTE/ARCHITECTURE/AHORA/SISTEMAS/README/CONTRATOS según 3.1, dentro de sus presupuestos de líneas. `docs/modules/*.md` = secciones 6–10 |
| **T0-b** | Scaffold | T0-a | `package.json`, `vite.config.js`, `index.html`, `.gitignore` | `git init`; Vite vanilla limpio; `npm test` corre (0 tests OK); `npm run build` OK; primer commit |
| **T1** | Core de simulación | T0 | `src/core/{types,rng,math,loop,history,particles,svg,dom}.js`, `tests/core/**` | Tests de `loop` (cuenta de pasos por timeScale, tope de pasos, pausa), `history` (ring buffer), `rng` (determinismo), `math` |
| **T2** | Shell de la UI | T0 (usa las firmas de T1; puede ir en paralelo con un stub) | `src/main.js`, `src/styles.css`, `src/core/{router,shell}.js`, `src/core/ui/**`, `src/modules/registry.js`, `src/modules/_demo/**` | Con un módulo `_demo` trivial (un tanque que se vacía, 1 slider, 1 falla, 1 lectura): navegación, montaje/desmontaje sin fugas de listeners, tema claro/oscuro, responsive |
| **T3** | Modelo de combustible | T1 | `src/modules/fuel/model.js`, `tests/fuel/**` | Los 11 tests de 6.9 pasan |
| **T4** | Vista de combustible | T1, T2 (el estado de 6.5 se puede simular con un stub) | `src/modules/fuel/view.js` | Todos los `partId` son clickeables; partículas en el sentido correcto; inyectores pulsando; se ve bien en claro y oscuro |
| **T5** | Contenido de combustible | contrato 4.4 | `src/modules/fuel/{content,narrate,index}.js` | Fichas de las 18 piezas; reglas 6.8; presets 6.10; controles/fallas/lecturas declarados |
| **T6** | Integración y verificación visual del combustible | T3, T4, T5 | ajustes menores + `docs/modules/fuel.md` | Checklist de la sección 13 revisada con capturas en el navegador |
| T7–T10 | Módulos 4 tiempos, encendido, refrigeración, lubricación | T6 (usar combustible como plantilla) | `src/modules/<id>/**`, `tests/<id>/**` | Cada agente **primero** amplía su spec al nivel de la sección 6 en `docs/modules/<id>.md` (tablas de params/fallas/física/estado/tests), la hace revisar y después programa |

Paralelismo: T0-a → T0-b → {T1, T2} → {T3, T4, T5} → T6 → {T7, T8, T9, T10}.

**Prompt base para cada agente**: "Lee `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/CONTRATOS.md`, `docs/AHORA.md` y `docs/modules/<id>.md`. Al terminar, agrega tu bloque CERRADO en `AHORA.md`. Tu tarea es T#. Solo puedes modificar estos archivos: … Criterios de aceptación: … Si el contrato te queda corto, no lo cambies: anótalo en `docs/core-requests.md`."

---

## 13. Verificación end-to-end
1. `npm test`: tests del core + los de física de cada módulo (6.9 y equivalentes).
2. `npm run build` sin errores ni warnings.
3. `npm run dev` y revisar en el navegador con claude-in-chrome (capturas), checklist del combustible:
   - Llave `on` → partículas eléctricas y de bencina por 2 s, la aguja sube a ~3 bar y se queda ahí con el relé abierto.
   - `start` → `run`: los inyectores pulsan en orden 1-3-4-2 (se ve claro a 0.05×). Hay flujo de retorno visible.
   - Acelerador a fondo: el caudal inyectado sube, el retorno baja y la presión se mantiene.
   - Cada falla de 6.3 produce el efecto de 6.8 y 6.9 (ej. filtro tapado → caída de presión al acelerar + mensaje).
   - Clic en cada pieza → ficha correcta + resaltado.
   - Cambiar de módulo y volver no duplica animaciones (sin fugas de memoria).
   - Tema oscuro legible, y a 800 px de ancho el panel pasa debajo.
