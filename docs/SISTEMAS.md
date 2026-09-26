# Sistemas — catálogo del auto, mapeado a módulos

Catálogo de a dónde apuntar, no compromiso de orden. La prioridad real vive en
`NORTE.md` → Módulos y en `AHORA.md`. Estado: ✅ hecho · ⏳ planificado ·
💭 idea.

## Motor

- **Alimentación de combustible** ⏳ `fuel` — estanque, bomba eléctrica,
  colador, válvula check, filtro, riel, 4 inyectores, regulador con
  referencia de vacío, retorno. Spec completa en `modules/fuel.md`.
- **Ciclo de 4 tiempos** ⏳ `four-stroke` — pistón, biela, cigüeñal,
  válvulas, árbol de levas, distribución 2:1, diagrama P-V.
  `modules/four-stroke.md`.
- **Distribución** ⏳ (dentro de `four-stroke`) — piñón del cigüeñal,
  chaveta, cadena/correa/engranajes, tensor, guías, piñón de leva; OHV,
  SOHC, DOHC. Fallas: chaveta cortada, tensor débil, guía rota, cadena
  estirada.
- **Encendido** ⏳ `ignition` — batería, ECU, sensor de cigüeñal 60-2,
  transistor, bobina COP, bujía, osciloscopio. `modules/ignition.md`.
- **Refrigeración** ⏳ `cooling` — bomba de agua, termostato, radiador,
  ventilador, calefactor, depósito de expansión, tapa a presión.
  `modules/cooling.md`.
- **Lubricación** ⏳ `lubrication` — cárter, bomba de engranajes, válvula de
  alivio, filtro con bypass, galerías, cojinetes, luz de presión.
  `modules/lubrication.md`.
- **Carburador** ⏳ A16 `carburetor` — cuba, flotador, surtidores de ralentí y principal,
  estrangulador (choke), bomba de aceleración, bomba de bencina mecánica.
  Variante antigua de la alimentación.
- **Admisión / mariposa / MAP** 💭 — hoy se representa sólo como `pMan` en
  combustible y como presión de admisión en 4 tiempos.
- **Escape / catalizador / sonda lambda** 💭 — cerraría el lazo de mezcla con
  el módulo de combustible.
- **Turbo** 💭
- **Diésel common-rail** 💭 — contraste con la inyección de bencina.

## Eléctrico

- **Carga** 💭 — dínamo (los más viejos), alternador con regulador externo
  o interno. Hoy es `+1.4 V` fijo con el motor en marcha.
- **Arranque (motor de partida)** 💭 — solenoide, piñón Bendix.
- **Distribución eléctrica** 💭 — fusibles, relés, masas, luces.

## Tren motriz

- **Embrague** 💭 — disco, prensa, collarín, accionamiento por cable o
  hidráulico.
- **Caja de cambios** 💭 — manual y automática (convertidor de par).
- **Disposición de la tracción** 💭 — trasera (cardán, crucetas, puente
  rígido), delantera (semiejes, homocinéticas), 4x4 (caja de transferencia).
- **Diferencial** 💭

## Frenos, suspensión, dirección y ruedas

- **Frenos hidráulicos** 💭 — bomba de freno, servo de vacío, líneas, disco
  y tambor, cálipers, cilindros de rueda, freno de mano, ABS (desde los 90).
- **Suspensión** 💭 — eje rígido con ballestas, McPherson, doble horquilla,
  barra de torsión; amortiguadores, espirales, rótulas, bujes, bandejas.
  Modelo cuasiestático (carga, juego, geometría, desgaste), sin manejo.
- **Dirección** 💭 — caja de bolas recirculantes o cremallera, asistencia
  hidráulica, terminales, alineación (convergencia, caída, avance).
- **Ruedas y neumáticos** 💭 — llanta, neumático (presión, desgaste por
  zona, fecha), rodamientos, balanceo, pernos.

## Chasis y carrocería

- **Estructura** 💭 — chasis de largueros (body-on-frame) o monocasco.
- **Inspección visual** 💭 — óxido, perforación y deformación como pistas
  del diagnóstico. No es una red: va fuera del solver, con plan propio.
- **Soldadura** 💭 — minijuego muy a futuro (`HORIZONTE_JUEGO.md`).
  Enderezado y pintura quedan como ideas sin fecha.

## Variantes por época (1970–2010)

Todo es combustión interna. **Se modela por sistema, no por auto**: cada
sistema es un arquetipo que encapsula sus variantes. Si la física es la
misma, la variante es una pieza intercambiable (platinos o transistor
cortando la misma bobina). Si la física cambia, es un sistema hermano que
publica las mismas señales (carburador e inyección → `fuel.mixture`). El
criterio y la lista de arquetipos los fija A10
(`plans/2026-09-26-sistemas-genericos.md` §1). La tabla sirve para ubicar
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

| | Comb. | Aire | Encend. | Motor | Refrig. | Lubric. | Eléctr. | Escape | Transm. | Frenos | Direc. |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **Combustible** | | ○ vacío ref. | — | ○ mezcla | — | · dilución | ● bomba/relé | ○ lambda | — | — | — |
| **Admisión/aire** | ○ | | — | ○ aire | — | — | ○ sensores | — | — | ○ servo de vacío | — |
| **Encendido** | — | — | | ○ chispa | — | — | ● bobinas | — | — | — | — |
| **Motor (4T)** | ○ | ○ | ○ | | ○ calor + correa | ○ engranaje, tensor | ○ arranque/alternador | ○ gases | ○ embrague | · vacío (vía admisión) | ○ correa |
| **Refrigeración** | — | — | — | ○ | | · culata/enfriador | ● ventilador | — | · enfriador ATF | — | — |
| **Lubricación** | · | — | — | ○ | · | | ○ sensor presión | — | — | — | — |
| **Eléctrico** | ● | ○ | ● | ○ | ● | ○ | | ○ sonda | ○ TCU (automáticas) | ○ ABS | ○ EPS |
| **Escape** | ○ | — | — | ○ | — | — | ○ | | — | — | — |
| **Transmisión** | — | — | — | ○ | · | — | ○ TCU | — | | — | — |
| **Frenos** | — | ○ | — | · vacío | — | — | ○ | — | — | | — |
| **Dirección** | — | — | — | ○ | — | — | ○ | — | — | — | |

**Sistemas que nunca se tocan directamente** (la matriz con `—`), por
ejemplo:
- combustible con refrigeración, frenos, dirección o transmisión;
- encendido con refrigeración, lubricación o frenos;
- frenos con refrigeración o lubricación.

(La matriz es de **contacto**: úsala para descartar, pero un generador de
casos también debe seguir las celdas `·`, porque ahí están las pistas falsas
útiles.) La matriz todavía no incluye suspensión, ruedas ni carrocería;
se completa en A10.

Esto es útil para el juego: un síntoma de frenos **no** sirve de pista para
el encendido. Los descartes también enseñan.

Fuera del cuadro: el servo de frenos usa el vacío del múltiple. Una manguera
del servo rota produce una entrada de aire y un ralentí inestable: un
síntoma de "motor" causado por "frenos". Es un caso clásico para el juego.

## Integración

- **Vehículo** ⏳ A10 (plan) y A15 (código) — `compileVehicle` une los
  circuitos de cada sistema, con una variante por sistema, buses compartidos
  y señales con dueño (P23 §14; reemplaza el orquestador del plan maestro
  §11).

## Juegos (ver `plans/2026-09-22-hoja-de-ruta-juego.md`)

- **Nombrar piezas** 💭 E1 — sobre cualquier diagrama con `parts`.
- **Diagnóstico** 💭 E2 — falla escondida + herramientas + reemplazar piezas.
- **Solver de redes hidráulicas** 💭 E3 — base común para combustible,
  refrigeración y lubricación armables. Luego un solver eléctrico para
  encendido y carga.
- **Armar circuitos** 💭 E4 — arrastrar y conectar; prueba con Phaser.
