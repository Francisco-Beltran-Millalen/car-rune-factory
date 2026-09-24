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

## EN CURSO — Arquitectura de juego (plan 2026-09-23)

Plan: `plans/2026-09-23-arquitectura-juego.md`.
Orden con un solo agente: A0 (✅) → A1 → A2 → A3 → A4 → …

| # | Tarea | Depende de | Estado |
|---|---|---|---|
| A0 | Docs: leyes §17, §19–§30 en ARCHITECTURE, contratos de juego 6.1–6.8 | — | ✅ |
| A1 | Sesión + intents + labMode + shell nuevo + legacyRenderer + paneles DOM + router | A0 | ✅ |
| A2 | Quiz (E1) + HUD + guardado + campaña + etiquetas de nombre separadas | A1 | ⏳ siguiente paso |
| A3 | Diagnóstico (E2) + faultCatalog combustible + herramientas + visibilidad | A2 | ⏳ |
| A4 | Solver nodal + linalg | A0 | ⏳ |
| A5 | Elementos + circuito (compile/validate) + controladores base | A4 | ⏳ |
| A6 | Combustible sobre el solver | A5, A3 | ⏳ |
| A7 | Renderer SVG genérico | A6 | ⏳ |
| A8 | Prueba con Phaser 4.2 | A7 | ⏳ |
| A9 | Armar circuitos (E4) | A8 | ⏳ |
| A10 | Plan del vehículo y casos entre sistemas | A6 | ⏳ |

**Siguiente paso:** A2 (Quiz E1 + HUD + guardado + campaña).

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
