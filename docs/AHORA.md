# Ahora — el trabajo presente

Trabajo vivo entre sesiones (≤500 líneas). Lo cerrado se recorta y queda en
git. Reglas en `ARCHITECTURE.md`, visión en `NORTE.md`, plan original en
`plans/2026-09-22-plan-maestro.md`.

## PARA RETOMAR (escrito al cerrar la sesión del 2026-09-26)

- **Estado**: A11–A14 y V1 (conexiones visuales) cerradas y commiteadas en
  `main` (último: `7533045`). `npm run check` verde, 373 tests.
- **Revisión del usuario**: miró los laboratorios después de V1 y dijo
  "está mejor". No se recorrieron punto por punto las checklists de A14 ni
  de V1 (abajo): conviene hacerlo al empezar, antes de A16, y anotar aquí lo
  que siga mal.
- **Lo que el chequeo automático no ve** (candidatos si algo se ve raro):
  etiquetas encima de un tubo; trazos que un drawer dibuja por su cuenta
  (cables de alta del distribuidor, arnés de inyectores, manguera de
  vacío, correa de la bomba de agua); el manómetro de `lubrication-gauge`
  no tiene tubo a la galería (es un instrumento `visual`).
- **Siguiente tarea: A16 — Carburador** (`FICHAS.md`). Además de su ficha,
  vale la convención de conexiones del Contexto común: su drawer exporta
  geometría, los enlaces usan `via` y la aceptación incluye
  `tests/render/layout.test.ts` + revisar la hoja de `npm run layout`.
  Después: A15 (vehículo), que ya tiene anotado mover los `via`.
- **Pendiente aparte** (sin fecha): el fix del feedback del quiz (sección
  siguiente).
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
| A16 | Carburador (spec + plan listos) | A10 | ⏳ |
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
laboratorios (ver los CERRADO de abajo). Sigue A16, en orden.

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

## CERRADO 2026-09-26 — A13 Refrigeración

Plan: `plans/2026-09-26-cooling.md`; spec: `modules/cooling.md`. Dos
descriptores (`cooling-viscous`, `cooling-electric`) y la ruta vieja
`#/lab/cooling` → `cooling-electric`. `npm run check` verde (**324** tests).

- **Core nuevo**: dominio `thermal` (°C/W/J/K) en `Domain`; `setPotential` en
  el solver (escribe `x`/`xStart` de un nodo libre y no toca los fijos) con
  su test; `CircuitDef.initial` aplicado al compilar y en `reset`, con test;
  elementos `centrifugalPump` y `variableOrifice` (los reusan A16/A18/A23);
  elementos térmicos `heatSource`, `thermalConductance`, `advection`,
  `heatCapacity`; y tres que el plan no listaba (§12, anotado):
  `temperatureSource` (el ambiente fijo, hacía falta), `hydroNode` y
  `thermalNode` (nudos `joint`/`multiple` para las redes de A13).
  `restrictor` y `leak` suman sonda `q`. Conservación de la advección en un
  lazo cerrado de 3 nodos probada (±1e-6 relativo).
- **Física**: en la bomba centrífuga `Δp = p_out − p_in` (el signo inicial
  estaba al revés y Newton quedaba oscilando en 0; se corrigió, no se tocó la
  ley). `fastThermal` escala los controles (×20) y el estado publica sin
  escalar; la advección se pasa por controlador (§25); nivel, aire de nivel y
  de ebullición, presión de tapa, ventilador por histéresis (eléctrico) o
  acople viscoso, sensor que miente y códigos quedan como pide la spec.
- **Único ajuste de constante** (§14): `thermostatLeak` 2 % → **1 %**. Con el
  2 % el `stuckClosed` se estabilizaba en ~126 °C y **no hervía** (el test 8
  pide >120 °C *y* `boiling` a los 15 min); con 1 % hierve (~10 min) y el
  calentamiento en ralentí sigue cruzando 85 °C a los 21,6 min (rango 15–30).
- **Desviaciones anotadas**: el test 11 (manguera rota) corre **sin**
  `fastThermal` porque el nivel no es un flujo térmico y con ×20 la fuga no
  drenaba 1,5 L en el tiempo del test; el test 12 deja asentar el calefactor
  30 s (la masa térmica del núcleo tiene τ ~9 s). El escenario "panal tapado a
  fondo" (test 10) pasa de 104 °C y sigue subiendo con ebullición: el modelo
  no acota ese runaway (el rango del test sólo pide >104).
- **Vista**: drawers nuevos (`engineJacket`, `waterPump`+`pumpBelt`,
  `thermostat`, `radiator`+`radiatorCap`, `fan` con motor/termocontacto/relé/
  fusible o embrague, `expansionTank`, `heaterCore`, `tempGauge`+`tempSensor`)
  y `cooling.css`. Para colorear el refrigerante por temperatura se agregaron
  `visual.potentialRange` al renderer y `Flow.setTint` (escribe `--t` en el
  tubo y las partículas; el CSS interpola con `color-mix`).
- **Core config**: `vite.config.ts` sube `testTimeout` a 30 s: las
  simulaciones largas de A13 compiten en paralelo y hacían fallar por tiempo
  tests viejos de 5 s (el test 8 de combustible). `eslint.config.js` extiende
  la excepción de `type` a `controllers` (el `core`/`mechanism` de A11/A12 y
  los nuevos `constants/gas/timing/events` ya estaban). `router.ts` suma el
  alias `cooling`.
- Tests: `tests/cooling/model.test.ts` (17), `content.test.ts` (12) y los de
  elementos/nodal/circuito.

**Checklist de Firefox** (`npm run dev`) — la del plan §6:

`#/lab/cooling-electric`:
1. "Calentar desde frío": las partículas van del azul al rojo en el motor;
   hasta ~88 °C todo circula por el bypass; después se abre el termostato y
   el radiador se entibia.
2. En ralentí caliente el ventilador se prende a 100 °C y se apaga a 95.
3. "Tráfico con el ventilador muerto": la temperatura sube pasando 105 °C;
   con la tapa fallada hierve antes (aparece vapor y burbujas).
4. "Termostato pegado abierto en invierno": no pasa de ~50 °C.
5. "Manguera rota": gotea, baja el nivel del depósito y luego aparecen
   burbujas y sube la temperatura.
6. "El reloj miente": el motor está rojo y el reloj marca 30 °C menos.
7. El calefactor calienta la cabina (kW en lecturas) y tapado casi no.

`#/lab/cooling-viscous`: el ventilador gira con el motor y acopla más con el
radiador caliente; embrague gastado → recalienta en tráfico.

Combustible, 4 tiempos, encendido y quiz siguen funcionando; F12 sin errores.

## CERRADO 2026-09-26 — A12 Encendido (platinos y COP)

Plan: `plans/2026-09-26-ignition.md`; spec: `modules/ignition.md`. Dos
descriptores del mismo código (`ignition-points`, `ignition-cop`) y la ruta
vieja `#/lab/ignition` → `ignition-cop`. `npm run check` verde (**288**
tests; +37).

- **Elementos nuevos** (fuera de la lista del plan, §12 anotado):
  `currentLoad` (`I = control.i·smoothstep(ΔV/1 V)`, C¹, en vez de la rampa de
  0,05 V que pedía el plan: da el mismo objetivo sin esquinas para Newton) y
  `junction` (nudo eléctrico `joint`/`multiple` de 6 puertos; hacía falta para
  el `coilBus` y los empalmes y no estaba en la lista). Tests de ley +
  jacobiano en `tests/sim/elements.test.ts`; filas en `solver.md` §6 y
  `CONTRATOS.md` §4.10.
- **Modelo por eventos** (`events.ts` puro + `core.ts`): cortes en `[θ, θ+Δθ)`
  con desfases 0/540/180/360, avance de platinos (8 + centrífugo + vacío de
  puerto) y mapa COP, corriente RL con tope de 8 A, `Vdisp = √(2ηE/Cs)` vs
  `Vped = 2 + 2·gap·p + 4·rotorWorn`, arco, picado del condensador, chispa
  perdida y códigos P0016/P0340. El consumo medio de cada bobina se le escribe
  al `currentLoad` paso a paso (integral analítica del dwell partida por los
  eventos).
- **Decisiones de implementación, anotadas**: la sonda `coilV` se toma **antes
  del balasto** (`ballast.a` en platinos, `coil1.a` en COP), porque el plan
  §5.3 computa `R_t = R + balasto` (spec §5.3) y medir después del balasto
  contaría dos veces su caída; `state.busCurrent` se muestra suavizado
  (τ = 0,1 s, como un amperímetro) mientras el solver recibe el promedio exacto
  del paso; con una falla sistémica (balasto/tapa en corto o sin sincronía) la
  señal `ignition.spark` se fuerza a 0 en el acto (el test 6 pide 0 al soltar
  la llave); `state` suma `syncRpm`, `pointsOpen` y `pulses` (aditivos, para
  lecturas y el destello de las bujías).
- **Circuito**: baja tensión con batería real (`r = 0,01 Ω`), llave, balasto
  como `switch` de 1,5 Ω con binding del cortado y puente de arranque; en COP
  `coilBus`/`groundBus` con `junction`. Sin compuerta por software de la
  batería; el solver converge con `failures === 0` en los tres escenarios del
  test 11. `validate` sólo deja avisos de puertos de nudo sin usar (esperado).
- **Drawers nuevos** (`render/svg/drawers/ignition/`): `ballast`, `coil`
  (única y COP), `sparkPlug`, `distributor` (leva, contactos, rotor, tapa,
  contrapesos, cápsula y cables), `toothWheel` (60-2, sensores e igniter) y
  `scope` (dos trazos analíticos). `ignition.css` con variables CSS.
- **Core**: `eslint.config.js` extiende las listas de pureza/capas a
  `events/core` y la excepción de `type` a `core` (§33); `src/core/router.ts`
  suma el alias `ignition` con tests.
- Tests: `tests/ignition/events.test.ts` (6), `core.test.ts` (15) y
  `content.test.ts` (16), más el elemento y el alias.

**Verificado por el usuario en Firefox (2026-09-26): funciona.**

**Checklist de Firefox** (`npm run dev`) — la del plan §5:

`#/lab/ignition-points`:
1. En ralentí la leva abre y cierra los platinos, el rotor apunta al cilindro
   que enciende y cada bujía destella en su turno (orden 1-3-4-2).
2. El osciloscopio muestra la rampa de corriente y el pico de voltaje; en
   cámara lenta se ve el arco.
3. Al subir rpm los contrapesos se abren y el avance sube; en crucero
   (mariposa 0,3) la cápsula de vacío adelanta más.
4. "Arranca y se apaga al soltar la llave": en `start` hay chispa, en `run` no.
5. "Falla en alta": a 6000 rpm a fondo las bujías fallan, en ralentí no.
6. `camOffset = 10`: el avance baja 10°.

`#/lab/ignition-cop`:
7. La rueda 60-2 gira con su hueco; sin sensor no hay chispa y la ECU lo dice.
8. `camOffset = 10`: la chispa no cambia pero aparece el código P0016.
9. Bobina 2 muerta: la bujía 2 no destella.
10. Combustible, 4 tiempos y quiz siguen funcionando; F12 sin errores.

## CERRADO 2026-09-26 — A11 Ciclo de 4 tiempos y distribución

Plan: `plans/2026-09-26-four-stroke.md`; spec: `modules/four-stroke.md` (con
las cuentas del gas y la distribución). El usuario aprobó el plan del vehículo
(v3) y se implementó A11 en orden. `npm run check` verde (**251** tests).

- **Bus de señales** (`src/sim/signals/{bus,stubs}.ts`): `createLabBus` con
  dueño único (§28), latencia de un paso, `sameStep` para la fase, stubs de la
  tabla del plan del vehículo §5.3 (incluye `air.massFlow` del carburador) y
  `createPhaseStub`. El controlador `labBus` va primero en el circuito.
- **Mecanismo sin red**: `compileCircuit` con 0 nodos ya convergía; su test
  quedó en `tests/sim/nodal.test.ts` (red vacía, 1 iteración). `VISUAL_TYPE`
  se movió de `fuel/circuit.ts` a `src/sim/elements/visual.ts` y entró en
  `ELEMENT_TYPES`; `FUEL_TYPES` desapareció (el combustible usa el registro
  compartido). `typescript-eslint` sigue pidiendo TS < 6.1: no hay migración.
- **Física** (`sim/engine/geometry.ts` + `four-stroke/{constants,gas,timing,
  mechanism}.ts`): subpasos de ≤ 1°; el calor va en la forma integral de
  `dp = −n·p·dV/V + (n−1)/V·dQ·1e-5` (calor al volumen medio) porque con la
  forma diferencial el subpaso de 1° no cumplía §11.15 (daba 4,9 % a 6000 rpm;
  ahora 0,09 %). El pistón sigue al **cigüeñal** y las válvulas/combustión a la
  **leva**: así el choque de §5.7 da los números de la spec (1 diente 0,2 mm
  de margen; 2 dientes −1,7 mm en los dos sentidos).
- **Números medidos** a 3000 rpm: a fondo 25° → 581 J y 67,2 bar de pico
  (spec: 585/66); 0° → 493 (503); 40° → 554 (555); sin chispa → −1,7 J (−6);
  prueba de compresión sana → 13,2 bar manométricos (13,4); `kLeak` 8 → 5,1
  (≈5,5). Ningún rango de §11 necesitó tocar constantes.
- **Ajustes de implementación, anotados**: `state.compression` guarda bar
  manométricos (el pico absoluto menos 1,013); `state` suma `viewWork` y
  `cycleCount` (aditivos, para lecturas y el P-V); el torque es instantáneo
  (oscila y cruza por cero, como el P-V). El test 8 (choque) vive en
  `tests/four-stroke/model.test.ts`: necesita el gas, no sólo `timing.ts`.
- **Fuera de la lista de archivos de A11** (§12, anotado): `eslint.config.js`
  extiende las listas de pureza/capas y la excepción de `type` a
  `constants/gas/timing/mechanism` (§33); `src/core/router.ts` gana
  `LAB_ALIASES` (`four-stroke` → `four-stroke-dohc`) con tests en
  `tests/game/router.test.ts` y `tests/core/ui-pure.test.ts`;
  `tests/game/quiz.test.ts` lee los drawers recursivamente (hay subcarpeta
  `engine/`); `tests/sim/{nodal,elements}.test.ts` cubren 0 nodos y el tipo
  `visual`. Docs: `CONTRATOS.md` §4.11 (bus) y la lista de §4.10,
  `solver.md` §6 (fila `visual`) y la mención a `ELEMENT_TYPES` en `fuel.md`.
- **Módulo**: `four-stroke-ohv` (varillas y balancines, tensor de resorte) y
  `four-stroke-dohc` (dos árboles, tensor hidráulico, correa opcional) con
  `fourStrokeDef`, catálogo §26 por variante, contenido, narración y presets;
  drawers nuevos en `render/svg/drawers/engine/` (corte del cilindro, tren de
  distribución con inset del chavetero, P-V y barras de compresión) y
  `four-stroke.css`. Tests: `tests/four-stroke/*` (gas 7, timing 5, model 11,
  contenido 13) y `tests/sim/signals.test.ts` (8).

**Verificado por el usuario en Firefox (2026-09-26): funciona.**

**Checklist de Firefox** (`npm run dev`) — la del plan §6:
1. `#/lab/four-stroke-dohc`: a 120 rpm (preset "Cámara lenta") se ven los 4
   tiempos en orden, el nombre cambia en PMS/PMI, las válvulas abren y cierran
   donde dice la spec §5 y el cruce se resalta con `showOverlap`.
2. El P-V dibuja el lazo: con chispa, un lazo con área; sin chispa, casi una
   línea (ida y vuelta).
3. "Prueba de compresión" llena las 4 barras entre 12,5 y 14 bar; con anillos
   gastados en el 3 la barra 3 queda baja.
4. "Chavetero ovalado": en el inset se ve el piñón con juego sobre el eje; al
   subir la carga, la marca de la leva se separa de la referencia y se ve el
   golpeteo.
5. "Perno flojo": el chavetero se abre solo hasta que la chaveta se corta; la
   marca de la leva se va quedando atrás.
6. "Saltaron dos dientes": aparece el aviso de choque y la compresión de un
   cilindro cae.
7. Tensor hidráulico con presión 0,2: la cadena se comba y hay ruido; con 3 bar
   se tensa.
8. `#/lab/four-stroke-ohv` dibuja varillas y balancines; `rocker.lash` baja la
   alzada y hace tic-tic.
9. `#/lab/four-stroke` redirige a la versión DOHC. El combustible y el quiz
   siguen funcionando; F12 sin errores.

## Historial recortado

Los CERRADO/FIX/REVISIÓN anteriores a A11 (A0–A7, A6b, TS5, fixes del
2026-09-23/24) se recortaron el 2026-09-26 para respetar el límite de
líneas; están en git (`git log -p -- docs/AHORA.md`, antes de `7533045`).

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


