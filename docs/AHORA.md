# Ahora — el trabajo presente

Trabajo vivo entre sesiones (≤500 líneas). Lo cerrado se recorta y queda en
git. Reglas en `ARCHITECTURE.md`, visión en `NORTE.md`, plan original en
`plans/2026-09-22-plan-maestro.md`.

## PARA RETOMAR (escrito al cerrar la sesión del 2026-09-27)

- **Estado**: A11–A14, V1 y A16 (carburador) cerradas y commiteadas en
  `main`. `npm run check` verde, 410 tests.
- **Revisión del usuario**: pendiente. No se recorrieron punto por punto las
  checklists de A14, V1 ni A16 (abajo): conviene hacerlo al empezar, antes de
  A15, y anotar aquí lo que siga mal.
- **Lo que el chequeo automático no ve** (candidatos si algo se ve raro):
  etiquetas encima de un tubo; trazos que un drawer dibuja por su cuenta
  (cables de alta del distribuidor, arnés de inyectores, manguera de
  vacío, correa de la bomba de agua); el manómetro de `lubrication-gauge`
  no tiene tubo a la galería (es un instrumento `visual`).
- **Siguiente tarea: A15 — Laboratorio del vehículo** (`FICHAS.md` y
  `plans/2026-09-26-vehiculo.md` v3). Ya tiene anotado mover los `via` sobre
  el vehículo compuesto y correr `checkLayout` sobre él.
- **Pendiente aparte** (sin fecha): el fix del feedback del quiz (sección
  siguiente); un pedido de core sobre `displacementPump` en
  `docs/core-requests.md` (2026-09-27, encontrado al implementar A16: corte
  duro en `pMax` que puede trabar a Newton — no bloquea A15, se esquivó con
  un `slip` en el módulo).
- **Cómo mirar un layout sin navegador**: `npm run layout` y
  `rsvg-convert layout-sheets/<id>.svg -o <id>.png`.

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
| A15 | Laboratorio del vehículo: `vehicle-70` y `vehicle-2000` (plan del vehículo) | A11–A14, A16 | ⏳ |

**Bloque S2 — resto del auto** (después de A15; el usuario elige el orden al
cerrar A15). Spec y plan listos para todos (`FICHAS.md`):

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
aprobó el plan del vehículo el 2026-09-26; A11, A12, A13 y A14 ya están
implementadas, y V1 rehízo las conexiones visuales de todos los
laboratorios (ver los CERRADO de abajo). A16 (carburador) ya está
implementada. Sigue A15, en orden.

## CERRADO 2026-09-27 — A16 Carburador

Plan: `plans/2026-09-26-carburetor.md`; spec: `modules/carburetor.md`. Un
descriptor (`carburetor`), ruta `#/lab/carburetor`. `npm run check` verde
(**410** tests, +37 sobre los 373 previos).

- **Elemento nuevo**: `flowSource` (`src/sim/elements/hydraulic.ts`), caudal
  impuesto `a→b` con jacobiano nulo — los surtidores de la cuba al múltiple.
  Test de ley en `tests/sim/elements.test.ts`; filas en `solver.md` §6 y
  `CONTRATOS.md` §4.10.
- **Física** (`venturi.ts`, `transient.ts`, `controllers.ts`): depresión del
  venturi, fracción del principal, proporción de régimen `r` (= 1 por
  construcción cuando el carburador está sano), retraso de la bencina
  (τ = 0,25 s) y bomba de aceleración exactamente como pide la spec §5; los
  9 casos de la grilla sano (rpm × mariposa) dan mezcla en [0,97; 1,03] sin
  tocar ninguna constante de la spec.
- **Dos ajustes de robustez, no pedidos por el plan** (ARCHITECTURE §6 y
  §14, con la cuenta en `modules/carburetor.md` §5.4): la bomba mecánica usa
  `slip = 30` (el plan decía 0) y la apertura de la aguja tiene un piso
  (`needleSafeFloor = 0,08`, redondea a 0 por debajo). Sin esto, cualquier
  falla que empujara el punto de operación cerca de `pMax` (bomba gastada,
  filtro tapado, aguja casi cerrada) hacía que el solver **fallara todos los
  pasos siguientes sin parar** — no da NaN, el estado queda congelado, así
  que sólo lo detecta un test que exija `failures === 0` (se agregó ese
  chequeo al fuzz, 60 combinaciones × 500 pasos). Causa de fondo (un corte
  duro sin cola suave en `displacementPump.lim` más allá de `pMax`) anotada
  en `docs/core-requests.md` (2026-09-27): no bloquea, pero conviene una
  tarea de core más adelante.
- **Circuito**: red de bencina real (estanque → bomba mecánica → filtro →
  aguja → cuba → surtidores, fluido `fuel`); el aire y la mezcla no pasan
  por el solver (spec §1), los calcula `carbCore` a partir de `air.massFlow`
  del bus. `needleValve` y `pumpOutNode` son piezas sin `visual` propio: la
  aguja es sub-pieza de `floatBowl` (`joinedBy`) y el nudo de la bomba es un
  `tee` sin dibujo (plan V1).
- **Drawers nuevos** (`render/svg/drawers/carburetor/`): `carbBody` (venturi,
  mariposa, surtidores, tornillo de mezcla, bomba de aceleración, boca de
  aire, todos sub-dibujos sin geometría propia porque no están en la red del
  solver), `floatBowl` (cuba, flotador, aguja), `mechPump` (excéntrica,
  diafragma, fuga) y `choke`. Reutiliza `tank`, `filter` y `hosePoint` ya
  existentes. `tests/render/layout.test.ts`: 0 problemas; hoja de
  `npm run layout` revisada.
- Tests: `tests/carburetor/{venturi,transient,model,faults,content}.test.ts`
  (35) + el de `flowSource` en `tests/sim/elements.test.ts`.

**Checklist de Firefox** (`npm run dev`) — la del plan §5:

`#/lab/carburetor`:
1. En ralentí sale bencina por el orificio bajo la mariposa; al subir rpm y
   mariposa empieza a pulverizar el surtidor del venturi y el de ralentí se
   apaga.
2. La cuba: el flotador sube, la aguja cierra, y la bomba mecánica late con
   la excéntrica (gira a rpm/2).
3. "Partida en frío con choke": sin choke la mezcla queda en ~50 %; con
   choke tirado, ~100 %. "Se olvidó el choke": rica.
4. "Tironea al pisar": al mover la mariposa de golpe la mezcla cae un
   momento; con la bomba sana se ve el chorro y no cae.
5. "Se ahoga": la cuba rebalsa y la mezcla se dispara.
6. "Se para en la subida": a fondo la cuba baja hasta vaciarse.
7. Combustible, 4 tiempos, encendido, refrigeración, lubricación y quiz
   siguen funcionando; F12 sin errores.

## CERRADO 2026-09-26 — V1 Conexiones visuales

Plan: `plans/2026-09-26-conexiones-visuales.md` (pedido del usuario: "hay
varias mangueras y diagramas que no tienen conexión unas con otras").
`npm run check` verde (**373** tests).

- **Causa**: las puntas de cada manguera eran coordenadas escritas a mano
  en `route`, sin relación con el dibujo de la pieza; un enlace con `route`
  y sin `visual` se dibujaba igual (color combustible, también las
  referencias del modelo); las piezas dibujadas dentro de otro drawer
  (fusible/relé/motor del electroventilador, llave del calefactor, rejilla)
  recibían cables a su `x/y`, donde no había nada. Nada lo detectaba.
- **Core**: `DRAWERS` pasa a `{ geometry, draw }` con geometría pura (caja,
  puertos en el borde, sub-piezas, `container`, `inline`);
  `CircuitLinkDef.route` → `via` (sólo codos; puntas desde la geometría);
  se dibuja sólo lo que trae `visual`; `CircuitPartDef.joinedBy`; punto de
  unión en nudos con 3+ tubos. `src/render/svg/layout.ts` con
  `checkLayout` (11 códigos de error) y `renderLayoutSheet`;
  `tests/render/layout.test.ts` recorre todo el registro; `npm run layout`
  escribe las hojas en `layout-sheets/` (ignorada por git). Se borró
  `route.ts` (`autoRoute`) y su test. Drawer genérico `hosePoint`.
- **Laboratorios rehechos** (todos pasan el chequeo; hojas revisadas):
  - Refrigeración: circuito cerrado bomba → motor → termostato → radiador →
    retorno a la bomba, con el bypass (ahora visible, `hosePoint`), el
    calefactor con su llave y el depósito sobre el mismo retorno.
    Eléctrico: batería → fusible → relé → motor, en fila bajo el ventilador
    y con masa dibujada; en la variante viscosa ya no se dibujan (antes sí).
    Correa de la bomba a una polea del cigüeñal (antes salía del lienzo).
  - Lubricación: cárter → rejilla → bomba → alivio / filtro (+ bypass) →
    galería → bancada, bielas y levas → retorno al cárter. El interruptor
    de presión pasa a ser su pieza (`oilPressureSwitch`), atornillado a la
    galería, con masa por el bloque y cableado al testigo del tablero.
  - Combustible y encendido: migrados a `via` con el mismo aspecto; la
    línea de alimentación es un punto sobre su tubo; el riel une nudo,
    inyectores y regulador por `joinedBy`.
  - Batería: bornes `−` (izquierda) y `+` (derecha) marcados; los cables
    salen de los bornes.
- **Bugs de paso**: el encendido cerraba `startBridge` pero la pieza se
  llamaba `bridge`: **el puente del balasto nunca se cerraba en Arranque**.
  Se renombró la pieza, se dibuja ("Puente (arranque)", cierra en Arranque)
  y tiene ficha. En refrigeración, `fanOn` (booleano) se leía como número y
  el relé nunca se veía cerrado. Los canales de sub-piezas del ventilador
  no llegaban a ningún drawer: ahora van al del ventilador.
- **Lo que el chequeo no ve** (se mira en Firefox): etiquetas sobre tubos y
  trazos que un drawer dibuja por su cuenta (cables de alta del
  distribuidor, arnés de inyectores, manguera de vacío).
- **Revisión del usuario (2026-09-26)**: "está mejor". Falta recorrer la
  checklist punto por punto (ver PARA RETOMAR).
- **Fases siguientes**: la convención y la aceptación quedaron en
  `FICHAS.md` (Contexto común); A15 (ficha y plan del vehículo) desplaza
  `via` y corre el chequeo sobre el vehículo compuesto.

**Checklist de Firefox** (`npm run dev`), en **cada** laboratorio: ninguna
manguera ni cable termina en el aire; cada tubo entra a su pieza por un
borde; ninguno pasa por encima del cuerpo de otra pieza; colores del fluido
(aceite ámbar, refrigerante verde agua, combustible, eléctrico azul).

1. `#/lab/cooling-electric`: batería → fusible → relé → motor del
   ventilador; a 100 °C el brazo del relé cierra y el termocontacto se
   pone verde. Bypass, calefactor y depósito llegan al tubo de retorno.
2. `#/lab/cooling-viscous`: el ventilador sólo con embrague (sin fusible,
   relé ni motor).
3. `#/lab/lubrication-lamp` y `-gauge`: el recorrido completo del aceite sin
   tubos sueltos; con la llave en "Contacto" el interruptor de presión se
   ve cerrado y el testigo prendido; en marcha abre.
4. `#/lab/ignition-points`: en "Arranque" el puente cierra (y con el
   balasto cortado el motor sigue con chispa); en "Marcha" abre.
5. `#/lab/ignition-cop`, `#/lab/fuel` y los de 4 tiempos se ven como antes
   (con los cables saliendo de los bornes); el quiz sigue jugable.
6. Tema oscuro: los puntos de unión y las masas se ven.

## CERRADO 2026-09-26 — A14 Lubricación

Plan: `plans/2026-09-26-lubrication.md`; spec: `modules/lubrication.md`. Dos
descriptores (`lubrication-gauge`, `lubrication-lamp`) y la ruta
`#/lab/lubrication` → `lubrication-lamp`. `npm run check` verde (**358**
tests). `typescript-eslint` acepta TS `>=4.8.4 <6.1.0` (paso 1 del plan).

- **Core nuevo**: elementos `displacementPump` (in/out; `disp`, `slip`,
  `pMax`, `wearQ`; control `n`, `air`, `wear`, `slipFactor`) y
  `linearRestrictor` (`q = g·Δp`), y el control `drain` del `tank`; ley +
  jacobiano contra diferencias finitas. El `reliefRegulator` suma sondas `q`
  y `open`. Filas en `modules/solver.md` §6 y `CONTRATOS.md` §4.10.
- **Física sin calibrar** (§14): las constantes son las de la spec §5.
  Medido a 1,5 s, 10W-40: 100 °C → 1,14 / 2,86 / 4,28 / 4,52 bar a
  800/2000/3000/6000 rpm; grados en ralentí caliente 0,82 / 1,14 / 1,47;
  cojinetes 0,2/0,5/1 → 0,68 / 0,36 / 0,15; bomba gastada 0,44 y 1,66. Única
  diferencia con la tabla §5.7: 120 °C a 6000 rpm da 4,23 (no 4,5) porque la
  galería está aguas abajo del filtro (0,4 bar a 2400 L/h) y la cuenta del
  planificador no lo sumaba; no hay test sobre ese punto.
- **Arreglos de la revisión** (la sesión anterior quedó cortada antes de
  cerrar):
  - *Ciclo límite de la cavitación*: con el paso de retraso (§25) el lazo
    aire → caudal → presión de aspiración tenía ganancia ≈ 7 y oscilaba cada
    paso (aire 0,8 ↔ 0,04, caudal 148 ↔ 880 L/h) y hacía fallar al solver. El
    aire por cavitación ahora se filtra con `cavTau = 50 ms` (ganancia
    efectiva ≈ 0,15). El test 14 ahora exige `failures === 0` en las 200
    combinaciones del fuzz (fue el que lo encontró) y el test 9 fija que no
    oscila.
  - rpm y carga se leen del bus (`engine.rpm`, `engine.load`, spec §12/§29);
    el stub del laboratorio da rpm sólo con la llave en `run`.
  - Presenter: los tubos del alivio y del filtro mostraban el caudal de la
    bomba (y el de la salida del filtro el del bypass); ahora usan `qRelief` y
    el caudal real del filtro (sonda nueva `qFilter`). Los canales de piezas
    dibujadas dentro de otro drawer (rejilla, tapón, interruptor de presión,
    antirretorno) nunca llegaban (el renderer entrega por id de pieza): se
    movieron al drawer que las dibuja. El interruptor se dibujaba siempre
    abierto; ahora cierra bajo 0,5 bar (o según la falla), con o sin llave.
  - Narración del aceite frío: `qRelief > 1 L/h` (el `softRelu` nunca es 0).
  - Tests nuevos: acciones de nivel + `reset`, fuga de la junta y goteo del
    tapón, golpeteo, testigo con llave apagada.
- **Desviaciones anotadas**:
  - Golpeteo (§5.5) `·carga` con `engine.load`; como el laboratorio no tiene
    acelerador, el stub de carga es `rpm/6500`.
  - Temperatura del aceite en el vehículo (§5.3: sigue a
    `engine.coolantTemp + 10·load` con τ = 120 s) **no está implementada**:
    el controlador usa el param `oilTempC` también dentro del vehículo. Queda
    para A15 (cómo convive el slider del laboratorio con la señal).
  - Los 8 drawers viven en un solo archivo `drawers/lubrication/oil.ts`
    (~220 líneas) en vez de uno por pieza; las fallas se prueban en
    `model.test.ts` (no hay `faults.test.ts`).
  - `changeOil()` sólo repone 4 L: no hay estado de suciedad que limpiar.
- Tests: `tests/lubrication/model.test.ts` (19), `content.test.ts` (12) y los
  de elementos.

**Checklist de Firefox** (`npm run dev`) — la del plan §6:

`#/lab/lubrication-lamp`:
1. Llave en "Contacto": testigo prendido y el interruptor dibujado cerrado;
   al pasar a "Marcha" se apaga en < 1 s y el interruptor abre.
2. "Arranque en frío": presión al tope (~4,5 bar) y la bola del alivio
   bajada, con caudal por el tubo de retorno; al subir `oilTempC` a 100 baja
   la presión en ralentí (~1,1 bar).
3. "Cojinetes gastados": en ralentí caliente se prende el testigo; al
   acelerar se apaga. Los cascos se ven con borde de aviso.
4. "Poco aceite en las curvas": al subir la fuerza lateral el aceite se
   inclina, aparecen burbujas en el cárter y cae la presión; **no debe
   parpadear cuadro a cuadro** (era el ciclo límite).
5. "Filtro tapado": la chapaleta de bypass se abre, el filtro se ve sucio y
   el Δp marca ~1 bar.
6. "Motor sin aceite": el daño sube hasta que se agarrota (narración) y los
   engranajes de la bomba se detienen.
7. Falla "Antirretorno vencido" (el punto del filtro se pone rojo): con la
   llave en "Contacto" espera 60 s y pasa a "Marcha": unos 3 s sin presión.
8. Falla "Rejilla tapada" a fondo y 6000 rpm: la rejilla se oscurece y la
   bomba aspira aire; falla "Tapón del cárter gotea": cae una gota bajo el
   cárter.

`#/lab/lubrication-gauge`: el manómetro sigue la presión (con retardo corto)
y el filtro dice "de cartucho", sin punto antirretorno. Los demás
laboratorios y el quiz siguen funcionando; F12 sin errores.

## Historial recortado

Los CERRADO/FIX/REVISIÓN anteriores a A11 (A0–A7, A6b, TS5, fixes del
2026-09-23/24) se recortaron el 2026-09-26 para respetar el límite de
líneas; están en git (`git log -p -- docs/AHORA.md`, antes de `7533045`).
Los CERRADO de A11 (4 tiempos), A12 (encendido) y A13 (refrigeración) se
recortaron el 2026-09-27 por el mismo motivo; están en git (antes del commit
de A16).

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


