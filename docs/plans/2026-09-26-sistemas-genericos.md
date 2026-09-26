# Plan: sistemas genéricos (arquetipos) y carrocería a futuro

> **Aviso:** lo vigente de este plan (§1, §4 y §5) quedó consolidado en
> `docs/FICHAS.md`. Este archivo es registro histórico; para trabajar se
> usa la ficha.

Enmienda del mismo día a `2026-09-26-alcance-auto-completo.md`. Reemplaza
su §4 punto 1 (configuración del vehículo) y el alcance de restauración de
su §1 y §3. Lo demás de ese plan sigue vigente.

## 1. Por sistema, no por auto (decisión del usuario)

No se modelan autos concretos (marca, modelo o año). Cada sistema se modela
como el **arquetipo más popular** y encapsula los conceptos que comparten sus
variantes. Las variantes antiguas entran como **piezas intercambiables del
mismo sistema** cuando comparten la física, y como **sistema aparte** sólo
cuando la física es otra.

Esto ya está en la física, no es sólo una preferencia:

- **Encendido.** La bobina se comporta igual con platinos y con COP
  (primario RL, `½·L·i²`, ruptura en la bujía). Cambian dos piezas: quién
  corta el primario (platinos + condensador, o un transistor) y quién
  reparte la alta tensión (distribuidor con rotor, o una bobina por
  cilindro). Y quién decide el avance: contrapesos y cápsula de vacío, o la
  ECU. Es un mismo sistema con tres piezas intercambiables.
- **Alimentación.** El concepto común es dosificar la bencina según el aire.
  El carburador lo hace con depresión en un venturi y la inyección con
  presión en el riel y el tiempo de apertura. Las piezas y la física son
  distintas: probablemente sea un sistema hermano con la misma salida
  (`fuel.mixture`, §28).
- **Distribución.** Cadena, correa o engranajes, y OHV, SOHC o DOHC, son
  parámetros de `four-stroke`: la relación 2:1 y el desfase se calculan
  igual.

Con el solver esto sale natural: un `CircuitDef` es datos, así que una
variante es otra definición con los mismos elementos.

**Para A10**: definir el criterio (misma física → pieza intercambiable;
física distinta → sistema hermano con las mismas señales) y la lista de
arquetipos por sistema. Un vehículo del laboratorio es una combinación
genérica de arquetipos, no un modelo real.

## 2. Carrocería y chasis: inspección visual, soldadura muy a futuro

- **Por ahora nada.** Cuando llegue, lo primero es **inspección visual**
  (óxido, perforación, deformación) como pistas del diagnóstico.
- **Muy a futuro**, un minijuego de **soldadura**, con una precisión
  abstracta al estilo de los juegos de cirugía de Wii (tipo *Trauma
  Center*): seguir la unión, mantener la distancia y la velocidad, no
  perforar. Va a `HORIZONTE_JUEGO.md`, no al bloque S ni al G.
- Enderezado del chasis y pintura quedan como ideas sin fecha.

## 3. La falla del usuario, corregida

Lo que el usuario vio no es la chaveta sino el **chavetero** (la ranura
donde va la chaveta), **ovalado** hacia un lado. La **chaveta** es la cuña
que va metida en esa ranura y amarra el piñón o la polea al cigüeñal. Un
chavetero ovalado suele venir de un **perno del cigüeñal flojo**: el piñón o
la polea se mueven un poco en cada giro y van comiéndose la ranura. Por eso
el catálogo de `four-stroke.md` suma (ids provisionales, A11 los fija):

- `crankBolt.loose`: la causa raíz. Juego del piñón o la polea sobre el
  cigüeñal.
- `crankKey.keywayWorn`: el chavetero ovalado, un desfase de pocos grados
  que varía con la carga y un golpeteo. Si sigue, termina en
  `crankKey.sheared`.

## 4. Revisión del plan vigente contra estas decisiones

Se revisaron las fichas de P25 §6 y P23 §14 (lo que leerá el agente de
A10). Qué estaba bien y qué faltaba:

1. **`VehicleDef` de P23 §14.2 ya sirve.** Un vehículo es una lista de
   circuitos por sistema (`{ id: 'ignition', circuit: 'cop-4' }`), así que
   una variante ya se expresa como otro circuito. Falta decir que el
   vehículo elige **una variante por sistema** y que no representa un auto
   real.
2. **Falta el dueño de la admisión.** Hoy `engineCore` calcula `pMan` y lee
   `throttle` (`src/sim/controllers/engineCore.ts:105`). Tres variantes lo
   necesitan como señal: el carburador (la mariposa y el venturi están en
   él), el avance por vacío del distribuidor y el servo de frenos. A10 fija
   quién es dueño de `throttle`, `intake.map` y `air.flow`.
3. **Falta la fase entre cigüeñal y leva.** La falla del chavetero cambia
   según la variante de encendido. Con **distribuidor**, que va movido por el
   árbol de levas, el desfase atrasa las válvulas **y** la chispa. Con
   **sensor en el cigüeñal** la chispa sigue bien y sólo se desfasan las
   válvulas (y en autos con sensor de leva aparece una incoherencia entre
   los dos). Hacen falta dos señales, `engine.crankAngle` y
   `engine.camAngle`, y cada variante de encendido declara cuál lee. Hoy
   `crankAngle` lo escribe `engineCore`. A10 decide si pasa a `four-stroke`.
4. **Faltan capacitor e inductancia en `src/sim/elements/`.** Sólo existen
   en los tests de A4. A12 los necesita: la bobina en todas las variantes y
   el condensador de los platinos. El circuito LC de platinos con
   condensador oscila en kHz, así que la pregunta de P25 §3.5 sobre el paso
   de 1 ms pesa más en esa variante.
5. **Los ids de fallas de `four-stroke.md` no siguen §26.** Son `ringWear`,
   `burntExhaustValve`, `camTimingOffset` y `noSpark`. P25 §3.5 ya exige
   ids §26 en la spec, y A11 los convierte. `camTimingOffset` queda como
   control del laboratorio (el desfase a mano) o como
   `timingChain.skippedTeeth`, no como causa.
6. **Los autos antiguos son la prioridad y no tenían ninguna tarea.** El
   plan sólo tenía variantes modernas. Por eso se agregan el carburador (A16)
   y las variantes antiguas dentro de A11 y A12 (§5).
7. **El resto del auto no tenía tareas.** Se agregan como bloque S2 (§5),
   después de A15, sin fichas detalladas todavía.
8. **Laboratorio con variantes.** Hoy un descriptor tiene un circuito.
   Mostrar dos variantes (una ruta por variante o un selector que recompila)
   lo decide A10. A7 no cambia, pero no debe asumir que un módulo tiene
   un solo circuito para siempre.

## 5. Agregados a las fichas de P25 §6 (se leen junto con la ficha)

**Todas las tareas de sistemas (A11–A14, A16, S2):** leer §1 de este plan.
Cada spec (`docs/modules/<id>.md`) tiene una sección **Arquetipo y
variantes**: qué conceptos comparte el arquetipo, qué piezas se
intercambian, qué variantes se implementan y cuáles quedan registradas. Por
defecto se implementan **la variante más antigua y la más común**. Las
intermedias se implementan si salen como combinación de piezas ya hechas.

- **A6b**: sin cambios. `fuel` es el arquetipo multipunto con retorno.
- **A7**: sin cambios de alcance. No asumir un solo circuito por módulo
  (§4.8).
- **A10**: además de su ficha, leer este plan completo y
  `2026-09-26-alcance-auto-completo.md` §3–§5. El plan del vehículo tiene
  que incluir:
  1. el criterio de §1 y la **tabla de arquetipos**: por sistema, qué
     variantes, cuáles son piezas intercambiables y cuáles sistemas
     hermanos;
  2. `VehicleDef` con una variante por sistema (§4.1); un vehículo del
     laboratorio es genérico ("años 70", "años 2000"), no un modelo real;
  3. la tabla de dueños de señales (§28) con `throttle`, `intake.map`,
     `air.flow` (§4.2), `engine.crankAngle`, `engine.camAngle` (§4.3),
     `lubrication.pressure` (tensor hidráulico) y las señales eléctricas;
  4. cómo se muestran las variantes en el laboratorio (§4.8);
  5. dónde encaja la carrocería (modelo por elementos, fuera del solver),
     sólo ubicado y sin detalle.
- **A11 4 tiempos**: la distribución es parte del sistema. Variantes como
  params: cadena, correa o engranajes; OHV, SOHC o DOHC. Tensor hidráulico
  o de resorte. Fallas de `four-stroke.md` (chavetero, chaveta, perno,
  tensor, guía, cadena) con ids §26 (§4.5). Publica el ángulo de leva
  (§4.3). Laboratorio: tiene que verse el desfase entre el piñón y el eje.
- **A12 encendido**: arquetipo con tres piezas intercambiables: el corte
  del primario (platinos + condensador o transistor), el reparto de la alta
  (distribuidor con rotor, o COP) y el avance (contrapesos + cápsula de
  vacío, o ECU). Se implementan **platinos con distribuidor** y **COP**.
  El electrónico con distribuidor y el DIS se implementan si salen como
  combinación de esas piezas. Agrega capacitor e inductancia a
  `src/sim/elements/` (§4.4). Lee `engine.camAngle` o `engine.crankAngle`
  según la variante (§4.3).
- **A13 refrigeración y A14 lubricación**: un solo arquetipo cada una. Las
  diferencias de época (ventilador mecánico con embrague viscoso o
  eléctrico; filtro de aceite de cartucho o enroscable) se documentan en la
  sección de variantes. A14 publica `lubrication.pressure` para el tensor.
- **A16 carburador (tarea nueva, antes de A15)**: es un sistema hermano de
  `fuel` y publica la misma `fuel.mixture` (§28). Piezas: bomba de bencina
  mecánica (movida por la leva, lee `engine.rpm`), cuba con flotador y
  aguja, surtidores de ralentí y principal, venturi, mariposa,
  estrangulador y bomba de aceleración. Física hidráulica con el solver
  (fluidos `fuel` y `air`). Pasos iguales a A11–A14. Checkpoint: el
  laboratorio del carburador en Firefox.
- **A15**: el laboratorio del vehículo arma **dos vehículos genéricos**:
  uno antiguo (carburador + platinos) y uno moderno (inyección + COP), para
  que se vea que el resto del auto no cambia al cambiar la variante.
- **Bloque S2 (después de A15)**: eléctrico (carga con dínamo o
  alternador, arranque, fusibles), frenos, tren motriz, suspensión,
  dirección y ruedas, e inspección visual de carrocería. Cada uno: spec →
  plan → código, con su ficha escrita cuando le toque. El orden lo decide el
  usuario al cerrar A15, junto con la puerta del bloque G.

## 6. Cambios en docs vivos (este commit)

`NORTE.md` (alcance), `SISTEMAS.md` (arquetipos, carrocería),
`modules/four-stroke.md` (fallas), `HORIZONTE_JUEGO.md` (soldadura),
`AHORA.md` (fila de A10), y el aviso al inicio del plan anterior. En la
revisión de §4 y §5: `AHORA.md` (tabla con A16 y el bloque S2, y el aviso de
leer §5), el aviso al inicio de P25 y `SISTEMAS.md` (carburador → A16).
