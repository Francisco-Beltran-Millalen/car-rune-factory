# Fichas de tarea — lo que lee el agente

Doc vivo. Hay **una ficha por tarea pendiente**, en orden de ejecución.
Reemplaza a las fichas de `plans/2026-09-25-simulacion-antes-que-juego.md`
§6 y a los agregados de `plans/2026-09-26-sistemas-genericos.md` §5.

## Cómo se lee

1. `AGENTS.md`, `ARCHITECTURE.md`, `AHORA.md` y `CONTRATOS.md` (siempre).
2. La sección **Contexto común** de este archivo.
3. **Tu ficha** y nada más que lo que tu ficha nombre, con la sección
   exacta. Si una sección de un plan viejo no está nombrada, no se lee.

Si una ficha choca con un plan viejo, **manda la ficha**. Si falta algo, se
pregunta al usuario o se anota en el CERRADO; no se improvisa. En los planes
viejos, las rutas `.js` se leen como `.ts`.

Abreviaturas: **P23** = `plans/2026-09-23-arquitectura-juego.md`.

**No leer en ninguna tarea del bloque S**: el plan maestro (salvo lo que
nombre una ficha), la hoja de ruta, `2026-09-24-motor-y-juice.md`,
`2026-09-25-a3-revision.md`, y en P23 las
§4.6–§7 (juego), §8.6–§8.7 (Phaser, armado) y §12–§13. Tampoco
`2026-09-25-simulacion-antes-que-juego.md`, `2026-09-26-alcance-auto-completo.md`
ni `2026-09-26-sistemas-genericos.md`: lo vigente de esos tres ya está aquí.

---

## Contexto común (decisiones vigentes del usuario)

1. **Laboratorio antes que juego** (2026-09-25). El laboratorio no oculta
   nada y vale por sí solo, como herramienta para aprender mecánica. El
   juego (se oculta el estado y se diagnostica con herramientas) empieza
   sólo cuando el usuario lo escriba en `AHORA.md`. El quiz (etapas 1 y 2
   del combustible) ya existe y **tiene que seguir jugable** en cada tarea.
2. **El auto completo, de 1970 a 2010, sólo combustión interna**
   (2026-09-26). Importan sobre todo los antiguos.
3. **Por sistema, no por auto** (2026-09-26). No se modelan autos reales.
   Cada sistema es un **arquetipo** que encapsula los conceptos de sus
   variantes de época:
   - si la física es la misma, la variante es una **pieza
     intercambiable** del mismo sistema (platinos o transistor cortando la
     misma bobina);
   - si la física es otra, es un **sistema hermano** que publica las mismas
     señales (el carburador y la inyección publican `fuel.mixture`).

   La tabla de épocas está en `SISTEMAS.md` → "Variantes por época".
4. **Cada spec de sistema** (`docs/modules/<id>.md`) tiene una sección
   **Arquetipo y variantes**: qué comparte el arquetipo, qué piezas se
   intercambian, qué variantes se implementan y cuáles quedan registradas.
   Por defecto se implementan **la más antigua y la más común**. Las
   intermedias, sólo si salen combinando piezas ya hechas.
5. **Carrocería y chasis**: por ahora nada. Cuando lleguen, primero como
   inspección visual (óxido, perforación, deformación). La soldadura es un
   minijuego muy a futuro (`HORIZONTE_JUEGO.md`).
6. **Un agente a la vez, en orden, todo en `main`.** Cada tarea cierra con
   `npm run check` en verde, un bloque CERRADO en `AHORA.md` (con la
   checklist de Firefox para el usuario) y un commit.
7. Al empezar cada tarea: `npm view typescript-eslint peerDependencies`. Si
   acepta TS 7, se avisa en `AHORA.md` (la migración es una tarea aparte).

---

## A10 — Plan del vehículo (sin código)

**Qué es.** Diseñar cómo se juntan los sistemas en un vehículo y cómo se ve
eso en el laboratorio, **antes** de A11–A16, para que cada sistema nazca con
sus señales, buses, stubs y variantes definidos.

- **Leer**: P23 §14 completa (sistemas entrelazados, `VehicleDef`,
  `compileVehicle`, requisitos 14.4); P23 §8.3 (contrato de controlador);
  `SISTEMAS.md` completo; `src/sim/controllers/engineCore.ts`;
  ARCHITECTURE §11, §25, §28 y §29.
- **No leer**: plan maestro §11 (el "orquestador que copia señales" lo
  reemplaza `compileVehicle`).
- **Entrega**: `docs/plans/AAAA-MM-DD-vehiculo.md`, **fácil de leer**, con
  revisión adversaria de un subagente sin contexto triada en el mismo plan,
  y las fichas de A11–A16 y A15 **actualizadas aquí** en `FICHAS.md` con lo
  que el plan decida. Si hace falta enmendar §11 de ARCHITECTURE, se
  propone.

El plan tiene que resolver, uno por uno:

1. **Los requisitos de P23 §14.4** (contrato de controlador de vehículo,
   buses, `compileVehicle`, `engineCore` único, `ModeContext` de varios
   sistemas, fluidos).
2. **Tabla de arquetipos**: por sistema, qué variantes hay, cuáles son
   piezas intercambiables y cuáles sistemas hermanos, con el criterio del
   Contexto común (3).
3. **`VehicleDef` con una variante por sistema.** La forma de P23 §14.2 ya
   sirve (`systems: [{ id: 'ignition', circuit: 'cop-4' }]`); falta
   fijar que cada vehículo elige una variante por sistema y que es genérico
   ("años 70", "años 2000"), no un auto real.
4. **Tabla de dueños de señales (§28)**, incluyendo las que hoy no tienen
   dueño claro:
   - **Admisión**: `throttle`, `intake.map`, `air.flow`. Hoy `engineCore`
     lee `throttle` y calcula `pMan` (`engineCore.ts:105`). Los necesitan
     el carburador (mariposa y venturi), el avance por vacío del
     distribuidor y el servo de frenos.
   - **Fase del motor**: `engine.crankAngle` y `engine.camAngle`. Hoy
     `crankAngle` lo escribe `engineCore`; decidir si pasa a `four-stroke`.
     Hacen falta los dos porque un chavetero ovalado atrasa la leva respecto
     del cigüeñal: con **distribuidor** (movido por la leva) se atrasan las
     válvulas **y** la chispa; con **sensor en el cigüeñal** la chispa sigue
     bien y sólo se atrasan las válvulas.
   - `lubrication.pressure` (la lee el tensor hidráulico de la
     distribución) y las señales eléctricas (`electrical.crankVoltage`,
     bus de 12 V).
5. **El laboratorio del vehículo**: varios sistemas a la vez con sus flujos;
   las señales compartidas a la vista con su dueño; una falla en un sistema
   muestra su efecto en otro (batería débil → bomba de bencina y bobinas se
   resienten a la vez); los stubs (§29) se ven como stubs.
6. **Cómo se muestran las variantes** en el laboratorio de un sistema: una
   ruta por variante o un selector que recompila el circuito.
7. **Tamaño del solver** por componente conexa (riesgo de P23 §14.2), medido
   con el benchmark de A4.
8. **Dónde encaja la carrocería**: un modelo por elementos, fuera del
   solver. Sólo se ubica, sin detalle.

- **Aceptación**: el usuario aprueba el plan.

---

## A11 — Ciclo de 4 tiempos (con la distribución)

**Qué es.** El mecanismo del motor: pistón, biela, cigüeñal, válvulas, árbol
de levas y **distribución**. Es un mecanismo, no una red: **no usa el
solver**. Necesita su propia vista (corte del cilindro + diagrama P-V),
fuera del catálogo de drawers de redes. Publica `engine.compression` y el
ángulo de leva (según decida A10).

- **Arquetipo y variantes** (params de este módulo): accionamiento por
  cadena, correa o engranajes; OHV (varillas y balancines), SOHC o DOHC;
  tensor hidráulico (lee `lubrication.pressure`, stub ideal en el
  laboratorio) o de resorte.
- **Fallas de la distribución** (ya descritas en `four-stroke.md`): perno
  del cigüeñal flojo → chavetero ovalado → chaveta cortada; tensor débil,
  guía rota, cadena estirada. El chavetero ovalado es una falla real que vio
  el usuario: tiene que verse en el laboratorio el juego entre el piñón y
  el eje.
- **Ids §26**: los de hoy (`ringWear`, `burntExhaustValve`,
  `camTimingOffset`, `noSpark`) no siguen el formato `<partId>.<falla>` y
  se convierten. `camTimingOffset` pasa a ser un control del laboratorio o
  `timingChain.skippedTeeth`, no una causa.

- **El plan del vehículo (A10) fija**: en el vehículo es dueño de
  `engine.crankAngle`, `engine.camAngle` y `engine.compression`; su tensor
  hidráulico lee `lubrication.pressure` (stub ideal en su laboratorio); es un
  **mecanismo** (sin solver) y define el inset para el laboratorio del
  vehículo; variantes como piezas: cadena/correa/engranajes y OHV/SOHC/DOHC.
- **Leer**: `docs/modules/four-stroke.md`; el plan del vehículo (A10);
  `SISTEMAS.md` ("Motor" y "Variantes por época"); `docs/modules/fuel.md`
  como ejemplo del nivel de detalle.
- **Pasos**:
  1. Spec en `four-stroke.md` al nivel de `fuel.md`: piezas, params,
     fallas con ids §26, física con unidades, estado, lecturas, narración,
     presets, tests con rangos y la sección Arquetipo y variantes.
  2. Plan en `docs/plans/AAAA-MM-DD-four-stroke.md`, fácil de leer.
  3. Código: `src/modules/four-stroke/**`, `tests/four-stroke/**`.
  4. Checklist de Firefox en `AHORA.md`.
- **Aceptación**: la que fije su plan + la checklist del laboratorio.

---

## A12 — Encendido (platinos y COP)

**Qué es.** Un arquetipo con **una sola bobina** (primario RL, energía
`½·L·i²`, ruptura en la bujía) y tres piezas intercambiables:

| Pieza | Antigua | Moderna |
|---|---|---|
| Corte del primario | platinos + condensador | transistor (igniter) |
| Reparto de la alta | distribuidor con rotor y tapa | una bobina por cilindro (COP) |
| Avance | contrapesos (rpm) + cápsula de vacío (`intake.map`) | ECU |

Se implementan **platinos con distribuidor** y **COP**. El electrónico con
distribuidor y el DIS se implementan si salen combinando esas piezas; si no,
quedan registrados en la spec. El distribuidor lee `engine.camAngle` y el
sensor de cigüeñal lee `engine.crankAngle` (señales de A10).

- **Solver**: faltan **capacitor e inductancia** en `src/sim/elements/`
  (hoy sólo existen dentro de los tests de A4); se agregan con tests
  analíticos. El circuito de platinos con condensador oscila en kHz: el
  plan decide si el paso de 1 ms alcanza, o si hace falta un subpaso o un
  modelo promediado.

- **El plan del vehículo (A10) fija**: publica `ignition.spark`; el
  distribuidor lee `engine.camAngle` y el sensor de cigüeñal
  `engine.crankAngle`; cuelga del bus `12v` del solver; en `vehicle-70`
  provee el bus (batería y llave); platinos+distribuidor y COP como piezas.
- **Leer**: `docs/modules/ignition.md`; el plan del vehículo (A10);
  `SISTEMAS.md` ("Motor", "Eléctrico" y "Variantes por época");
  `docs/modules/solver.md`; `docs/modules/fuel.md` como ejemplo.
- **Pasos**: spec → plan `docs/plans/AAAA-MM-DD-ignition.md` → código
  (`src/modules/ignition/**`, `src/sim/elements/**`, tests) → checklist.
- **Aceptación**: la que fije su plan + la checklist del laboratorio, con
  las dos variantes.

---

## A13 — Refrigeración

**Qué es.** Bomba de agua, termostato, radiador, ventilador, calefactor,
depósito de expansión y tapa a presión. Fluido `coolant` (§30). El plan
decide si se agrega un **dominio térmico** al solver (temperatura como
potencial, calor como flujo, encaja en el esquema nodal) o un modelo aparte.

- **Arquetipo y variantes**: un solo arquetipo. Se documentan en la spec las
  diferencias de época (ventilador mecánico con embrague viscoso o
  eléctrico con termocontacto).
- **El plan del vehículo (A10) fija**: publica `engine.coolantTemp`; lee
  `engine.rpm` y `engine.load`; el ventilador eléctrico cuelga del bus `12v`.
- **Leer**: `docs/modules/cooling.md`; el plan del vehículo (A10);
  `SISTEMAS.md`; `docs/modules/solver.md`; `docs/modules/fuel.md` como
  ejemplo.
- **Pasos**: spec → plan → código → checklist (igual que A11).
- **Aceptación**: la que fije su plan + la checklist del laboratorio.

---

## A14 — Lubricación

**Qué es.** Cárter, bomba de engranajes, válvula de alivio, filtro con
bypass, galerías, cojinetes y luz de presión. Hidráulica con el solver,
fluido `oil`, viscosidad según la temperatura (`engine.coolantTemp` u
`oilTemp`). Publica `lubrication.pressure` (la lee el tensor de A11).

- **Arquetipo y variantes**: un solo arquetipo; se documentan las
  diferencias de época (filtro de cartucho o enroscable, manómetro o sólo
  luz).
- **El plan del vehículo (A10) fija**: publica `lubrication.pressure`; lee
  `engine.rpm` y `engine.coolantTemp` (viscosidad); la luz de presión cuelga
  del bus `12v`.
- **Leer**: `docs/modules/lubrication.md`; el plan del vehículo (A10);
  `SISTEMAS.md`; `docs/modules/solver.md`; `docs/modules/fuel.md` como
  ejemplo.
- **Pasos**: spec → plan → código → checklist (igual que A11).
- **Aceptación**: la que fije su plan + la checklist del laboratorio.

---

## A16 — Carburador

**Qué es.** La alimentación de los autos antiguos. Es un **sistema hermano**
de `fuel` (física distinta: depresión en un venturi en vez de presión en
un riel) y publica la misma `fuel.mixture` (§28), para que `engineCore` y
los demás sistemas no sepan cuál está montado.

- **Piezas**: bomba de bencina mecánica (movida por la leva, lee
  `engine.rpm`), cuba con flotador y aguja, surtidores de ralentí y
  principal, venturi, mariposa, estrangulador (choke) y bomba de
  aceleración. Fluidos `fuel` y `air` (§30).
- **Fallas típicas a considerar**: flotador pegado (se ahoga o se seca),
  surtidor tapado, estrangulador pegado, bomba de aceleración sin
  diafragma (tironeo al acelerar), bomba mecánica gastada.
- **El plan del vehículo (A10) fija**: es el dueño de `fuel.mixture` en
  `vehicle-70` (mismo contrato que `fuel`); la bomba mecánica se mueve con el
  motor; lee `intake.map`.
- **Leer**: el plan del vehículo (A10); `SISTEMAS.md` ("Motor" y
  "Variantes por época"); `docs/modules/fuel.md` (como ejemplo y para las
  señales que comparten); `docs/modules/solver.md`.
- **Pasos**: spec nueva `docs/modules/carburetor.md` → plan → código
  (`src/modules/carburetor/**`, tests) → checklist.
- **Aceptación**: la que fije su plan + la checklist del laboratorio del
  carburador.

---

## A15 — Laboratorio del vehículo

**Qué es.** Implementar lo que diseñó A10: `compileVehicle`, `engineCore`
con entradas reales y la vista del vehículo. Se arman **dos vehículos
genéricos**: uno antiguo (carburador + platinos) y uno moderno (inyección +
COP), para que se vea que el resto del auto no cambia al cambiar la
variante.

- **Leer**: el plan del vehículo (A10).
- **El plan del vehículo (A10) fija**: `compileVehicle` con prefijos
  `sistema:pieza`, buses con un proveedor, `SignalBus` con dueño único y
  fases same-step, hoisting de `engineCore` y transformación del layout; los
  dos vehículos y su proveedor del bus; panel de señales
  (`ModeUi.signals`); elemento `breach` de cruce de fluidos; benchmark
  commiteado con umbral de 4 000 pasos/s.
- **Aceptación**: la que fije el plan de A10 + la checklist en Firefox (una
  falla de un sistema se ve en otro, en los dos vehículos).
- **Al cerrar**: preguntar al usuario el orden del bloque S2 y si abre la
  puerta del bloque G.

---

## Sin ficha todavía

- **Bloque S2 — resto del auto** (después de A15): eléctrico (carga con
  dínamo o alternador, arranque, fusibles), frenos, tren motriz, suspensión,
  dirección y ruedas, e inspección visual de carrocería. Catálogo en
  `SISTEMAS.md`. La ficha se escribe aquí cuando le toque.
- **Bloque G — juego** (A3, G1, A8, D-motor, A9): en espera de la puerta.
  Sus fichas se escriben aquí cuando el usuario abra la puerta.
