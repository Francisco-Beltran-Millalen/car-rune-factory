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
| T1 | Core de simulación (`types, rng, math, loop, history, particles, svg, dom`) | T0-b | ⏳ |
| T2 | Shell de la UI + módulo `_demo` | T0-b | ⏳ |
| T3 | Modelo de combustible + 11 tests | T1 | ⏳ |
| T4 | Vista de combustible | T1, T2 | ⏳ |
| T5 | Contenido de combustible (fichas, narración, presets, descriptor) | T0-b | ⏳ |
| T6 | Integración + verificación visual del combustible | T3, T4, T5 | ⏳ |

Orden: T0-a → T0-b → {T1, T2} → {T3, T4, T5} → T6.

Detalle de archivos y criterios de aceptación de cada tarea: sección 12 de
`plans/2026-09-22-plan-maestro.md`.

## PRÓXIMO — Fase 2+

T7 ciclo de 4 tiempos, T8 encendido, T9 refrigeración, T10 lubricación.
Antes de programar, cada agente amplía su `docs/modules/<id>.md` al nivel de
detalle de `fuel.md` (tablas de params, fallas, física, estado y tests) y lo
guarda como plan en `docs/plans/`.

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
