# Contratos

> Extraído de `docs/plans/2026-09-22-plan-maestro.md`. Este archivo es el **vivo**: si cambia la spec, se cambia acá (y se anota en `AHORA.md`).

Las leyes que estos contratos implementan están en `ARCHITECTURE.md` (§n).

## Contratos del core

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
- `reset()` restaura **en el mismo objeto** (`Object.assign(params, DEFAULT_PARAMS)`): la UI guarda referencias a `params`/`faults`/`state` y no se re-cablea.
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
- La vista **no** cablea clics ni hover: el shell delega sobre `[data-part]`, abre la ficha, muestra el tooltip con el nombre y agrega la clase `.selected` a todos los elementos de esa pieza. `highlight` es opcional, para efectos extra.
- Clases CSS disponibles (`src/styles.css`): `.part-body`, `.pipe-wall`, `.pipe-fluid`, `.fluid-{fuel,coolant,oil,electric,vacuum}`, `.liquid`, `.p-*`, `.lbl`, `.lbl-small`, `.valve-bar`, `.gauge-*`.
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
// → { tick(realDt), start(), stop(), stepOnce(), setTimeScale(x), setPaused(b), get timeScale, get paused, get running, destroy() }
// onFrame(simDt, steps). El historial: createRecorder(readouts) de core/history.js, .sample(model) en onFrame.
```
- En cada frame: `realDt = min(ahora - antes, 0.1)`. Luego `acc += realDt * timeScale`. Mientras `acc ≥ fixedDt` (y sin pasar `maxStepsPerFrame`) se llama `model.step(fixedDt)`. Al final, `onFrame(realDt * timeScale)`.
- `timeScale` va de 0.01 a 4, con valores predefinidos: 0.01, 0.05, 0.25, 1, 2, 4. La cámara lenta es clave para ver los inyectores y el ciclo de 4 tiempos.
- El registro de historial (`history.js`) toma muestras de las lecturas con `history: true` cada 50 ms de tiempo simulado. Guarda los últimos 400 puntos.

### 4.6 Partículas — `core/particles.js`
```js
createFlow({ path /* SVGPathElement */, layer /* SVGGElement */, spacing = 14, radius = 3, className = 'p-fuel' })
// → { setSpeed(pxPerSec /* puede ser negativo */), setStyle(className), setDensity(0..1), setAir(0..1), update(dt), destroy() }
```
- Las partículas están distribuidas a lo largo del path (`getTotalLength`/`getPointAtLength`) y avanzan con `speed·dt`. La densidad visible = `density` (se ocultan partículas). Así se ven tramos vacíos o con aire.
- Convención visual: **velocidad ∝ caudal**, con escala `PX_PER_LH = 2.5` (100 L/h → 250 px/s). Cada módulo puede cambiar la escala.
- `className` permite `p-fuel`, `p-air` (burbuja hueca), `p-coolant`, `p-oil`, `p-mixture`, `p-exhaust`, `p-electric`.

### 4.7 Helpers SVG — `core/svg.js`
`el(tag, attrs, parent)`, `group(parent, attrs)`, `pipe(parent, points, { width, className })` (devuelve `{ outer, inner, path }`, con esquinas redondeadas y un path central utilizable por `createFlow`), `box(parent, { x, y, w, h, r, label, part })`, `label(parent, x, y, text, opts)`, `arrowMarkers(svg)`, `gaugeSvg(parent, opts)` (manómetro con aguja: `{ setValue(v) }`).

### 4.8 Router / shell
- Ruta `#/<id>`. Si está vacía, se muestra la portada con tarjetas de todos los módulos del `registry`.
- `shell.mount(descriptor)`: crea el SVG, el modelo, la vista, el loop y los paneles. Cablea `selectPart` → `infoPanel.show(parts[id])` y `view.highlight(id)`. `shell.unmount()` destruye todo sin dejar listeners.

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
