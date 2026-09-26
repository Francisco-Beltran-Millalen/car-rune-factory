# Módulo — Ruedas y neumáticos (`wheels`) — **especificación completa**

> Spec viva, escrita por el agente planificador el 2026-09-26 (plan
> `plans/2026-09-26-wheels.md`). Tarea A24, bloque S2 (después de A15;
> mejor después de A22 y A23, que le dan caída, carga y convergencia).

## 1. Arquetipo y variantes

Cuatro ruedas: llanta, neumático radial, rodamiento y pernos. Lo que se
diagnostica: presión, desgaste por zona (la "huella" cuenta la historia de
la alineación y la presión), edad, balanceo, llanta doblada, rodamiento y
pernos. Es un **mecanismo** con dos escalas de tiempo: la marcha (vibración
y ruido, en vivo) y el uso (desgaste y pérdida de presión, con acciones que
integran kilómetros o días).

Un descriptor: `wheels` ("Ruedas y neumáticos"). Llanta de acero o de
aleación: sólo cambia el dibujo (param). Registrado: neumático diagonal
(años 60–70), run-flat, TPMS.

## 2. Piezas (`partId`)

Por rueda (`FL`, `FR`, `RL`, `RR`): `tireXX`, `rimXX`, `bearingXX`,
`lugNutsXX`, `valveXX`, `balanceWeightsXX`. Herramientas del laboratorio
(sólo visuales): `treadGauge`, `pressureGauge`, `balancer`.

## 3. Parámetros

| key | rango | default | significado |
|---|---|---|---|
| `speedKmh` | 0–160 | 0 | stub de `vehicle.speed` |
| `steer` | −1–1 | 0 | stub de la curva; `+` = hacia la izquierda (carga las ruedas derechas) |
| `wet` | bool | false | camino mojado (agarre) |
| `camberXX` | −3–1 | −0,5 | stub de `suspension.camberXX` (°) |
| `toeXX` | −1–1 | 0,1 | stub de `steering.toeXX` (°) |
| `rimType` | `'steel' \| 'alloy'` | `'steel'` | dibujo |

Acciones: `inflate(rueda, bar)`, `drive(km)` (integra desgaste y pérdida de
presión con los params actuales), `park(días)`, `newTire(rueda)` (estado:
8 mm, edad 0), `retorque(rueda)`.

## 4. Fallas (ids §26)

| id §26 | clave | tipo | efecto |
|---|---|---|---|
| `tireFL.slowLeak` (y las otras) | `slowLeakXX` | 0–1 | `dp/dt = −0,02·s·√p` bar/día (sólo en `drive`/`park`: en vivo no se nota) |
| `balanceWeightsFL.lost` | `imbalanceFL` | 0–1 | desbalance `60 g·s` a 20 cm del eje |
| `rimFR.bent` | `rimBentFR` | 0–1 | descentrado `1,5 mm·s` |
| `bearingRL.worn` | `bearingWornRL` | 0–1 | zumbido ∝ velocidad y juego `2 mm·s` en el borde |
| `lugNutsFR.loose` | `lugsLooseFR` | toggle | golpeteo, bamboleo creciente con la distancia (estado `lugProgress`; a 1 la rueda se sale — narración bad) |
| `tireRR.bulge` | `bulgeRR` | toggle | chichón en el flanco (daño interno): vibración leve y riesgo |
| `tireRL.old` | `tireOldRL` | 0–1 | edad `10·s` años: goma dura, grietas, agarre en mojado ↓ |

## 5. Física

### 5.1. Desgaste (`drive(km)`)

Base: `0,16 mm/1000 km` por zona (8 → 1,6 mm en 40 000 km). Multiplicador
por zona (interior, centro, exterior), con `pr = p/2,2`:

- presión alta: centro ×`(1 + 2·(pr − 1)⁺)`; baja: hombros ×`(1 + 3·(1 −
  pr)⁺)`;
- caída negativa: interior ×`(1 + 1,5·|camber + 0,5|)` si `camber < −0,5`;
  positiva: exterior igual;
- convergencia fuera de 0,1°: los dos hombros `+0,03 mm/1000 km` por cada
  0,1° de diferencia, y bandera `feathering` (dientes de sierra);
- carga (`suspension.load`, stub 3000 N): ×`carga/3000`.

### 5.2. Agarre

`grip = 1·f_huella·f_presión·f_edad`: `f_huella = 1` en seco; mojado
`clamp(0,4 + 0,1·huella_min, 0,4, 1)` (a 2 mm, 0,6); `f_presión = 1 −
0,5·|pr − 1|`; `f_edad = 1 − 0,03·max(0, años − 6)`. Lo publica para
frenos y tren motriz (multiplica su `roadMu`).

### 5.3. Vibración en marcha

Rotación `f = v/(2π·0,30)` Hz (14,7 Hz a 100 km/h). Fuerzas:
desbalance `F = m·0,2·ω²`; llanta doblada `F = 200 N/mm·e` (el neumático
empuja con su rigidez: se siente a toda velocidad). Respuesta con el salto
de rueda de la suspensión (12,8 Hz, ζ = 0,3): `A = F/k·1/√((1 − r²)² +
(2ζr)²)`. Delanteras → `shimmy` (volante), traseras → `seatVibration`.
El producto `ω²·respuesta` tiene su máximo en `r = 1/√(1 − 2ζ²) = 1,10`
(14,1 Hz): con desbalance el pico está en **~96 km/h**; a 50 km/h la
vibración es ~25 % del pico. Con llanta doblada (fuerza constante) a 30
km/h ya es ~70 % de la de 90.

### 5.4. Rodamiento

`hum = bearingWorn·(v/100)·(1 + 0,8·carga_lateral)`, donde la carga lateral
de la rueda sube en la curva hacia el lado contrario (girando a la
izquierda carga las derechas): **suena más al doblar hacia el lado
contrario**, la prueba clásica.

### 5.5. Pernos

Con `lugsLoose`: `lugProgress += 1/300 km` (acelerado), `wobble =
lugProgress·(v/50)`, `clunk` al arrancar y frenar; a 1 → estado
`wheelOff` (el laboratorio se detiene y lo narra).

## 6. Estado

Por rueda: `pressure` (bar), `tread` ([interior, centro, exterior] mm),
`age` (años), `grip`, `feathering` (bool), `hum`, `vibration`,
`lugProgress`, `play` (mm). Global: `shimmy`, `seatVibration`, `km`
recorridos, `noises`.

## 7. Lecturas

Presión de cada rueda (verde 2,0–2,4), huella mínima (verde > 3 mm), perfil
de la rueda elegida (3 números), agarre, vibración del volante y del
asiento (`history`), zumbido (`history`), km recorridos.

## 8. Vista (viewBox 1300×720)

Arriba el auto de planta con las 4 ruedas (color por presión, con el
chichón y las grietas si hay); abajo a la izquierda la rueda elegida en
corte con la huella en sus 3 zonas (profundidad a escala, dientes de
sierra con `feathering`), el medidor de profundidad y el manómetro;
abajo a la derecha la balanceadora (la rueda gira y marca gramos y
posición) y un gráfico de vibración vs velocidad. Drawers en
`src/render/svg/drawers/wheels/`: `carTopWheels`, `tireSection`,
`treadGauge`, `balancer`, `vibrationPlot`.

## 9. Narración

- presión < 1,8 → warn: "La rueda {x} está baja: se gastan los hombros y
  se calienta."
- desgaste interior > 1,5× exterior → warn: "La rueda {x} se come por
  dentro: caída negativa (suspensión)."
- `feathering` → warn: "Dientes de sierra: la convergencia está mal."
- shimmy con pico entre 85 y 105 → warn: "Vibra el volante cerca de los
  100 km/h: desbalance delantero."
- vibración también a 30 km/h → warn: "Vibra aun despacio: llanta doblada."
- hum que cambia en las curvas → warn: "Zumbido que sube al doblar hacia la
  {x}: rodamiento de la rueda {y}."
- `lugProgress > 0,5` → bad: "¡La rueda {x} se está soltando!"

## 10. Presets

"Neumáticos nuevos", "20 000 km con poca presión", "20 000 km con caída
negativa", "Convergencia abierta", "Vibra a 90" (desbalance FL 0,5), "Llanta
doblada", "Rodamiento trasero", "Pernos flojos", "Neumático viejo en
mojado", "Pinchazo lento".

## 11. Tests (`tests/wheels/*.test.ts`)

1. `drive(40000)` sano: huella 1,6 ± 0,3 en las tres zonas.
2. Presión 1,6 y `drive(20000)`: hombros ≥ 1,5× el desgaste del centro;
   presión 2,8: centro ≥ 1,5× hombros.
3. `camber = −2` y `drive(20000)`: interior ≥ 2× exterior.
4. `toe = 0,6` → `feathering`.
5. `imbalanceFL = 0,5`: pico de `shimmy` entre **85 y 105 km/h**; a 50
   km/h < 30 % del pico.
6. `rimBentFR = 1`: vibración a 30 km/h ≥ 50 % de la de 90.
7. `bearingWornRL = 1`: `hum` ∝ velocidad (±5 %) y mayor con
   `steer = −1` (doblando a la derecha se carga la izquierda) que con
   `steer = +1`.
8. `slowLeak = 1`: `park(30)` desde 2,2 → < 1,6.
9. Agarre: mojado con 2 mm → [0,55; 0,65]; seco → 1.
10. Robustez y determinismo.

## 12. En el vehículo

- **Publica**: `wheel.pressureFL`…`RR` (bar; la lee la dirección para el
  tirón), `wheel.gripFL`… (0..1; frenos y tren motriz), `wheel.shimmy`,
  `wheel.noise`.
- **Lee**: `vehicle.speed`, `suspension.camber*`, `suspension.load*`,
  `steering.toe*`, `steering.angle`.
