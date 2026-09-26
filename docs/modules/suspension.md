# Módulo — Suspensión (`suspension`) — **especificación completa**

> Spec viva, escrita por el agente planificador el 2026-09-26 (plan
> `plans/2026-09-26-suspension.md`). Tarea A22, bloque S2 (después de
> A15). Números de §5.6 de la cuenta del planificador.

## 1. Arquetipo y variantes

Cuatro esquinas, cada una un **modelo de cuarto de auto**: masa suspendida
(la parte de la carrocería que carga esa esquina), resorte, amortiguador,
masa no suspendida (rueda, freno, mangueta) y la rigidez del neumático.
Encima, la geometría: altura, caída (camber) y el cambio de convergencia
por los bujes. Es un **mecanismo** (integrador propio), sin manejo: no se
simula la dinámica lateral del auto, sólo lo que se inspecciona y lo que
se siente (rebotes, golpes, desgaste, tirón).

| Pieza | Antigua | Moderna | Se implementa |
|---|---|---|---|
| Delantera | doble horquilla con espiral | McPherson | las dos |
| Trasera | eje rígido con ballestas | eje torsional (FWD) o multibrazo | ballestas y eje torsional |

Descriptores: `suspension-classic` ("Suspensión años 70": doble horquilla +
ballestas) y `suspension-modern` ("Suspensión años 2000": McPherson + eje
torsional). `#/lab/suspension` redirige a `suspension-modern`. Registrado:
barra de torsión delantera, multibrazo, neumática.

## 2. Piezas (`partId`)

Por esquina (`FL`, `FR`, `RL`, `RR`): `springXX` (espiral u hoja maestra),
`damperXX`, `bumpStopXX`. Delanteras: `ballJointFL/FR`,
`controlArmBushingFL/FR`, y McPherson `strutMountFL/FR` o doble horquilla
`upperArmFL/FR`. Traseras: ballestas `leafShackleRL/RR`, o eje torsional
`beamBushingRL/RR`. Comunes: `swayBarLinkFL/FR`, `body`.

## 3. Parámetros

| key | rango | default | significado |
|---|---|---|---|
| `speedKmh` | 0–140 | 0 | stub de `vehicle.speed` |
| `road` | `'smooth' \| 'rough' \| 'bumps' \| 'washboard'` | `'smooth'` | perfil del camino (rng con semilla) |
| `braking` | 0–1 | 0 | stub de `vehicle.accel` negativa (0,8 g a 1) |
| `load` | 0–400 | 0 | kg de carga en el maletero |

Acciones: `bounceTest(corner)` (hunde esa esquina 50 mm y la suelta),
`speedBump()` (un lomo de toro de 80 mm a la velocidad actual).

## 4. Fallas (ids §26; ejemplo con una esquina, el catálogo las trae para las que dice)

| id §26 | clave | tipo | efecto |
|---|---|---|---|
| `damperFL.worn` … `damperRR.worn` | `damperWornXX` | 0–1 | `c ×(1 − 0,85·s)` |
| `springFL.broken` / `springFR.broken` | `springBrokenXX` | toggle | espiral cortado: `k ×0,8`, la esquina baja ~30 mm |
| `springRL.brokenLeaf` (classic) | `leafBroken` | toggle | hoja maestra rota: `k ×0,6`, el eje se corre 15 mm hacia atrás de ese lado → el auto **tira** |
| `ballJointFL.worn` | `ballJointWorn` | 0–1 | juego `1,5 mm·s`: golpe en baches y caída que baila ±0,5°·s |
| `controlArmBushingFR.worn` | `bushingWorn` | 0–1 | al frenar la convergencia de esa rueda cambia `0,5°·s·braking` → tira al frenar |
| `strutMountFL.worn` (modern) | `strutMountWorn` | toggle | golpe al girar la dirección y en baches |
| `swayBarLinkFR.worn` | `swayLinkWorn` | toggle | traqueteo en caminos rugosos a baja velocidad |
| `leafShackleRL.worn` (classic) | `shackleWorn` | toggle | chirrido y golpe en los baches |

## 5. Física (mecanismo, paso 1 ms, semi-implícito)

### 5.1. Cuarto de auto (por esquina)

`ms·z̈s = −k·(zs − zu) − c·(żs − żu) − F_fricción − F_tope + ms·a_carga`
`mu·z̈u = k·(zs − zu) + c·(żs − żu) + … − kt·(zu − z_camino)` (con
`kt·(…)` sólo en compresión: la rueda puede despegarse).

| | delantera | trasera |
|---|---|---|
| masa suspendida `ms` | 300 kg (+ carga ×0 adelante) | 250 kg (+ carga/2 por lado) |
| no suspendida `mu` | 35 kg | 40 kg (eje rígido: 45) |
| resorte `k` | 25 kN/m | 22 kN/m (ballesta 30 kN/m) |
| amortiguador `c` | 2,0 kN·s/m | 1,7 kN·s/m |
| neumático `kt` | 200 kN/m | 200 kN/m |
| topes | a ±80 mm, 500 kN/m | |
| fricción entre hojas (ballesta) | — | Coulomb 250 N (amortigua sola; con óxido 600 N: más dura) |

Frecuencias sanas: carrocería 1,45 Hz (ζ = 0,37), rueda 12,8 Hz. Con
`ωdt = 0,076` el Euler semi-implícito es estable.

### 5.2. Camino

`z_camino(x)`: `smooth` 0; `rough` ruido de banda 0,5–20 Hz a 50 km/h con
±8 mm (rng con semilla, precalculado por distancia); `bumps` baches de
30 mm cada 12 m; `washboard` ondas de 10 mm cada 0,8 m. La trasera recibe
el mismo perfil con el retraso de la batalla (2,5 m / v).

### 5.3. Geometría

- Altura por esquina = altura nominal − hundimiento estático − `zs`.
- Caída: doble horquilla `−0,5° − 0,015°/mm·Δh`; McPherson `−0,5° −
  0,008°/mm·Δh`; trasera eje rígido/torsional 0° fijo; + el baile de la
  rótula (`±0,5°·s` con el signo de la carga).
- Cambio de convergencia por bujes: `0,5°·bushingWorn·braking` (la rueda
  abre al frenar). Ballesta rota: ángulo de empuje del eje `0,35°` → tirón
  constante.
- Tirón: `pull = Σ(convergencias efectivas y empuje) ×k_pull` (grados →
  "tira a la izq/der"), lo publica para la dirección.

### 5.4. Ruidos

`clunk` cuando la fuerza en una rótula/buje/soporte gastado cambia de
signo con `|ΔF| > 800 N` en 20 ms; `rattle` (bieletas) con
`road='rough'` y `v < 40`; `squeak` (gemelas) en baches. Eventos como en
`drivetrain.md` §5.7 (mismos drawers de onda).

### 5.5. Prueba de rebote

`bounceTest`: la esquina se suelta desde −50 mm; se cuentan los cruces de
la posición de equilibrio con amplitud > 5 mm. Sano: 1; amortiguador
gastado: 3 o más. Lo publica como lectura.

### 5.6. Referencia (planificador)

| desgaste del amortiguador | ζ | cruces con > 5 mm en la prueba de rebote (desde 50 mm) |
|---|---|---|
| 0 | 0,37 | 1 (50 → 14,6 → 4,3 mm) |
| 0,5 | 0,21 | 3 |
| 0,8 | 0,12 | 6 |
| 1,0 | 0,055 | 13 |

Espiral cortado (`k ×0,8`): hundimiento estático 118 → 147 mm (−29 mm).

## 6. Estado

Por esquina: `zs`, `zu` (mm), `rideHeight` (mm), `camber` (°),
`toeDelta` (°), `tireLoad` (N), `airborne` (bool). Global: `pull` (°
equivalentes), `bounceCount`, `noises`, `pitch` (°), `roll` (°).

## 7. Lecturas

Altura por esquina (verde ±10 mm de la nominal), caída por esquina, carga
del neumático (N, `history` en la esquina elegida: con amortiguador
gastado varía mucho y la rueda "salta"), rebotes de la última prueba,
tirón.

## 8. Vista (viewBox 1300×720)

Vista trasera de un eje (dos esquinas con la geometría real: brazos,
rótulas, resorte que se comprime, amortiguador que se estira; la rueda
inclinada según la caída) y vista lateral del auto con las 4 alturas y el
camino que pasa debajo. En la clásica, la ballesta con sus hojas y
gemelas. Drawers en `src/render/svg/drawers/suspension/`: `cornerFront`,
`cornerRear`, `leafSpring`, `carSideSuspension`, `roadStrip`,
`noiseWave` (el de A21).

## 9. Narración

- rebotes ≥ 3 → warn: "La esquina {x} rebota {n} veces: el amortiguador ya
  no frena el resorte."
- altura −20 mm → warn: "La esquina {x} está baja: resorte cortado o
  vencido."
- `clunk` → warn: "Golpe en {pieza}: tiene juego."
- rueda despegada en baches → warn: "Con amortiguadores gastados la rueda
  salta: pierde agarre en el camino rugoso."
- tirón → warn: "El auto tira hacia la {x}: {buje al frenar | eje corrido
  por la ballesta rota}."

## 10. Presets

"Camino liso", "Camino de ripio con amortiguadores gastados", "Prueba de
rebote", "Espiral cortado", "Rótula con juego", "Tira al frenar" (buje),
"Ballesta rota" (classic), "Bieletas sueltas", "Maletero cargado" (400 kg).

## 11. Tests (`tests/suspension/*.test.ts`)

1. Equilibrio: hundimiento estático delantero 118 ± 2 mm; con
   `springBroken` 147 ± 3.
2. `bounceTest` sano: `bounceCount ≤ 1`; `damperWorn = 0,5`: ≥ 2;
   `damperWorn = 0,8`: ≥ 4.
3. Frecuencia libre de la carrocería (sin amortiguador) 1,45 ± 0,05 Hz;
   de la rueda 12,8 ± 0,5 Hz.
4. `road='rough'` a 60 km/h: desvío estándar de `tireLoad` con
   `damperWorn = 1` ≥ 1,6× el sano; aparece `airborne`.
5. `ballJointWorn = 1` con `road='bumps'`: eventos `clunk` en esa esquina;
   sano, ninguno.
6. `bushingWorn = 1`, `braking = 1`: `|pull|` > 0,3; con `braking = 0`,
   ≈ 0.
7. `leafBroken` (classic): `pull` ≠ 0 con `braking = 0`.
8. Caída: McPherson con 30 mm de hundimiento extra → −0,24° ± 0,03.
9. Estabilidad numérica: 60 s de `washboard` a 100 km/h sin `NaN` y con
   energía acotada. Robustez y determinismo.

## 12. En el vehículo

- **Publica**: `suspension.camberFL`…`RR` (°), `suspension.toeDeltaFL`…
  (°), `suspension.loadFL`… (N), `suspension.pull` (°).
- **Lee**: `vehicle.speed`, `vehicle.accel`, `steering.angle` (A23; el
  soporte superior golpea al girar).
- Las ruedas (A24) usan caída y carga para el desgaste; la dirección
  (A23) suma `toeDelta` y `pull` al tirón total.
