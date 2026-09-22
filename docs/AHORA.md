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
| T4 | Vista de combustible | T1, T2 | ⏳ |
| T5 | Contenido de combustible (fichas, narración, presets, descriptor) | T0-b | ✅ |
| T6 | Integración + verificación visual del combustible | T3, T4, T5 | ⏳ |

Orden: T0-a → T0-b → {T1, T2} → {T3, T4, T5} → T6.

Detalle de archivos y criterios de aceptación de cada tarea: sección 12 de
`plans/2026-09-22-plan-maestro.md`.

## PRÓXIMO — Fase 2+

T7 ciclo de 4 tiempos, T8 encendido, T9 refrigeración, T10 lubricación.
Antes de programar, cada agente amplía su `docs/modules/<id>.md` al nivel de
detalle de `fuel.md` (tablas de params, fallas, física, estado y tests) y lo
guarda como plan en `docs/plans/`.

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
- **Checklist de revisión manual** (`npm run dev`, abrir en Firefox):
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
