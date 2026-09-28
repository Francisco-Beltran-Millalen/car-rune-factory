# Sistemas — catálogo del auto, mapeado a módulos

Catálogo de a dónde apuntar, no compromiso de orden. La prioridad real vive en
`NORTE.md` → Módulos y en `AHORA.md`. Estado: ✅ hecho · ⏳ planificado ·
💭 idea.

## Motor

- **Alimentación de combustible** ✅ `fuel` (inyección; A6–A7) — estanque, bomba eléctrica,
  colador, válvula check, filtro, riel, 4 inyectores, regulador con
  referencia de vacío, retorno. Spec completa en `modules/fuel.md`.
- **Ciclo de 4 tiempos** ⏳ A11 `four-stroke-ohv` / `four-stroke-dohc` —
  pistón, biela, cigüeñal, válvulas, árbol de levas, distribución 2:1,
  diagrama P-V. `modules/four-stroke.md`.
- **Distribución** ⏳ (dentro de `four-stroke`) — piñón del cigüeñal,
  chaveta, cadena/correa/engranajes, tensor, guías, piñón de leva; OHV,
  SOHC, DOHC. Fallas: chaveta cortada, tensor débil, guía rota, cadena
  estirada.
- **Encendido** ⏳ A12 `ignition-points` / `ignition-cop` — platinos,
  condensador y distribuidor; o ECU, sensor 60-2, igniter y COP; bujías y
  osciloscopio. `modules/ignition.md`.
- **Refrigeración** ⏳ A13 `cooling-viscous` / `cooling-electric` — bomba de agua, termostato, radiador,
  ventilador, calefactor, depósito de expansión, tapa a presión.
  `modules/cooling.md`.
- **Lubricación** ⏳ A14 `lubrication-gauge` / `lubrication-lamp` — cárter, bomba de engranajes, válvula de
  alivio, filtro con bypass, galerías, cojinetes, luz de presión.
  `modules/lubrication.md`.
- **Carburador** ⏳ A16 `carburetor` (`modules/carburetor.md`) — cuba, flotador, surtidores de ralentí y principal,
  estrangulador (choke), bomba de aceleración, bomba de bencina mecánica.
  Variante antigua de la alimentación.
- **Admisión** ⏳ A18 `intake-carb` / `intake-efi` — filtro, MAF,
  mariposa, IAC, múltiple (bus de vacío), PCV, vacuómetro.
  `modules/intake.md`.
- **Escape** ⏳ A19 `exhaust-simple` / `exhaust-cat` — múltiple,
  catalizador, sondas, silenciador, analizador de gases; cierra el lazo de
  mezcla con la ECU. `modules/exhaust.md`.
- **Turbo** 💭
- **Diésel common-rail** 💭 — contraste con la inyección de bencina.

## Eléctrico

- **Batería, arranque y carga** ⏳ A17 `electrical-dynamo` /
  `electrical-alternator` — batería, masas, partidor, dínamo o alternador,
  regulador, fusibles, relés y consumos. `modules/electrical.md`.

## Tren motriz

- **Embrague, caja manual, diferencial y ejes** ⏳ A21 `drivetrain-rwd` /
  `drivetrain-fwd` — embrague (cable o hidráulico), caja de 5 con
  sincronizadores, cardán con crucetas y puente rígido, o semiejes con
  homocinéticas; el auto que acelera. `modules/drivetrain.md`.
- **Automática (convertidor de par)** y **4x4** 💭 — registradas en la spec
  del tren motriz, sin plan.

## Frenos, suspensión, dirección y ruedas

- **Frenos hidráulicos** ⏳ A20 `brakes-classic` / `brakes-abs` — servo,
  cilindro maestro doble, disco y tambor, repartidora, ABS, temperatura.
  `modules/brakes.md`.
- **Suspensión** ⏳ A22 `suspension-classic` / `suspension-modern` — doble
  horquilla y ballestas, o McPherson y eje torsional; cuarto de auto por
  esquina, geometría, ruidos. `modules/suspension.md`.
- **Dirección** ⏳ A23 `steering-box` / `steering-rack` — caja de bolas
  manual o cremallera con asistencia hidráulica; juego y convergencia.
  `modules/steering.md`.
- **Ruedas y neumáticos** ⏳ A24 `wheels` — presión, desgaste por zona,
  edad, balanceo, llanta, rodamiento, pernos. `modules/wheels.md`.

## Chasis y carrocería

- **Inspección de carrocería y chasis** ⏳ A25 `body-frame` /
  `body-unibody` — zonas con óxido, masilla y abolladuras, herramientas de
  inspección y revisión técnica, fuera del solver. `modules/body.md`.
- **Soldadura** 💭 — minijuego muy a futuro (`HORIZONTE_JUEGO.md`).
  Enderezado y pintura quedan como ideas sin fecha.

## Variantes por época (1970–2010)

Todo es combustión interna. **Se modela por sistema, no por auto**: cada
sistema es un arquetipo que encapsula sus variantes. Si la física es la
misma, la variante es una pieza intercambiable (platinos o transistor
cortando la misma bobina). Si la física cambia, es un sistema hermano que
publica las mismas señales (carburador e inyección → `fuel.mixture`). El
criterio está en `FICHAS.md` (Contexto común, 3) y la lista de arquetipos
la fija A10. La tabla sirve para ubicar
qué variantes tiene que cubrir cada arquetipo; las fechas son aproximadas y
cambian según el mercado.

| Sistema | ~1970–1985 | ~1985–1995 | ~1995–2010 |
|---|---|---|---|
| Alimentación | carburador, bomba mecánica | monopunto (TBI), multipunto con retorno | multipunto con retorno (`fuel`) y sin retorno |
| Encendido | platinos + condensador + distribuidor | electrónico con distribuidor (Hall/inductivo) | DIS y COP (`ignition`) |
| Distribución | OHV con varillas, cadena; SOHC | SOHC/DOHC, correa | DOHC, correa o cadena |
| Carga | dínamo → alternador con regulador externo | alternador con regulador interno | alternador gestionado |
| Tracción | trasera dominante | delantera se generaliza | delantera, trasera, 4x4 |
| Estructura | largueros y monocasco | monocasco | monocasco |
| Frenos | tambor atrás, disco o tambor adelante | disco adelante, ABS aparece | ABS habitual |

## Cómo se entrelazan los sistemas

Hay tres tipos de acople, y cada uno se trata distinto en la arquitectura
(plan `2026-09-23-arquitectura-juego.md` §14):

- **Red eléctrica compartida (acople fuerte).** Batería, alternador,
  arranque, bomba de bencina, bobinas, ventilador y ECU cuelgan de la misma
  red de 12 V. Si la batería está débil, todo lo eléctrico se resiente a la
  vez: por eso "no parte" tiene tantos sospechosos.
- **Eje del motor (señal).** El cigüeñal mueve, por correa o engranaje, la
  bomba de agua, la bomba de aceite, el alternador, el árbol de levas y (en
  algunos autos) la bomba de dirección. Las rpm son una señal que usan todos.
- **Motor como consumidor (señal).** La combustión necesita a la vez
  **combustible + chispa + aire + compresión**, y produce calor (hacia la
  refrigeración) y giro. El estado del motor (parte, falla, se detiene, se
  recalienta) es la suma de lo que aportan varios sistemas.

**Los fluidos nunca se mezclan**: bencina, refrigerante, aceite, líquido de
frenos y aceite de dirección son redes separadas. Solo se cruzan **por una
falla**, y eso es una pista de diagnóstico muy valiosa:
- empaquetadura de culata quemada → refrigerante en el aceite (aceite
  "cafecito con leche") o en la combustión (humo blanco);
- inyector goteando → bencina en el aceite;
- enfriador de transmisión roto → mezcla de ATF y refrigerante.

### Matriz de contacto directo

`●` acople fuerte (comparten red), `○` acople por señal o calor, `·` se
tocan sólo a través del motor o por una falla, `—` nunca.

| | Comb. | Aire | Encend. | Motor | Refrig. | Lubric. | Eléctr. | Escape | Transm. | Frenos | Direc. | Susp. | Ruedas | Carroc. |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Combustible** | | ○ vacío ref. | — | ○ mezcla | — | · dilución | ● bomba/relé | ○ lambda | — | — | — | — | — | — |
| **Admisión/aire** | ○ | | — | ○ aire | — | — | ○ sensores | — | — | ○ servo de vacío | — | — | — | — |
| **Encendido** | — | — | | ○ chispa | — | — | ● bobinas | — | — | — | — | — | — | — |
| **Motor (4T)** | ○ | ○ | ○ | | ○ calor + correa | ○ engranaje, tensor | ○ arranque/alternador | ○ gases | ○ embrague | · vacío (vía admisión) | ○ correa | · soporte | ○ giro | ○ se monta |
| **Refrigeración** | — | — | — | ○ | | · culata/enfriador | ● ventilador | — | · enfriador ATF | — | — | — | — | ○ frente |
| **Lubricación** | · | — | — | ○ | · | | ○ sensor presión | — | — | — | — | — | — | — |
| **Eléctrico** | ● | ○ | ● | ○ | ● | ○ | | ○ sonda | ○ TCU (automáticas) | ○ ABS | ○ EPS | ○ sensores | ○ ABS | ○ luces |
| **Escape** | ○ | — | — | ○ | — | — | ○ | | — | — | — | · soportes | — | ○ salida |
| **Transmisión** | — | — | — | ○ | · | — | ○ TCU | — | | — | — | ○ palieres | ● palieres | · túnel |
| **Frenos** | — | ○ | — | · vacío | — | — | ○ | — | — | | ○ geometría | · geometría | ● | — |
| **Dirección** | — | — | — | ○ | — | — | ○ | — | — | ○ geometría | | · terminales | ● | — |
| **Suspensión** | — | — | — | · | — | — | ○ sensores | · soportes | ○ palieres | · geometría | · terminales | | ● | ○ anclajes |
| **Ruedas** | — | — | — | ○ giro | — | — | ○ ABS | — | ● palieres | ● | ● | ● | | — |
| **Carrocería** | — | — | — | ○ | ○ | — | ○ | ○ | · | — | — | ○ | — | |

**Sistemas que nunca se tocan directamente** (la matriz con `—`), por
ejemplo:
- combustible con refrigeración, frenos, dirección o transmisión;
- encendido con refrigeración, lubricación o frenos;
- frenos con refrigeración o lubricación.

(La matriz es de **contacto**: úsala para descartar, pero un generador de
casos también debe seguir las celdas `·`, porque ahí están las pistas falsas
útiles.) La matriz incluye suspensión, ruedas y carrocería desde A10; el
bloque S2 afina sus acoples mecánicos y de geometría.

Esto es útil para el juego: un síntoma de frenos **no** sirve de pista para
el encendido. Los descartes también enseñan.

Fuera del cuadro: el servo de frenos usa el vacío del múltiple. Una manguera
del servo rota produce una entrada de aire y un ralentí inestable: un
síntoma de "motor" causado por "frenos". Es un caso clásico para el juego.

## Integración

- **Vehículo** ✅ A10 (plan) y A15 (código, `vehicle-70`/`vehicle-2000`) —
  `compileVehicle` une los circuitos de cada sistema, con una variante por
  sistema, buses compartidos y señales con dueño (P23 §14; reemplaza el
  orquestador del plan maestro §11).

## Juegos (ver `plans/2026-09-22-hoja-de-ruta-juego.md`)

- **Nombrar piezas** 💭 E1 — sobre cualquier diagrama con `parts`.
- **Diagnóstico** 💭 E2 — falla escondida + herramientas + reemplazar piezas.
- **Solver de redes hidráulicas** 💭 E3 — base común para combustible,
  refrigeración y lubricación armables. Luego un solver eléctrico para
  encendido y carga.
- **Armar circuitos** 💭 E4 — arrastrar y conectar; prueba con Phaser.
