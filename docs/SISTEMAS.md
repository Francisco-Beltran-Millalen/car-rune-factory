# Sistemas — catálogo del auto, mapeado a módulos

Catálogo de a dónde apuntar, no compromiso de orden. La prioridad real vive en
`NORTE.md` → Módulos y en `AHORA.md`. Estado: ✅ hecho · ⏳ planificado ·
💭 idea.

## Motor

- **Alimentación de combustible** ⏳ `fuel` — estanque, bomba eléctrica,
  colador, válvula check, filtro, riel, 4 inyectores, regulador con
  referencia de vacío, retorno. Spec completa en `modules/fuel.md`.
- **Ciclo de 4 tiempos** ⏳ `four-stroke` — pistón, biela, cigüeñal,
  válvulas, árbol de levas, correa de distribución 2:1, diagrama P-V.
  `modules/four-stroke.md`.
- **Encendido** ⏳ `ignition` — batería, ECU, sensor de cigüeñal 60-2,
  transistor, bobina COP, bujía, osciloscopio. `modules/ignition.md`.
- **Refrigeración** ⏳ `cooling` — bomba de agua, termostato, radiador,
  ventilador, calefactor, depósito de expansión, tapa a presión.
  `modules/cooling.md`.
- **Lubricación** ⏳ `lubrication` — cárter, bomba de engranajes, válvula de
  alivio, filtro con bypass, galerías, cojinetes, luz de presión.
  `modules/lubrication.md`.
- **Admisión / mariposa / MAP** 💭 — hoy se representa sólo como `pMan` en
  combustible y como presión de admisión en 4 tiempos.
- **Escape / catalizador / sonda lambda** 💭 — cerraría el lazo de mezcla con
  el módulo de combustible.
- **Turbo** 💭
- **Diésel common-rail** 💭 — contraste con la inyección de bencina.

## Eléctrico

- **Carga (alternador + regulador)** 💭 — hoy es `+1.4 V` fijo con el motor
  en marcha.
- **Arranque (motor de partida)** 💭

## Tren motriz y chasis

- **Embrague / caja de cambios** 💭
- **Frenos hidráulicos** 💭 — bomba de freno, servo de vacío, cálipers, ABS.
- **Dirección hidráulica** 💭

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
| **Motor (4T)** | ○ | ○ | ○ | | ○ calor + correa | ○ engranaje | ○ arranque/alternador | ○ gases | ○ embrague | — | ○ correa |
| **Refrigeración** | — | — | — | ○ | | · culata/enfriador | ● ventilador | — | · enfriador ATF | — | — |
| **Lubricación** | · | — | — | ○ | · | | ○ sensor presión | — | — | — | — |
| **Eléctrico** | ● | ○ | ● | ○ | ● | ○ | | ○ sonda | — | ○ ABS | ○ EPS |
| **Escape** | ○ | — | — | ○ | — | — | ○ | | — | — | — |
| **Transmisión** | — | — | — | ○ | · | — | — | — | | — | — |
| **Frenos** | — | ○ | — | — | — | — | ○ | — | — | | — |
| **Dirección** | — | — | — | ○ | — | — | ○ | — | — | — | |

**Sistemas que nunca se tocan directamente** (la matriz con `—`), por
ejemplo:
- combustible con refrigeración, frenos, dirección o transmisión;
- encendido con refrigeración, lubricación o frenos;
- frenos con refrigeración o lubricación.

Esto es útil para el juego: un síntoma de frenos **no** sirve de pista para
el encendido. Los descartes también enseñan.

Fuera del cuadro: el servo de frenos usa el vacío del múltiple. Una manguera
del servo rota produce una entrada de aire y un ralentí inestable: un
síntoma de "motor" causado por "frenos". Es un caso clásico para el juego.

## Integración

- **Motor completo** 💭 `engine` — orquestador que conecta módulos copiando
  señales de un `state` al `params` de otro (§11). Ver sección 11 del plan
  maestro.

## Juegos (ver `plans/2026-09-22-hoja-de-ruta-juego.md`)

- **Nombrar piezas** 💭 E1 — sobre cualquier diagrama con `parts`.
- **Diagnóstico** 💭 E2 — falla escondida + herramientas + reemplazar piezas.
- **Solver de redes hidráulicas** 💭 E3 — base común para combustible,
  refrigeración y lubricación armables. Luego un solver eléctrico para
  encendido y carga.
- **Armar circuitos** 💭 E4 — arrastrar y conectar; prueba con Phaser.
