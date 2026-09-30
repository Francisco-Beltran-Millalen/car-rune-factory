# Ahora — el trabajo presente

Trabajo vivo entre sesiones (≤500 líneas). Lo cerrado se recorta y queda en
git. Reglas en `ARCHITECTURE.md`, visión en `NORTE.md`, plan original en
`plans/2026-09-22-plan-maestro.md`.

## PARA RETOMAR (escrito al cerrar la sesión del 2026-09-28)

- **Estado**: A15 (laboratorio del vehículo, `vehicle-70` y `vehicle-2000`)
  cerrada y commiteada en `main`, sobre A11–A14, V1 y A16. `npm run check`
  verde, 456 tests.
- **Revisión del usuario**: pendiente para A15 (checklist abajo, en el
  CERRADO) y para las revisiones más viejas que ya venían arrastrándose
  (A14, V1, A16, los dos FIX de flujo de refrigeración/lubricación): conviene
  hacerlas todas juntas ahora, antes de A17, y anotar acá lo que salga mal.
- **Decisión pendiente del usuario, la que sigue de acá**: el orden del
  bloque S2 (A17 eléctrico, A18 admisión, A19 escape, A20 frenos, A21 tren
  motriz, A22 suspensión, A23 dirección, A24 ruedas, A25 carrocería) y si
  abre la puerta del bloque G (juego). Fichas y specs de las nueve ya están
  listas en `FICHAS.md`.
- **Simplificaciones de A15** (no bloquean el cierre; ver el CERRADO para la
  cuenta completa y qué haría falta para sacarlas): un solo solver para todo
  el vehículo (no particionado por componente conexa, D-V3); el diagrama no
  dibuja un riel eléctrico compartido cruzando regiones (cada sistema
  conserva su propia batería dibujada, aunque en la física esté fundida con
  la del proveedor); el mecanismo de 4 tiempos es una caja simple, no el
  inset con vista propia; los botones de acción (`refill`, `changeOil`…) y
  los presets del vehículo no están cableados; `electrical.crankVoltage`
  sigue siendo un stub (12,6 V fijo) en vez de medirse del nodo real del bus.
- **Lo que el chequeo automático no ve** (candidatos si algo se ve raro):
  etiquetas encima de un tubo; trazos que un drawer dibuja por su cuenta
  (cables de alta del distribuidor, arnés de inyectores, manguera de vacío,
  correa de la bomba de agua); el manómetro de `lubrication-gauge` no tiene
  tubo a la galería (es un instrumento `visual`); las dos baterías dibujadas
  por sistema en el vehículo son la misma cosa eléctricamente (nota de
  arriba).
- **Pendiente aparte** (sin fecha): el fix del feedback del quiz (sección
  siguiente); un pedido de core sobre `displacementPump` en
  `docs/core-requests.md` (2026-09-27, no bloquea).
- **Benchmark del vehículo sensible a la CPU de la corrida completa**: solo
  (`npx vitest run tests/vehicle/benchmark.test.ts`) da ~5000 pasos/s, por
  encima del presupuesto de 4000 (§10); compitiendo con el resto de la
  suite en paralelo puede bajar a ~2000-3000 — por eso el test sólo hace
  fallar por debajo de 1500 (una regresión real) e imprime si superó o no
  el presupuesto. `testTimeout` subió a 60 s por la misma razón (ver
  `vite.config.ts`).
- **Cómo mirar un layout sin navegador**: `npm run layout` y
  `rsvg-convert layout-sheets/<id>.svg -o <id>.png`.

## REVISIÓN EN FIREFOX 2026-09-29 (usuario) — hallazgos

Se revisa en orden: primero A15 (`vehicle-70`, luego `vehicle-2000`), después
los laboratorios sueltos. Aquí se anota lo que salga mal, tal cual lo dijo el
usuario, con la causa probable cuando ya se conoce. Nada de esto está
diagnosticado ni arreglado todavía.

**`#/lab/vehicle-70` — primera impresión (no son fallas de física, son de
legibilidad):**

1. **Todo se ve muy pequeño y no se entiende nada.** Los cinco sistemas
   están a la vez en pantalla. Causa probable: grilla de 2 columnas × 3
   filas con celdas de 1400×800 (ver CERRADO de A15), escalada para caber en
   una sola vista.
2. **Los sliders no dan feedback inmediato en los diagramas**, o el cambio
   es demasiado pequeño para verse (mismo problema de escala). Falta
   comprobar cuáles controles sí se reflejan en el diagrama y cuáles no.
3. **No se entiende que es un auto de los 70**: se ven sólo los sistemas
   sueltos, sin nada que los una como un vehículo (carrocería, silueta,
   motor como pieza central, o un esquema que muestre cómo se relacionan).

**En todas las rutas — el panel de controles salía vacío (ARREGLADO, sin
commitear):** los datos estaban bien (cada módulo declara 6–26 controles)
y el modo de laboratorio pide `controls: 'all'`. La causa era una regresión
de la migración a TS (`09d4923`, TS2): `createControlsPanel`
(`src/core/ui/controls.ts`) creaba cada `fieldset` de grupo y le agregaba
los controles, pero perdió el `container.append(fs)` que sí tenía el
`controls.js` original. Los controles existían y se sincronizaban, pero
nunca entraban al DOM. Ningún test lo veía (los tests corren en Node, sin
DOM, y no hay test de `createControlsPanel`). Arreglo: una línea. `npm run
check` verde. Los otros paneles (fallas, mediciones, ficha, HUD, timebar)
sí agregan sus nodos. Pendiente para el usuario: recargar y confirmar que
los sliders, toggles y selects aparecen y se mueven; con eso se puede
reevaluar el hallazgo 2 de arriba (sliders sin feedback), que pudo ser
consecuencia de esto.

**Auditoría de código (2026-09-29, a pedido del usuario: "legibilidad del
diagrama" y "feedback de controles", en todos los laboratorios):**

- **Escala del vehículo, con la cuenta.** El `viewBox` de `vehicle-70` y
  `vehicle-2000` es 2840×2440 (`modules/vehicle/defs.ts`); el de un
  laboratorio suelto es ~1200–1400×680–760. El SVG usa `width/height:100%` con
  `preserveAspectRatio: meet` (`render/svg/index.ts`, `styles.css`), así que
  la escala es `min(ancho/2840, alto/2440)`. Con el área central de un monitor
  1920×1080 (1920 − 180 nav − 360 panel ≈ 1380 × ~990) sale ≈ 0,41; el
  laboratorio suelto sale ≈ 1,06: el texto y las piezas del vehículo quedan
  ~2,6× más chicos. En una laptop 1366×768 (≈ 826 × ~630) sale ≈ 0,26 contra
  0,63: ~2,4× más chico, y el texto de 12–14 unidades pasa a ~3–4 px. Es la
  causa de "muy pequeños"; no es un bug de un drawer.
- **Feedback de controles: medición.** Script desechable (borrado): por cada
  control, corre 2 s simulados con el control en mín y en máx (llave en
  "Marcha" cuando existe) y cuenta cuántos valores del `VisualState` (los
  canales de piezas y los caudales/potenciales de enlaces) difieren. Resultado
  completo en la sesión; lo relevante:
  - **Sin ningún cambio visible en ninguna ruta:** `vehicleSpeedKmh`
    (también en `cooling-viscous` y `cooling-electric`, donde no es un
    override del vehículo), `ignition:humidity` (`ignition-points`).
  - **Sin cambio en el vehículo, con cambio en el laboratorio suelto:**
    `cooling:load` (en `paramsView`, `compile.ts`, `load` se pisa con
    `engine.load` del bus: el slider es letra muerta ahí, y sigue mostrándose),
    `ignition:compression`, `fuel:fastConsumption`.
  - **Controles de un sistema que no es el proveedor de la batería:**
    `ignition:batteryV` y `cooling:batteryV` en `vehicle-2000` cambian 1 valor
    de 357: consecuencia de la batería fundida (PARA RETOMAR); en el vehículo
    hay que esconder o redirigir esos controles.
  - **Cambian pocos valores en total** (1 a 3 canales, probablemente sólo una
    etiqueta): `throttle` en 4 tiempos, `lateralG`, `engineTempC` en el
    carburador suelto, `camOffset` en COP, `batteryV` de refrigeración.
  - **Límite de la medición (no concluir de más):** `crankDeg`,
    `sparkAdvance` y `oilPressure` de 4 tiempos dieron 0, pero sólo se probó
    el `mode` por defecto; probablemente sólo actúan en otro modo y no son
    fallas. La medición cuenta *cuánto* del VisualState cambia, no cuánto se
    ve: un drawer puede ignorar el canal, o el cambio ser de 1 px. Tampoco
    prueba fallas. Falta comprobar en Firefox los casos "cambian poco".

Pendiente: seguir con `vehicle-2000` y los laboratorios sueltos, y anotar
aquí cada hallazgo nuevo.

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
| A6b | Síntomas del combustible: colador, relé intermitente, bomba (plan 2026-09-25 §3.3) | A6 | ✅ |
| A7 | Presenter + renderer SVG genérico del laboratorio; borra `legacyRenderer` y `fuel/view.ts`; quiz sigue jugable (§8.5 + plan 2026-09-25 §3.2) | A6 | ✅ |
| A10 | Plan del vehículo (planificador): `plans/2026-09-26-vehiculo.md` **v3** | A7 | ✅ aprobado 2026-09-26 |
| A11 | Ciclo de 4 tiempos y distribución (spec + plan listos) | A10 | ✅ |
| A12 | Encendido: platinos y COP (spec + plan listos) | A10 | ✅ |
| A13 | Refrigeración (spec + plan listos) | A10 | ✅ |
| A14 | Lubricación (spec + plan listos) | A10 | ✅ |
| V1 | Conexiones visuales: geometría de drawers, `via`, chequeo y hoja de layout (`plans/2026-09-26-conexiones-visuales.md`) | A14 | ✅ |
| A16 | Carburador (spec + plan listos) | A10 | ✅ |
| A15 | Laboratorio del vehículo: `vehicle-70` y `vehicle-2000` (plan del vehículo) | A11–A14, A16 | ✅ |

**Bloque L — legibilidad y foco** (nace de la revisión del 2026-09-29; plan
`plans/2026-09-29-legibilidad-y-foco.md`, fichas en `FICHAS.md`; propuesto,
pendiente de que el usuario responda §6 del plan y lo apruebe):

| # | Tarea | Depende de | Estado |
|---|---|---|---|
| L0 | `realDt` hasta el modo y el renderer (cierra el FIX del quiz) | — | ⏳ |
| H1 | `ControlSpec.affects` y resaltado de lo que cada control toca | L0 | ⏳ |
| H2 | Controles sin efecto: deshabilitar con motivo o corregir | H1 | ⏳ |
| V2 | Regiones, cámara y atenuado en el vehículo | H1, L0 | ⏳ |
| V3 | Chasis y vista de conjunto con indicadores en vivo | V2 | ⏳ |

**Bloque S2 — resto del auto** (después de A15; el usuario elige el orden,
pendiente — ver PARA RETOMAR). Spec y plan listos para todos (`FICHAS.md`):

| # | Tarea | Depende de | Estado |
|---|---|---|---|
| A17 | Eléctrico: batería, arranque y carga (dínamo y alternador) | A15 | ⏳ |
| A18 | Admisión (carburador y EFI; bus de vacío) | A15 | ⏳ |
| A19 | Escape (catalizador, sonda, lazo cerrado) | A18 | ⏳ |
| A20 | Frenos (clásicos y con ABS) | A18 | ⏳ |
| A21 | Tren motriz (RWD y FWD; rpm dinámicas) | A15 | ⏳ |
| A22 | Suspensión (clásica y moderna) | A15 (mejor tras A21) | ⏳ |
| A23 | Dirección (caja y cremallera asistida) | A15 (mejor tras A22) | ⏳ |
| A24 | Ruedas y neumáticos | A15 (mejor tras A22–A23) | ⏳ |
| A25 | Carrocería y chasis: inspección | A15 | ⏳ |

Turbo y diésel: sin plan hasta que el usuario diga si entran.

**Puerta:** el bloque G empieza sólo cuando el usuario lo escriba aquí.

**Bloque G — juego** (en espera)

| # | Tarea | Depende de | Estado |
|---|---|---|---|
| A3 | Diagnóstico E2 con la enmienda `plans/2026-09-25-a3-revision.md` (volver a medir su tabla) | puerta | ⏸ |
| G1 | Checkpoint de juego del usuario (plan motor-y-juice §3) | A3 | ⏸ |
| A8 | Prueba de juice → `docs/decisiones/0001-motor.md` (motor-y-juice §4) | G1 | ⏸ |
| D-motor | Decisión del usuario; afecta al juego, el laboratorio sigue en SVG | A8 | ⏸ |
| A9 | Armar circuitos E4 (plan propio) | D-motor | ⏸ |

**Planes (2026-09-26)**: el agente planificador escribió la spec
(`docs/modules/<id>.md`) y el plan (`docs/plans/2026-09-26-<id>.md`) de
todos los sistemas, A11–A25, y alineó el plan del vehículo (v3). El usuario
aprobó el plan del vehículo el 2026-09-26; A11–A14, V1 y A16 (carburador) ya
estaban implementadas, y A15 (este CERRADO) armó `compileVehicle` y los dos
vehículos genéricos sobre todas ellas. Sigue el bloque S2, en el orden que
el usuario elija (PARA RETOMAR).

## CERRADO 2026-09-28 — A15: Laboratorio del vehículo

Plan: `plans/2026-09-26-vehiculo.md` v3, §3–§10 y §12. Specs de A11–A14 y A16
(§12 de cada una: qué publica/lee cada sistema en el vehículo). `npm run
check` verde (**456** tests, +29 sobre los 427 previos, ya con los dos fixes
de flujo del 2026-09-27 cerrados antes de empezar A15). Informe con las
dificultades, dónde el plan no alcanzaba a bajar a código y qué queda
pendiente: `informes/2026-09-28-vehiculo.md`.

- **Plomería del core, nueva o extendida** (todo con test):
  - `switch` (`sim/elements/electric.ts`): param `rampMs` — conmutación
    suave, lineal en logaritmo (`g = gOff·(gOn/gOff)^p`), con `p` como
    estado interno que sólo avanza en `commit()` (§24), no en `eval`.
    `rampMs = 0` (default) es exactamente el comportamiento de siempre.
  - Elemento `breach` (`sim/elements/hydraulic.ts`, plan §10.4): cruce de
    fluidos por falla, dos puertos de fluido distinto gateados por
    `severity`. Nuevo `ElementTypeInfo.crossFluid` y `CircuitPartDef.fluid2`
    (`validateCircuit` rechaza `fluid2` en un tipo que no sea `crossFluid`).
    Vive registrado y testeado; ningún vehículo lo usa todavía como falla
    jugable (cooling sólo expone el nodo, spec propia).
  - `CircuitDef.buses` (nuevo campo): puertos de un sistema que pertenecen a
    un bus del vehículo (`ports`, `source?`); `compileNet` los pre-registra
    aunque su elemento esté excluido (el `source` de un sistema que no es el
    proveedor), para que los enlaces que los mencionan igual se funden.
  - `compileNet`/`solverElementsOf` (`sim/circuit/net.ts`): la red de
    `compileCircuit` (nodos, elementos, `portToNode`) factorizada para que
    `compileVehicle` compile cada sistema por separado antes de fundir sus
    buses. `compileCircuit` mismo no cambió de comportamiento (mismos tests).
  - `translateCircuit` (`sim/circuit/translate.ts`): desplaza `x/y` y los
    `via`, prefija ids `sistema:pieza` (nunca `sistema.pieza`, §3.1 del
    plan) en parts/links/controllers/probes/fixed/initial/buses.
  - `createVehicleBus` (`sim/signals/bus.ts`): mismo contrato `LabBus` que ya
    usa cada controlador de sistema, pero con **varios dueños validados**
    (uno por señal) en vez de uno solo; una señal sin dueño cae al stub
    ideal, igual que el laboratorio.
  - `createVehicleEngineCore` (`sim/controllers/engineCore.ts`, plan §4.8):
    mismo cerebro que el `engineCore` de A6, pero con spark/compresión/
    tensión de arranque/sincronía de la ECU/balance entre cilindros/
    ebullición reales del bus (no los stubs ideales), y `mix = fuel.mixture /
    air.ratio`. `four-stroke` sigue siendo dueño de `crankAngle`/`camAngle`
    (nunca los toca). El `engineCore` de laboratorio (A6, `fuel`) no cambió
    una línea: son dos funciones separadas que comparten sólo la tabla de
    constantes `ENGINE`.
- **`compileVehicle`** (`src/modules/vehicle/compile.ts`): funde las redes de
  los sistemas en **un solo solver** (simplificación deliberada de A15 sobre
  D-V3 — el plan preveía un solver por componente conexa; el benchmark de
  abajo mide que sobra margen igual, así que particionar queda como
  optimización futura si algún día hiciera falta). `fuel` (A6, con su propio
  `FuelSignals`, no `LabBus`) se conecta con un puente chico
  (`modules/vehicle/fuelBridge.ts`) que no toca `modules/fuel/controllers.ts`:
  ocupa el lugar de `engineCore`/`fuelSupply` en la lista de controladores de
  `fuel` para copiar bus↔`FuelSignals`, publicar `fuel.mixture`, cortar los
  inyectores sin `ecu.sync` y cerrar el relé de la bomba de verdad (antes
  siempre cerrado, cortando por tensión; en el vehículo usa el `switch` con
  `rampMs` de arriba, porque acá si lo compuertan apaga el bus entero).
  `vehicleModule(def)` (`modules/vehicle/index.ts`, D-V1) arma el
  `ModuleDescriptor`: traduce controles/fallas/catálogo/mediciones/piezas/
  relato/presenter de cada sistema con su prefijo, deduplicando los
  controles de los params compartidos (`ignitionKey`, `throttle`, `rpm`,
  `vehicleSpeedKmh`).
- **Bug de integración encontrado al armar el circuito compuesto** (no es de
  A15: ya estaba, sólo se nota con ids prefijados): `cooling`'s
  `hasElectricFan()` y los `subOwner` de sub-piezas (`heaterValve`,
  `filterBypass`, `needleValve`…) buscaban el id **sin prefijo** contra
  `def.parts`/las claves de `subparts`. Con `sistema:pieza` (§3.1) nunca
  coincidían: la variante eléctrica de refrigeración se dibujaba como si
  fuera viscosa, y varias sub-piezas quedaban "sin dibujar" para
  `checkLayout`. Arreglado en dos lugares genéricos (no por drawer):
  `render/svg/layout.ts` registra un alias con prefijo al mapear
  `subOwner`, y `subOf()` prueba sin el prefijo si la clave completa no
  está; `cooling/loop.ts`'s `hasElectricFan` prueba también `.endsWith(':fanMotor')`.
- **Dos vehículos genéricos** (`modules/vehicle/defs.ts`): `vehicle-70`
  (carburador + platinos + OHV cadena + refrigeración viscosa + lubricación
  con manómetro, proveedor del bus `12v` el encendido) y `vehicle-2000`
  (inyección + COP + DOHC + refrigeración eléctrica + lubricación con
  testigo, proveedor el combustible). Grilla de 2 columnas × 3 filas
  (1400×800 por celda) para que los cinco laboratorios (cada uno hasta
  1300×720) no se pisen; el mecanismo de 4 tiempos es una caja simple
  (`mechanismInset`, drawer nuevo), no el inset con vista propia que
  describe el plan §9 — simplificación anotada, no bloquea.
- **`tests/vehicle/compile.test.ts`**: humo de los dos vehículos (arranca,
  converge, sin NaN) y un test de fusión eléctrica real: el nodo
  `ignition:battery.+` y el que usa `lubrication:key.a` son **el mismo**
  nodo del solver (no dos circuitos separados con el mismo número por
  casualidad), y bajar `ignition:batteryV` a 9 V baja de verdad el potencial
  que ve lubricación.
- **Benchmark** (`tests/vehicle/benchmark.test.ts`, plan §10): `vehicle-2000`
  fusionado da ~5000 pasos/s solo (mejor de 3 tandas de 1000 pasos), por
  encima del presupuesto de 4000 de A4; sólo 29 nodos libres, 7 iteraciones
  de Newton. Corriendo junto al resto de la suite en paralelo baja a
  ~2000-3000 por la CPU compartida (ver PARA RETOMAR): el test hace fallar
  por debajo de 1500 (así se detectó una regresión real de 1398 pasos/s
  antes de cachear las vistas de `params`/`faults`/`elements` por sistema,
  ver el comentario en `compile.ts`), no el número exacto del presupuesto.
- **`tests/render/layout.test.ts`**: los dos vehículos, 0 problemas;
  hojas de `npm run layout` revisadas (mirar bien, no en Firefox): sin
  piezas fuera del lienzo ni superpuestas, aunque las etiquetas se pisan un
  poco en algunos puntos (lo mismo que ya pasaba en los laboratorios
  sueltos: el chequeo no mira etiquetas).
- **`docs/CONTRATOS.md`** §4.12 (`VehicleDef`) y §4.13 (`compileVehicle`,
  pasos y simplificaciones); **`ARCHITECTURE.md`** §11 actualizado (ya no
  dice "un orquestador que copia señales", describe `compileVehicle`);
  **`solver.md`** filas de `switch.rampMs` y `breach`, nota de `crossFluid` y
  `CircuitDef.buses`; **`SISTEMAS.md`** el ítem "Vehículo" pasa a ✅.
- **No hecho, anotado como simplificación** (ninguno bloquea el cierre; se
  detalla en PARA RETOMAR): panel de señales / `ModeUi.signals` (plan §9);
  riel eléctrico dibujado cruzando regiones; acciones (`refill`,
  `changeOil`…) y presets del vehículo; `electrical.crankVoltage` medido del
  bus real en vez de stub.

**Checklist de Firefox** (`npm run dev`):

`#/lab/vehicle-70` y `#/lab/vehicle-2000` (los dos):
1. Arranca con la llave en "Arranque" y sube a "Marcha" con los controles
   compartidos (llave, acelerador, rpm) arriba de todo, una sola vez (no un
   control por sistema).
2. **Falla cruzada eléctrica** (plan §9): bajar la tensión de batería del
   sistema que provee el bus (`ignition:batteryV` en vehicle-70,
   `fuel:batteryV` en vehicle-2000) debe verse en OTRO sistema eléctrico del
   mismo vehículo (el testigo de lubricación más tenue, el ventilador de
   refrigeración más lento, o el encendido/inyección fallando) — no sólo en
   el sistema donde se movió el control.
3. Cada uno de los cinco laboratorios (4 tiempos como caja simple, el resto
   con su diagrama completo) se ve como en su propia ruta de laboratorio
   (`#/lab/ignition-points`, etc.), sin tubos sueltos ni piezas fuera de
   cuadro.
4. F12 sin errores; tema oscuro legible.
5. Los laboratorios sueltos (`#/lab/fuel`, `#/lab/ignition-cop`,
   `#/lab/cooling-*`, `#/lab/lubrication-*`, `#/lab/carburetor`, 4 tiempos)
   y el quiz siguen funcionando igual que antes de A15.

## Historial recortado

Los CERRADO/FIX/REVISIÓN anteriores a A11 (A0–A7, A6b, TS5, fixes del
2026-09-23/24) se recortaron el 2026-09-26 para respetar el límite de
líneas; están en git (`git log -p -- docs/AHORA.md`, antes de `7533045`).
Los CERRADO de A11 (4 tiempos), A12 (encendido) y A13 (refrigeración) se
recortaron el 2026-09-27 por el mismo motivo; están en git (antes del commit
de A16). Los CERRADO de los dos FIX de flujo (2026-09-27), A16 (carburador)
y V1 y A14 se recortaron el 2026-09-28 al cerrar A15; están en git (antes de
ese commit).

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


