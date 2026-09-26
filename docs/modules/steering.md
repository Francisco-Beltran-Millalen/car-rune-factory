# Módulo — Dirección (`steering`) — **especificación completa**

> Spec viva, escrita por el agente planificador el 2026-09-26 (plan
> `plans/2026-09-26-steering.md`). Tarea A23, bloque S2 (después de A15;
> mejor después de A22). Números de §5.6 de la cuenta del planificador.

## 1. Arquetipo y variantes

Volante → columna → mecanismo reductor → varillaje → manguetas, con o sin
asistencia, y la **alineación** (convergencia) que ajustan las bieletas.

| Pieza | Antigua | Moderna | Se implementa |
|---|---|---|---|
| Mecanismo | caja de bolas recirculantes + brazo pitman, barra central y brazo loco | cremallera y piñón | las dos |
| Asistencia | ninguna | hidráulica (bomba en la correa, válvula rotativa, cilindro en la cremallera) | las dos (sin / con) |

Descriptores: `steering-box` ("Dirección años 70": caja, manual) y
`steering-rack` ("Dirección años 2000": cremallera hidráulica).
`#/lab/steering` redirige a `steering-rack`. Registrado: caja con
asistencia hidráulica, asistencia eléctrica (EPS).

## 2. Piezas (`partId`)

Comunes: `steeringWheel`, `column`, `columnUJoint`, `tieRodEndL`,
`tieRodEndR`, `knuckleL`, `knuckleR`. Caja: `steeringBox`, `pitmanArm`,
`centerLink`, `idlerArm`. Cremallera: `rack`, `pinion`, `innerTieRodL/R`,
`rackBoots`, `psPump`, `psReservoir`, `rotaryValve`, `torsionBar`,
`rackCylinder`, `psHoses`.

## 3. Parámetros

| key | rango | default | significado |
|---|---|---|---|
| `wheelAngle` | −540–540 | 0 | grados del volante (el slider mueve el volante; la velocidad del cambio es la de la mano) |
| `speedKmh` | 0–140 | 0 | stub de `vehicle.speed` |
| `rpm` | 0–6500 | 800 | stub (la bomba) |
| `toeL`, `toeR` | −1–1 | 0,1 | convergencia de cada rueda (°, + = hacia adentro) |

Acción: `alignment()` (pone las convergencias en 0,1° y centra el volante:
arregla estado; las bieletas dobladas siguen siendo falla).

## 4. Fallas (ids §26)

| id §26 | clave | tipo | efecto |
|---|---|---|---|
| `tieRodEndL.worn` | `tieRodWorn` | 0–1 | juego `1,5°·s` de volante y golpeteo en baches |
| `tieRodL.bent` | `tieRodBent` | 0–1 | convergencia izquierda `+0,8°·s`: volante chueco y desgaste del neumático |
| `steeringBox.worn` (box) | `boxWorn` | 0–1 | juego `8°·s` en el centro |
| `idlerArm.worn` (box) | `idlerWorn` | 0–1 | juego `3°·s` y el auto "vaga" |
| `psPump.wear` (rack) | `pumpWear` | 0–1 | caudal ×`(1 − 0,8·s)`: dura al estacionar en ralentí |
| `psReservoir.low` (rack) | `fluidLow` | 0–1 | aire: zumbido y caudal ×`(1 − 0,6·s)` |
| `rackCylinder.sealLeak` (rack) | `sealLeak` | 0–1 | fuga interna entre cámaras: dura hacia los dos lados |
| `rotaryValve.worn` (rack) | `valveWorn` | 0–1 | válvula descentrada: asiste hacia un lado sin tocar el volante → **tira** |
| `columnUJoint.notchy` | `uJointNotchy` | toggle | el volante "salta" por muescas al girar lento |

## 5. Física

### 5.1. Torque que pide el suelo (en la cremallera)

`F_suelo = 4000 N·(1/(1 + v/8)) + 50 N/°·δ_rueda·(v/50)` (al estacionar,
el neumático se retuerce; en marcha manda el autoalineante, que devuelve
el volante al centro), con signo del giro; `v` en **km/h** y `δ_rueda` en
grados. `δ_rueda = ángulo del volante /
relación`, relación 18:1 (caja) o 16:1 (cremallera).

### 5.2. Manual (caja)

`T_volante = F_suelo·r_eq/η`, con `r_eq = 5,6 mm` (equivalente de la
relación) y `η = 0,75` (la caja de bolas): al estacionar ~30 N·m.

### 5.3. Asistida (cremallera; red del solver, fluido `atf`, bar y L/h)

| pieza | elemento | valores |
|---|---|---|
| bomba | `displacementPump` (A14) | `disp = 8,3e-3 L/rev`, `wearQ = 0,8`, `slip = 2 L/h/bar` (×`(1 + 4·wear)`), `n = min(1,2·rpm, 960/(1 − 0,8·wear))`: la válvula de caudal limita a 8 L/min; una bomba gastada llega a ese tope recién con más rpm y además pierde por dentro (con 0,8 no pasa de ~20 bar en ralentí) |
| alivio | `reliefRegulator` | 80 bar |
| válvula rotativa (centro abierto) | 4 `variableOrifice` en puente | `open = clamp(0,5 ± twist/4°, 0,02, 1)` (+ `valveWorn·0,3°` de descentrado): alimentación→A y B→retorno abren con `+twist`; las otras dos cierran |
| cámaras del cilindro | `volume` ×2 | `c = 0,02 L/bar` |
| fuga del sello | `linearRestrictor` (A14) A↔B | `g = 40·sealLeak` L/h/bar |
| depósito | `tank` | 0,5 L; aire si baja (`fluidLow`) |

Barra de torsión `k = 2 N·m/°`. Equilibrio cuasiestático de la
cremallera (controlador, con la presión del paso anterior):
`k·twist/r_piñón + (pA − pB)·A_pistón = F_suelo`, con `r_piñón = 7 mm`,
`A_pistón = 8 cm²` (1 bar = 80 N). El controlador ajusta `twist` con
relajación (`twist += 0,2·error/k_ef` por paso). `T_volante = k·twist`.

### 5.4. Juego, centro y tirón

- Juego total (zona muerta del volante) = `1,5·tieRod + 8·box + 3·idler`
  (+ 0,5° de fábrica).
- Volante chueco: con convergencias distintas, para ir derecho el volante
  queda girado `≈ 4°·(toeL − toeR)/0,5°`.
- Tirón = convergencia (`toeL − toeR`), `suspension.pull` (A22),
  diferencia de presión de neumáticos (`wheel.pressure*`, A24:
  `0,3°/bar`), válvula descentrada. Se muestra en grados equivalentes y
  como "tira a la izq/der".
- Zumbido de la bomba: `∝ aire + (presión > 70 bar)` (al tope del giro).

### 5.5. Retorno

Con `v > 10` y el volante suelto, el autoalineante lo vuelve al centro
(el slider pasa a "suelto" con el botón `release()`; con mucho juego o la
cruceta con muescas, vuelve mal).

### 5.6. Referencia (planificador)

| caso | torque al volante |
|---|---|
| caja manual, estacionando | ~30 N·m |
| cremallera asistida, estacionando, ralentí | 3–5 N·m (Δp ≈ 45 bar) |
| asistida con bomba gastada 0,8, ralentí | ≥ 12 N·m (a 2500 rpm vuelve a ~5) |
| a 100 km/h | 2–4 N·m (autoalineante) |

## 6. Estado

`wheelAngle`, `roadAngle` (°), `effort` (N·m), `twist` (°), `pA`, `pB`
(bar), `assistForce` (N), `qPump` (L/h), `play` (°), `offCenter` (°),
`pull` (°), `whine` (0..1), `noises`.

## 7. Lecturas

Esfuerzo en el volante (N·m, `history`), presión de asistencia (bar,
`history`), caudal de la bomba, juego (°, verde < 2), volante chueco (°),
tirón (°), convergencias.

## 8. Vista (viewBox 1300×700)

Vista de arriba del tren delantero: volante con una marca (se ve chueco),
columna con la cruceta, caja con pitman/barra central/brazo loco o
cremallera con el piñón y el cilindro (las dos cámaras coloreadas por
presión), bieletas con rótulas (juego dibujado), ruedas que giran y
muestran la convergencia exagerada ×10. Bomba con la correa, depósito
(nivel y burbujas), mangueras con partículas `p-atf` (clase nueva, token
`--atf`). Drawers en `src/render/svg/drawers/steering/`: `steeringWheel`,
`steeringBox`, `rackPinion`, `rotaryValve`, `psPump`, `frontAxleTop`.

## 9. Narración

- esfuerzo > 20 N·m estacionando con asistencia → warn: "Dirección dura:
  la bomba no da presión en ralentí."
- `whine` → warn: "Zumba la bomba: le falta líquido o llegó al tope."
- juego > 4° → warn: "El volante tiene {x}° de juego: rótulas o caja."
- `offCenter > 2` → warn: "Para ir derecho el volante queda chueco: la
  convergencia no es igual en las dos ruedas."
- tirón por la válvula → warn: "La asistencia empuja hacia un lado sin
  girar el volante: válvula rotativa gastada."

## 10. Presets

"Estacionar (caja manual)", "Estacionar (asistida)", "Bomba gastada",
"Falta líquido", "Bieleta doblada: volante chueco", "Rótulas con juego",
"Caja con juego" (box), "Tira sola" (válvula).

## 11. Tests (`tests/steering/*.test.ts`)

1. Caja manual estacionando (volante a 180°, v = 0): esfuerzo en
   **[25; 35] N·m**.
2. Asistida estacionando en ralentí: esfuerzo en **[2; 6] N·m** y
   `pA − pB` en [35; 60] bar. `failures === 0`.
3. `pumpWear = 0,8`: ralentí ≥ 12 N·m; 2500 rpm ≤ 7.
4. `sealLeak = 1`: esfuerzo ≥ 2× el sano hacia los dos lados.
5. `valveWorn = 1` con volante a 0: `|pull| > 0,2°` y `pA ≠ pB`.
6. `tieRodBent = 1`: `offCenter` en [5; 8]°.
7. `boxWorn = 1`: `play` ≥ 8°.
8. Al tope (volante a 540°): presión ≤ 82 bar (alivio) y `whine > 0`.
9. Robustez y determinismo.

## 12. En el vehículo

- **Publica**: `steering.angle` (° de rueda), `steering.toeFL`/`FR` (°,
  convergencia estática + bieletas; la usan las ruedas para el desgaste),
  `steering.pull` (°, total).
- **Lee**: `vehicle.speed`, `engine.rpm`, `belt.slip` (A17: la bomba va en
  la correa), `suspension.pull`, `suspension.toeDelta*`,
  `wheel.pressureFL`/`FR`.
