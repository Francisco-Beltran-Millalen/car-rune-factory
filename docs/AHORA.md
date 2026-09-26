# Ahora — el trabajo presente

Trabajo vivo entre sesiones (≤500 líneas). Lo cerrado se recorta y queda en
git. Reglas en `ARCHITECTURE.md`, visión en `NORTE.md`, plan original en
`plans/2026-09-22-plan-maestro.md`.

## PENDIENTE — FIX 2026-09-25 (encontrado por el usuario) — el feedback del quiz usa tiempo simulado

En las etapas del quiz, al bajar la velocidad con el timebar (p. ej. 0.05×) el
1 s de feedback antes de pasar a la siguiente pregunta se estira igual que la
simulación. Esos tiempos son de **UI** y no deberían depender de `timeScale`.

- Causa: `core/shell.ts:378` llama `mode.update(simDt)` y `game/modes/quiz.ts:328`
  descuenta el `timer` con ese `simDt` (`simDt = realDt × timeScale`,
  CONTRATOS 4.5). El laboratorio no tiene timers de UI, por eso sólo se nota
  en el quiz.
- Arreglo propuesto: pasar también el `realDt` al modo (`GameMode.update(simDt,
  realDt)` + `session.onFrame`/`core/loop.ts` entregando el `realDt`, que hoy
  se descarta) y que `quiz.ts` descuente el feedback con `realDt`. Revisar si
  el HUD/log u otro modo tienen timers de UI con el mismo problema.
- Test: con `timeScale = 0.05`, el feedback debe durar ~1 s **real** aunque el
  reloj de la sesión avance 50 ms de simulación.
- Toca `core/loop.ts`, `game/session.ts`, `game/types.ts`, `core/shell.ts` y
  `game/modes/quiz.ts`: es una tarea de core + modo, no de un módulo.

## CERRADO 2026-09-22 — Fase 1: sistema de combustible

T0–T6 (docs, scaffold, core, shell, modelo, vista, contenido e
integración) cerradas; el usuario lo probó el 2026-09-22 ("me gustó
mucho"). Detalle por tarea: sección 12 de `plans/2026-09-22-plan-maestro.md`.
La checklist detallada del combustible (al final) queda para una pasada fina.

## CERRADO 2026-09-25 — TypeScript estricto (plan 2026-09-24)

TS0–TS5 cerradas, un commit por fase (`d15899c` … `fc562c2`). Informe con qué
se hizo y qué errores aparecieron: `informes/2026-09-25-migracion-typescript.md`;
los CERRADO de TS0–TS4 están en git. Se usa **TS 6.0 + ESLint** (opción A).
**TS 7 sigue pendiente:** al empezar cada tarea A, correr
`npm view typescript-eslint peerDependencies`; si acepta TS 7, la migración
es una tarea chica (plan §12, camino 1) y se agrega a la tabla de abajo
(2026-09-25: pide `typescript <6.1.0`, todavía no).

Las listas de archivos de los planes 2026-09-23 y 2026-09-24 dicen `.js`:
léanse como `.ts`.

## EN CURSO — Simulación antes que juego

**Tu ficha está en `docs/FICHAS.md`**: lee su "Contexto común" y después la
ficha de tu tarea, y sólo lo que esa ficha nombre. Ahí están las decisiones
vigentes (laboratorio antes que juego; el auto completo de 1970 a 2010,
modelado por sistema con arquetipos). No leas los planes de 2026-09-25 y
2026-09-26 por tu cuenta: lo vigente ya está en las fichas.

Un agente a la vez, en orden, todo en `main`. Cada tarea cierra con
`npm run check` verde, un CERRADO aquí y un commit.

Informe del bloque ya hecho (qué se hizo, dificultades del solver y gaps del
plan): `informes/2026-09-25-bloque-s-a4-a6.md`.

**Bloque S — simulación y laboratorio**

| # | Tarea | Depende de | Estado |
|---|---|---|---|
| A0–A2 | Docs, sesión/intents/modos, quiz E1, HUD, guardado | — | ✅ |
| TS0–TS5 | TypeScript estricto | — | ✅ |
| A4 | Solver nodal + linalg (plan 2026-09-23 §8.1, fila A4) | — | ✅ |
| A5 | Elementos + circuito (compile/validate) + controladores base (§8.2–§8.4) | A4 | ✅ |
| A6 | Combustible sobre el solver, paridad con la referencia; crea `fuel/faults.ts` mínimo (plan 2026-09-25 §3.1) | A5 | ✅ |
| A6b | Síntomas del combustible: colador, relé intermitente, bomba (plan 2026-09-25 §3.3) | A6 | ⏳ **siguiente** |
| A7 | Presenter + renderer SVG genérico del laboratorio; borra `legacyRenderer` y `fuel/view.ts`; quiz sigue jugable (§8.5 + plan 2026-09-25 §3.2) | A6 | ⏳ |
| A10 | **Plan** del vehículo + laboratorio del vehículo, sin código (§14.4 + plan 2026-09-25 §3.4) **+ arquetipos por sistema y señales nuevas (`FICHAS.md`)** | A7 | ⏳ |
| A11 | Ciclo de 4 tiempos: spec → plan → código (plan 2026-09-25 §3.5) | A10 | ⏳ |
| A12 | Encendido | A10 | ⏳ |
| A13 | Refrigeración | A10 | ⏳ |
| A14 | Lubricación | A10 | ⏳ |
| A16 | Carburador: sistema hermano de `fuel`, publica `fuel.mixture` (`FICHAS.md`) | A10 | ⏳ |
| A15 | Laboratorio del vehículo (sistemas relacionados), con un vehículo antiguo y uno moderno | A11–A14, A16 | ⏳ |

**Bloque S2 — resto del auto** (después de A15; el usuario elige el orden al
cerrar A15): eléctrico (carga y arranque), frenos, tren motriz, suspensión,
dirección y ruedas, e inspección visual de carrocería. Sin fichas todavía
(`FICHAS.md`).

**Puerta:** el bloque G empieza sólo cuando el usuario lo escriba aquí.

**Bloque G — juego** (en espera)

| # | Tarea | Depende de | Estado |
|---|---|---|---|
| A3 | Diagnóstico E2 con la enmienda `plans/2026-09-25-a3-revision.md` (volver a medir su tabla) | puerta | ⏸ |
| G1 | Checkpoint de juego del usuario (plan motor-y-juice §3) | A3 | ⏸ |
| A8 | Prueba de juice → `docs/decisiones/0001-motor.md` (motor-y-juice §4) | G1 | ⏸ |
| D-motor | Decisión del usuario; afecta al juego, el laboratorio sigue en SVG | A8 | ⏸ |
| A9 | Armar circuitos E4 (plan propio) | D-motor | ⏸ |

**Siguiente paso: A6b**, ficha en `docs/FICHAS.md#a6b--síntomas-del-combustible`.

## CERRADO 2026-09-25 — A6 Combustible sobre el solver (paridad con la referencia)

- `src/modules/fuel/circuit.ts`: `CircuitDef` `fuel-return` (batería, llave,
  relé, estanque, colador en la aspiración, bomba, línea, filtro, riel con
  `volume`, 4 inyectores, múltiple, regulador, manguera) + `compileFuelCircuit`
  y `createCompiledFuelModel(overrides)` con la misma forma que la referencia
  (`params`, `faults`, `seed`, `tankLevel`; `refill`/`setTank` por `ModelActions`).
- `src/sim/controllers/{engineCore,stubs}.ts`: cerebro único del motor (§14.1)
  con `inputs` ideales (§29) y señales compartidas; sirve para A10 sin cambios.
  `src/modules/fuel/controllers.ts`: `ecuFuel` (cebado, relé, inyección por
  ángulo, mezcla, fugas, regulador), `alternator` y `fuelSupply`.
- `src/modules/fuel/faults.ts`: catálogo §26 con los 8 ids de P23 §4.6.
  `FaultCatalogEntry` en `core/types.ts` y `faultCatalog` en el descriptor.
  `model.ts` → `reference-model.ts`; el descriptor usa el compilado.
- Cambios fuera de la lista de archivos de A6, anotados: `sim/circuit/compile.ts`
  usa los objetos `params`/`faults` que le da el módulo (así el modelo tipado
  se expone sin cast); `eslint.config.js` deja que un módulo importe `sim/**`
  (`fuel/circuit.ts` usa `compileCircuit` y `ELEMENT_TYPES`) y extiende la
  excepción de `type` (vs `interface`) a `reference-model.ts`.
- **Puente eléctrico**: llave y relé quedan siempre cerrados; el alternador
  pone `battery.control.v = relayOn ? v : 0` (= `pumpV` de la referencia).
  Evita el escalón de conductancia de 1e7 que dejaba al solver sin converger.
- **Solver (§4 de `solver.md`)**: relajación **por nodo** cuando su paso de
  Newton cambia de signo (ciclo `−2·Δp` de dos nodos sin capacitancia unidos
  por un restrictor saturando) + paso que no cruza el 0; tope `maxDelta` 1e6.
  Sin esto los transitorios de relé daban `failures > 0`. Benchmark: 22–25 ms
  por 1000 pasos (40–45 k pasos/s), ~10 % más que antes.
- Tests (+27, **191** en total): suite de §9 parametrizada (referencia y
  compilado), paridad de 10 escenarios (§9b) con `pRail` ≤ 0,05 bar y caudales
  ≤ 3 % y `failures === 0`, catálogo de fallas, fuzz reducido del compilado
  (200 × 1000, timeout 30 s). `npm run check` verde.
- Divergencias medidas y documentadas en `fuel.md` §9c (aire implícito:
  ratio 0,2067 vs 0,2000; riel sin `max(0,·)`: mínimo −0,0133). Son de A6b.
- **Checklist de Firefox pendiente** (`npm run dev`): el laboratorio del
  combustible y las etapas 1 y 2 del quiz deben verse y comportarse igual que
  antes (el renderer sigue siendo el legacy; sólo cambió el modelo por dentro).
  1. `#/lab/fuel`: llave en Contacto → cebado de 2 s y manómetro ~3 bar;
     Arranque → Marcha; sliders, fallas (filtro, manguera, regulador, relé,
     fugas) y los 5 presets responden; lecturas y sparklines se mueven;
     narración; clic en una pieza → ficha; tema oscuro legible.
  2. `#/stage/fuel-quiz-1` y `#/stage/fuel-quiz-2`: preguntas, feedback,
     puntaje, estrellas, candado y guardado (recargar conserva el progreso).
  3. F12 sin errores; en la consola `window.__sim.mode.hud()` y
     `window.__sim.save.get()` responden.

## CERRADO 2026-09-25 — A5 Elementos + circuito + controladores base

- `src/sim/elements/`: 13 tipos (`restrictor`, `checkValve`, `leak`, `volume`,
  `tee`, `electricPump`, `reliefRegulator`, `orifice`, `tank`,
  `pressureSource`, `battery`, `resistor`, `switch`), registro `ELEMENT_TYPES`
  con `joint` (tank/tee: sus puertos son un nodo interno) y `multiple` (tee).
  Helpers de regularización en `common.ts` (`√` suavizada, `softRelu`,
  `noCommit`/`noEval` con comentario para el lint).
- **`resistor` es nuevo respecto de §8.2**: la aceptación de A5 pide el
  juguete "batería-switch-resistencia" y la tabla del plan sólo traía el
  `switch`. Documentado en `solver.md` §6 y `CONTRATOS.md` §4.10.
- `src/sim/circuit/`: `types.ts`, `parts.ts`, `validate.ts` y `compile.ts`.
  Union-find de puertos (joint incluido), nodos fijos por `def.fixed`,
  sondas `{node}`/`{element,probe}`, `bindings` params/faults → `control`,
  `init` (tankLevel), `actions`, `seed`, y un `Model` que corre bindings →
  controladores (leen el paso anterior, §25) → solver → publicación de sondas
  y estado de controladores. `reset()` re-inicializa todo y deja `time = 0`.
- `src/sim/controllers/{base,index}.ts`: contrato `ControllerDef`
  (`probes`, `state` publicado, `update(ctx)` con `read/params/faults/elements/rng`)
  y `createControllers`. `ecuFuel`/`engineCore`/`stubs` son de A6.
- `validateCircuit` cubre los 5 problemas de §8.4 (puerto inexistente,
  dominio, fluido, >1 conexión salvo tee, sin conectar como aviso) más
  duplicados, sonda y fijo inválidos, y controlador desconocido.
- Tests (+23, **164** en total): `tests/sim/elements.test.ts` (ley + jacobiano
  contra diferencias finitas con tolerancia 1e-9 + 1e-4·|fd|, ε de
  regularización respetado) y `tests/sim/circuit.test.ts` (validate por caso,
  juguete eléctrico 12,6 V/10,03 Ω = 1,2562 A, lazo bomba-restrictor-tanque
  contra raíz cerrada con la misma ley, binding de `filterClog`, retraso de un
  paso del controlador, nodos `joint` y reset).
- `npm run check` verde: typecheck, lint 0 warnings, knip, 164 tests y build.
  **Sin checklist de Firefox** (A5 no es visual, lo dice su ficha).
- Docs: `solver.md` §6–§8 (biblioteca y circuito) y `CONTRATOS.md` §4.10.

## CERRADO 2026-09-25 — A4 Solver nodal + linalg

- `src/sim/solver/{types,linalg,nodal}.ts`: contrato del solver y de los
  elementos (§24, P23 §8.2), `solveDense` (pivoteo parcial; `false` bajo
  `1e-14`) y `createSolver` (Newton implícito, `gmin`, amortiguación ±1,
  nodos fijos con `reaction`). Puros (§1) y sin azar.
- Signo del balance nodal: el residuo es `F_i = −Σ flow[p] + Ĉ·(x−x_prev)/dt`
  (flujos que **salen** del nodo) y el jacobiano lleva el mismo signo. El test
  RC (63 % en τ) fue el que destapó el problema al implementarlo al revés.
- Decisiones de tipos que la ficha dejaba a A4 (anotadas también en
  `solver.md`/`CONTRATOS.md` §4.9):
  - `ElementDef.fixed?(out)`: el propio elemento declara su nodo Dirichlet
    (lo pide `pressureSource` en §8.2); `ground` + `setFixed/free` siguen
    siendo el mecanismo general.
  - `commit(pot, dt, reaction)`: tercer argumento con la reacción del nodo de
    cada puerto, porque el `tank` de §8.2 integra el nivel con
    `−reaction`.
  - `reaction(node)` = flujo neto que sale del nodo fijo; incluye el término
    capacitivo si el nodo lo tiene.
- Tests `tests/sim/linalg.test.ts` y `tests/sim/nodal.test.ts` (+18: divisor,
  fuente dinámica, reacciones, RC, RL, dos restrictores en serie contra la
  fórmula, nodo flotante con gmin, `setFixed/free`, paso que no converge
  revierte, eval con NaN no contamina, benchmark).
- **Benchmark** (20 nodos, 18 incógnitas, 1000 pasos de 1 ms): 18–22 ms por
  1000 pasos (~0,02 ms/paso, 44 000–55 000 pasos/s) en i7-7700HQ / Node 26;
  con la suite completa en paralelo, 28 ms. Muy por encima del presupuesto de
  4000 pasos/s (4×). Anotado en `docs/modules/solver.md` §5; sin umbral en el
  test.
- Docs: `docs/modules/solver.md` (nuevo) y sección 4.9 "Solver nodal" en
  `CONTRATOS.md`. `gmin` cumple lo que pedía P25: la singularidad de linalg se
  prueba aparte y el nodo flotante no produce NaN.
- `npm run check` verde: typecheck, lint 0 warnings, knip, **141 tests** y
  build. **Sin checklist de Firefox** (A4 no es visual, lo dice su ficha).

## CERRADO 2026-09-25 — limpieza post-TS y revisión del plan de A3

- Paneles (`core/ui/controls.ts`, `core/ui/faults.ts`): `emit` tipado como
  `(intent: Intent) => void`. Se quitaron el genérico `I extends IntentLike`,
  los 2 casts `emit as Emit` y los 2 `eslint-disable` que TS2 dejó "para TS5"
  y que TS5 no limpió. `IntentLike` borrado de `core/types.ts` (sin uso).
  Quedan **3** `as` frontera en `src/` (`dom.ts`, `shell.ts`, `controls.ts`).
- `ARCHITECTURE.md`: §2 decía que `params`/`faults` los escriben "los
  controles de la UI" (choca con §20: sólo el modo); rutas `.js` → `.ts` en
  §3/§17; pipeline con intents → modo, y router `#/lab/<id>` / `#/stage/<id>`.
- `AHORA.md`: Fase 1 y TypeScript pasan a CERRADO; se recortaron los CERRADO
  de TS0–TS4 (en git y en el informe); se quitó "worktrees + merge" de la
  Fase 1, que contradecía `AGENTS.md` regla 8.
- Revisión de A3 contra el código, con simulación de cada falla:
  `plans/2026-09-25-a3-revision.md`. Hallazgo principal: el diagrama muestra
  manómetro, retorno, corriente y suciedad del filtro sin herramientas, así
  que E2 se resolvería mirando la pantalla.
- `npm run check` verde: typecheck, lint 0 warnings, knip, 123 tests y build.
  Sin cambio de comportamiento: no hace falta revisar en Firefox.

## CERRADO 2026-09-25 — TS5 cierre de TypeScript

- `src/core/shell.js`, `src/render/legacy/index.js` y `src/main.js` → `.ts`;
  `index.html` apunta a `/src/main.ts`. `shell.mount` recibe la unión discriminada
  `{ kind: 'lab'; module } | { kind: 'stage'; module; stage; attempt }` (§8.6) y
  `window.__sim` queda declarado con `declare global` (hook de depuración).
- Configuración: `allowJs` fuera del `tsconfig.json`; `vite.config.ts` con sólo
  `.test.ts` y el checker linteando `src/**/*.ts`; `knip.json` en `.ts`; el bloque
  de transición de ESLint reducido a `eslint.config.js`.
  `git ls-files 'src/**/*.js' 'tests/**/*.js'` → vacío.
- Docs: `ARCHITECTURE.md` §1 (model.ts), §7 (unión de strings, sin enum), §18
  (tipos en TS) y leyes §31–§33 + rationale TypeScript + Vite; `CONTRATOS.md` con
  las firmas en TS y punteros al código; `NORTE.md`, `README.md` de docs y
  `AGENTS.md` (cierre con `npm run check`); rutas `.js` de los docs vivos a `.ts`.
- Fronteras `as` (D8) que quedaban en `src/` al cerrar TS5 — 5 (hoy 3, ver la limpieza de arriba):
  - `core/dom.ts`: `v as EventListener` (attrs `on*` del helper `h`).
  - `core/shell.ts`: `t as Theme` (valor de `localStorage`, validado con `THEMES`).
  - `core/ui/controls.ts`: `emit as Emit` (los constructores de intents vienen de
    JS en el llamado) y `partialModel as AnyModel` (fallback de `disabledWhen`).
  - `core/ui/faults.ts`: `emit as Emit` (ídem).
  - No cuentan los alias de import (`stages as campaignStages`) ni `as const`.
- `npm run check` verde: typecheck, lint 0 warnings, knip, **123 tests** y build.

**Checklist de cierre TS5 en Firefox** (para el usuario, con `npm run dev`):
1. Portada con "Etapas" y "Laboratorio", igual que antes.
2. Laboratorio del combustible: llave on → cebado de la bomba; arranque; sliders,
   fallas y presets funcionan; lecturas y sparklines se mueven; narración; clic
   en una pieza → ficha; tema oscuro legible.
3. Etapas de quiz 1 y 2: preguntas, feedback, puntaje, estrellas, guardado
   (recargar la página conserva el progreso), candado de la etapa 2.
4. F12 sin errores. Con el dev corriendo, meter a mano un error de tipos en un
   `.ts` → aparece el overlay del checker; sacarlo → desaparece.

**Verificado por el usuario en Firefox (2026-09-25): funciona sin errores.**
Informe completo de la migración (qué se hizo y qué errores aparecieron):
`docs/informes/2026-09-25-migracion-typescript.md`.

## CERRADO 2026-09-24 — A2 Quiz E1, HUD, guardado y campaña

- `src/game/save.js`: `crf.save.v1` versionado, storage inyectable (localStorage/Map/memoria);
  corrupto, con forma rara o que lanza → defaults y se juega sin persistir (§27). Sanea entradas.
- `src/game/campaign.js` + `src/game/stages/fuel-quiz-1.js` (sólo `find`, 8 piezas) y
  `fuel-quiz-2.js` (`find`/`name`/`purpose`, todas). Desbloqueo por `unlockAfter`.
- `src/game/modes/quiz.js`: preguntas con semilla por etapa (D10); inyectores 1..4 como un solo
  concepto; distractores de todo el módulo; `purpose` descarta los `why` que nombran la pieza.
  Puntaje = aciertos×10 + 5 por acierto consecutivo extra (la fórmula no estaba fijada en el
  plan); estrellas ≥90/≥70/≥50 %; `recordAnswer` por pieza y `recordStage` al cerrar; `onReset`
  reinicia la partida y deja el motor en marcha. Etapa vacía cierra una vez y se registra.
- `src/ui/hud.js`: pinta el HudModel 6.7 (stats, prompt + choices, tools, actions, suspects,
  log) y emite `answer`/`useTool`/`removeTool`/`markSuspect` y las acciones del modo.
- `src/core/shell.js`: portada con "Etapas" (candado, estrellas y mejor puntaje) + "Laboratorio";
  ruta `#/stage/<id>` con desbloqueo; semilla `seed ^ intento` en cada reintento; retry/quit/
  nextStage desde el HUD; aplica los eventos `highlight` del modo.
- `fuel/view.js`: `part-label` en las 13 etiquetas de **nombre**; los valores (Apagado, 12,6 V,
  rpm, litros, tag del motor, números de inyector) no lo llevan.
- Contrato: `ModeEvent` suma `highlight` (`{partIds, style}`) en `CONTRATOS.md` §6.3. Lo pide el
  plan §6 y el modo es puro (§21): el shell es quien llama al renderer.
- Fuera de la lista de archivos de A2 (§12, anotado): `render/legacy/index.js` (limpia los 4
  estilos de highlight antes de aplicar uno, y sólo hace toggle de deselección con `infoPanel`,
  o sea en el lab) y `styles.css` (HUD, portada y `.correct/.wrong/.target`).
- Tests: 109 en verde (+32: quiz con semilla, distractores, puntaje/racha, estrellas, save con
  memoria/Map/corrupto/roto, campaña, etiquetas). `npm run build` en verde.
- Diferido a A6/A7 (identidad por tipo §23): `recordAnswer` usa el `partId` como clave de
  maestría (los inyectores suman por instancia).
- Conocido: el feedback del quiz dura 1 s de tiempo **simulado**; a 0.05× se estira (contrato
  `update(simDt)`).

**Revisar en Firefox** (`npm run dev`):
1. Portada: "Etapas" con la 1 jugable y la 2 con candado; "Laboratorio" con la tarjeta de
   combustible. Abrir a mano `#/stage/fuel-quiz-1`.
2. Etapa 1: no se leen nombres en el diagrama (nada de "Bomba", "Filtro", "Regulador"…); sí los
   valores (12,6 V, litros, rpm, tag del motor). El motor se ve en marcha desde el arranque.
3. Responder un `find`: acierto → pieza en verde y HUD "¡Correcto! · Aciertos/Puntos"; error →
   la tocada en rojo y el texto dice cuál era. La pregunta avanza sola tras ~1 s.
4. `name`: la pieza objetivo queda con contorno azul punteado y hay 4 botones de nombre.
   `purpose`: el HUD muestra la función entre comillas y 4 nombres.
5. Clic repetido en la misma pieza en un `find` debe responder igual (ya no hace falta el
   segundo clic).
6. Terminar: estrellas, "Reintentar", "Siguiente etapa" y "Volver al taller". Reintentar cambia
   las preguntas; "Siguiente" abre la etapa 2; volver muestra la etapa 1 con estrellas y mejor
   puntaje en la portada.
7. ⟲ reinicia la partida (pregunta 1, 0 aciertos) y deja el motor andando. Pausa y velocidad
   funcionan.
8. F12 sin errores; en la consola `window.__sim.mode.hud()` y `window.__sim.save.get()`
   responden. Repetir el quiz completo mejora el récord de la portada.

## FIX 2026-09-24 — los cables de los inyectores son una pieza propia

Lo notó el usuario jugando el quiz: el cable ECU→inyector llevaba `part: injectorN`
(`view.js:76`), así que tooltip, ficha y clic del quiz decían "Inyector N". Ahora los 4 cables
son `injectorWires` ("Arnés de los inyectores", `content.js`), con ficha y fallas propias; el
inyector sigue siendo sólo su cuerpo. Como el arnés no tiene `.part-body`, en `fuel.css` se
agregaron sus reglas de resaltado (`.signal-wire.selected/.target/.correct/.wrong`). En el
quiz, clicar el cable ya no acierta una pregunta de inyector, y en la etapa 2 el arnés puede
ser una pregunta más (`parts:'all'`). Docs: `modules/fuel.md` §1. Tests: 110 en verde (+1: el
arnés no se agrupa con los inyectores).

**Revisar en Firefox** (`#/lab/fuel` y `#/stage/fuel-quiz-2`):
1. Hover sobre un cable ECU→inyector → tooltip "Arnés de los inyectores"; clic → su ficha
   ("¿Qué es? / ¿Para qué sirve? / ¿Cómo funciona?"). El cuerpo del inyector sigue siendo
   "Inyector N".
2. En el quiz, pregunta de inyector: clic en el cable → incorrecto; clic en el cuerpo (o su
   número) → correcto.
3. En la etapa 2 el arnés puede aparecer como pregunta u opción; si toca `purpose`, el texto
   no lo nombra.

## CERRADO 2026-09-24 — revisión: NaN, reset con overrides, ⟲ y preset

Plan: `plans/2026-09-24-fix-revision-robustez.md`.
- `clamp(NaN)` → `min` (`core/math.js`, tocado como arreglo de revisión §12).
  Antes, `throttle = NaN` o `filterClog = NaN` dejaba `pRail = NaN` para siempre.
- `labMode` rechaza `setParam`/`setFault` con NaN/Infinity o con otro tipo.
- `createFuelModel().reset()` vuelve a los overrides de creación.
- `labMode.onReset()` reinicia la sesión y olvida `activePreset`.
- Tests: 77 en verde (+4: NaN en el modelo, overrides en reset, validación de
  intents, onReset; los 4 fallan sin el arreglo). `npm run build` en verde.

**Revisar en Firefox** (`npm run dev` → `#/lab/fuel`):
1. Clic en un caso de "Casos para probar" → aparece su nota. Clic en ⟲ → la
   nota desaparece, fallas en 0 y llave en "Apagado".
2. Mover sliders de fallas y controles → responden igual que antes.
3. F12, sin errores. En la consola:
   `window.__sim.mode.handle({type:'setParam', key:'throttle', value:NaN})`
   y luego `window.__sim.model.params.throttle` → sigue siendo el valor anterior.

## FIX 2026-09-23 — triángulos cafés entre las tuberías (bug de T4)

Lo reportó el usuario al probar. Las tuberías con codo se rellenaban como
polígonos: `.fluid-fuel { fill }` le gana al atributo `fill="none"` de
`svg.pipe()`. Corregido con `.pipe .pipe-fluid, .pipe .pipe-wall { fill: none }`
en `styles.css`. Trampa anotada en `CONTRATOS.md` (vista). **Revisar**: ya
no deben verse triángulos en la alimentación ni en el retorno; el líquido del
estanque sigue relleno.

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


