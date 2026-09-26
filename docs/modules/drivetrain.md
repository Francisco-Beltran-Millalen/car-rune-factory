# Módulo — Tren motriz (`drivetrain`) — **especificación completa**

> Spec viva, escrita por el agente planificador el 2026-09-26 (plan
> `plans/2026-09-26-drivetrain.md`). Tarea A21, bloque S2 (después de
> A15). Números de §5.8 de la simulación de referencia del planificador.

## 1. Arquetipo y variantes

Embrague de fricción → caja manual de 5 → diferencial → ruedas, más el
auto que acelera y frena. Es un **mecanismo** (no usa el solver). Con este
sistema las rpm del motor dejan de ser un control: salen del balance de
torques (§5.6).

| Pieza | Antigua | Moderna | Se implementa |
|---|---|---|---|
| Disposición | tracción trasera: cardán con 2 crucetas y puente rígido | tracción delantera: 2 semiejes con 4 homocinéticas | las dos |
| Accionamiento del embrague | cable | hidráulico | cable en RWD, hidráulico en FWD (cambia la falla) |
| Caja | manual 4–5 | manual 5 | manual 5 en las dos |

Descriptores: `drivetrain-rwd` ("Tracción trasera, años 70") y
`drivetrain-fwd` ("Tracción delantera, años 2000"). `#/lab/drivetrain`
redirige a `drivetrain-fwd`. Registrado: automática con convertidor de
par, 4x4 con caja de transferencia, diferencial autoblocante.

## 2. Piezas (`partId`)

`clutchPedal`, `clutchCable` (rwd) / `clutchMaster` + `clutchSlave`
(fwd), `releaseBearing` (collarín), `pressurePlate` (prensa),
`clutchDisc`, `flywheel`, `gearbox`, `synchro1`…`synchro5`,
`shiftLever`, `differential`, `engineMount`. RWD: `driveshaft`,
`uJointFront`, `uJointRear`, `rearAxle`. FWD: `halfShaftL`, `halfShaftR`,
`cvJointOuterL`, `cvJointOuterR`, `cvJointInnerL`, `cvJointInnerR`.
Ruedas como consumidores: `wheels`.

## 3. Parámetros

| key | rango | default | significado |
|---|---|---|---|
| `throttle` | 0–1 | 0 | acelerador |
| `clutchPedal` | 0–1 | 0 | 1 = pisado a fondo (desembragado) |
| `gear` | `'R' \| 'N' \| '1'…'5'` | `'N'` | palanca |
| `brake` | 0–1 | 0 | stub del freno (torque total `3000·brake` N·m repartido 60/40); en el vehículo, `brakes.torque*` |
| `steer` | −1–1 | 0 | ángulo de la dirección (curva cerrada a ±1) |
| `grade` | −0,15–0,15 | 0 | pendiente |
| `engineOn` | bool | true | stub: motor en marcha (en el vehículo, `engine.state`) |

Acción: `launchTest()` (0–100 km/h con cambios automáticos a 5500 rpm).

## 4. Fallas (ids §26)

| id §26 | clave | tipo | efecto |
|---|---|---|---|
| `clutchDisc.worn` | `clutchWorn` | 0–1 | μ ×`(1 − 0,6·s)`: patina a fondo en marchas altas |
| `clutchDisc.oily` | `clutchOily` | toggle | μ ×0,5 y tirones al arrancar (vibración al embragar) |
| `clutchCable.stretched` / `clutchSlave.air` | `clutchDrag` | 0–1 | no desembraga del todo: con el pedal a fondo queda `0,3·s` de la capacidad → **raspa** al meter los cambios y el auto se arrastra |
| `releaseBearing.worn` | `releaseBearingWorn` | toggle | chillido con el pedal pisado |
| `synchro2.worn` | `synchro2Worn` | 0–1 | el 2.º sincroniza con torque ×`(1 − 0,8·s)`: raspa en cambios rápidos |
| `gearbox.detent3` | `detent3Worn` | toggle | la 3.ª se sale al soltar el acelerador |
| `gearbox.lowOil` | `gearboxLowOil` | 0–1 | zumbido ∝ velocidad y cambios duros |
| `differential.bearing` | `diffBearing` | 0–1 | aullido ∝ velocidad al acelerar (y distinto al soltar) |
| `uJointRear.worn` (rwd) | `uJointWorn` | 0–1 | golpe seco al cambiar de acelerar a soltar y vibración 1× cardán |
| `cvJointOuterL.worn` (fwd) | `cvWorn` | 0–1 | "clac-clac" en curvas cerradas acelerando |
| `engineMount.broken` | `mountBroken` | toggle | golpe al embragar y al cambiar de carga; el motor se mueve (canal) |

## 5. Física (mecanismo, paso 1 ms)

### 5.1. Constantes

| | valor |
|---|---|
| relaciones | 1.ª 3,5 · 2.ª 2,1 · 3.ª 1,4 · 4.ª 1,0 · 5.ª 0,8 · R 3,3 |
| diferencial | 4,1 |
| rendimiento | 0,92 |
| radio de rueda | 0,30 m |
| masa | 1100 kg; `Cd·A = 0,7 m²`; `Crr = 0,012` |
| reparto estático | FWD 60/40 (motrices adelante: 660 kg); RWD 53/47 (motrices atrás: 517 kg); transferencia al acelerar `ΔN = m·a·0,55/2,5` hacia atrás |
| inercias | motor + volante 0,15 kg·m²; entrada de la caja 0,02; ruedas 1,0 c/u |
| embrague | `Tc = μ·F·r_ef·2`, `μ = 0,3`, `F = 4000 N·(1 − pedal)`, `r_ef = 0,1 m` → 240 N·m embragado |
| sincronizadores | torque de sincronización 30 N·m (en la entrada) |

### 5.2. Motor (laboratorio)

`T_motor = throttle_ef^0,8·Tmax(rpm) − Tf(rpm)`, `Tmax = 160·(1 −
((rpm − 3500)/5000)²)` N·m, `Tf = 12 + 0,002·rpm`. Ralentí: un
regulador PI sube `throttle_ef` sobre el pedal para sostener 800 rpm (es la
IAC o el tornillo tope; `throttle_ef ≈ 0,07` en vacío). Bajo 400 rpm con
el motor cargado → se para (`engineOn` pasa a estado `stalled`; se vuelve a
partir con la acción `restart()`).

### 5.3. Embrague (fricción con traba, modelo de Karnopp)

Estado `locked`. Trabado: motor y entrada giran juntos; se calcula el
torque que haría falta para seguir trabados y si supera `Tc` se destraba.
Patinando: `T_emb = Tc·sign(ω_motor − ω_entrada)`; si la diferencia cambia
de signo y `Tc` alcanza, se traba. Calor: `Q = T_emb·|Δω|` a una masa de
2 kJ/K con enfriamiento 10 W/K: estado `clutchTemp` (olor a quemado sobre
250 °C).

### 5.4. Caja y sincronizadores

Meter un cambio con la entrada girando a `ω_in` distinta de `ω_salida·i`
exige sincronizar: el sincronizador aplica 30 N·m (× `(1 − 0,8·wear)` en
el 2.º) contra la inercia de la entrada **más el arrastre del embrague**
(`clutchDrag`). Si en 0,25 s no sincroniza → **raspa** (evento `grind`) y
el cambio no entra hasta que se suelte y se vuelva a intentar. La
reversa no tiene sincronizador: con el auto andando o con arrastre, raspa
siempre. `detent3Worn`: con la 3.ª puesta y el torque cambiando de signo
(soltar), pasa a `N` (evento `popOut`).

### 5.5. Diferencial, ejes y auto

Diferencial abierto: en una curva (`steer`) las ruedas motrices giran a
`ω·(1 ± 0,3·steer)`. Auto: `m_ef·dv/dt = F_motriz − F_aero − F_rodadura −
m·g·grade − F_frenos`, con `F_motriz = T_salida·i_total·η/r` limitado por
la adherencia (`0,9·N_motriz`; si se supera, patina la rueda: evento
`wheelspin`). `vehicle.speed` en km/h.

### 5.6. Rpm del motor en el vehículo

Con `drivetrain` en el vehículo, `engineCore` deja de copiar `params.rpm`:
integra `J_motor·dω/dt = engine.torque − T_embrague` (el torque del
embrague lo publica este sistema; `engine.torque` lo calcula `engineCore`,
§12). Trabado, el tren motriz publica además la inercia reflejada y el
torque de carga y `engineCore` integra la inercia total (sin eso, el
acople explícito de dos inercias rígidas con 1 ms de retraso oscila). Las
reglas exactas están en §12.

### 5.7. Ruidos y vibraciones (canales, no audio)

Cada ruido es un evento `{ tipo, intensidad 0..1 }` que el presenter
convierte en un indicador visual (onda que sale de la pieza) y en texto:
`grind` (raspado), `clunk` (golpe: cruceta o soporte al cambiar el signo
del torque), `click` (homocinética: `cvWorn·clamp(|steer| − 0,5)·throttle`),
`whine` (diferencial o caja: `∝ v·desgaste`), `squeal` (collarín con el
pedal pisado), `judder` (embrague con aceite al embragar). Vibración del
cardán a `f = v/(2π·r)·i_dif` Hz con amplitud `uJointWorn·(v/100)`.

### 5.8. Referencia (planificador)

| caso | resultado |
|---|---|
| km/h a 3000 rpm por marcha | 23,6 · 39,4 · 59,1 · 82,8 · 103,4 |
| 0–100 km/h (cambios a 5500) | 11,6 s |
| velocidad máxima | 179 km/h (en 5.ª) |
| crucero 100 km/h en 5.ª | 2900 rpm, acelerador 0,32 |
| embrague: capacidad sana / gastado 1,0 | 240 / 96 N·m (el motor da 140 netos a 3000 a fondo: gastado **patina**) |

## 6. Estado

`engineRpm`, `inputRpm`, `wheelRpm`, `speed` (km/h), `accel` (g),
`gear` (el que está puesto), `clutchLocked`, `clutchSlip` (0..1),
`clutchTorque` (N·m), `clutchTemp` (°C), `engineTorque`, `driveForce` (N),
`throttleEff`, `stalled`, `noises` (lista de `{tipo, intensidad}`),
`vibrationHz`, `vibration`, `wheelspin`, `engineMovement` (mm).

## 7. Lecturas

Rpm del motor y de la entrada de la caja (`history`: el patinaje se ve
como dos curvas separadas), velocidad (`history`), marcha, patinaje del
embrague (%), temperatura del embrague, torque del motor, aceleración (g),
tiempo de 0–100 (de la prueba).

## 8. Vista (viewBox 1400×700)

Esquema de arriba: motor (bloque con un tacómetro), volante y embrague en
corte (disco que se separa de la prensa con el pedal; brilla con
`clutchTemp`), caja con las 5 marchas y un selector que muestra cuál está
engranada (el sincronizador del cambio que se está metiendo gira hasta
igualar), y según la variante: cardán con las crucetas y el puente trasero,
o semiejes con las homocinéticas adelante. Ruedas girando con su
velocidad, el auto con un velocímetro y un inclinómetro (`grade`). Ruidos:
ondas que salen de la pieza con el nombre del ruido. Drawers en
`src/render/svg/drawers/drivetrain/`: `clutchSection`, `gearbox`,
`driveshaft`, `halfShafts`, `differential`, `carSide`, `tachometer`,
`noiseWave`.

## 9. Narración

- patinando con el pedal suelto → bad: "El embrague patina: el motor sube
  de vueltas y el auto no acelera igual."
- `clutchTemp > 250` → warn: "Olor a embrague quemado."
- `grind` → warn: "Raspa al meter el cambio: {el sincronizador del 2.º está
  gastado | el embrague no desembraga del todo}."
- `popOut` → warn: "Se salió la 3.ª al soltar el acelerador."
- `click` → warn: "Clac-clac en la curva: homocinética exterior gastada."
- `clunk` → warn: "Golpe seco al cambiar de acelerar a soltar: {cruceta |
  soporte de motor}."
- `whine` del diferencial → warn: "Aullido que sube con la velocidad: el
  rodamiento del diferencial."
- motor parado por embragar en 3.ª → info: "Se paró: soltar el embrague en
  3.ª desde parado le pide más torque del que da en ralentí."

## 10. Presets

"Salir en 1.ª", "Aceleración 0–100", "Crucero a 100", "Embrague gastado en
subida", "No desembraga: raspa", "Sincronizador del 2.º", "Se sale la 3.ª",
"Clac en las curvas" (fwd), "Golpe de cruceta" (rwd), "Aullido del
diferencial", "Soporte de motor roto".

## 11. Tests (`tests/drivetrain/*.test.ts`)

1. Km/h a 3000 rpm por marcha: ±0,5 de §5.8.
2. `launchTest()`: 0–100 en **[10; 13,5] s**; velocidad máxima en 5.ª en
   **[170; 185] km/h** (60 s a fondo).
3. Ralentí en N: 800 ± 30 rpm con `throttle = 0`.
4. Soltar el embrague en 1.ª a 1500 rpm con acelerador 0,2: el auto sale
   sin pararse; en 3.ª con acelerador 0 desde parado: `stalled` en < 2 s.
5. `clutchWorn = 1`: 4.ª a fondo desde 60 km/h → `clutchSlip > 0,1` y
   `clutchTemp` sube; con 0,3 no patina.
6. `clutchDrag = 1`: con el pedal a fondo y el auto detenido en N, meter la
   1.ª → evento `grind`; sano → entra sin raspar en < 0,25 s.
7. `synchro2Worn = 1`: cambio 1.ª → 2.ª a 5000 rpm en 0,1 s → `grind`; a
   2500 rpm con pausa de 0,5 s en N → entra.
8. `detent3Worn`: en 3.ª a 60 km/h, soltar el acelerador → `popOut`.
9. `cvWorn = 1` (fwd): `steer = 0,8` y `throttle = 0,5` → `click`; en
   recta, no.
10. `uJointWorn = 1` (rwd): golpe (`clunk`) al pasar de 0,5 a 0 de
    acelerador; vibración en Hz = fórmula ±2 %.
11. Estabilidad: trabado en 5.ª a 100 km/h, las rpm no oscilan (desvío < 5
    rpm pico a pico en 2 s).
12. Robustez y determinismo.

## 12. En el vehículo

- **Publica**: `vehicle.speed` (deja de ser stub), `vehicle.accel` (g; la
  lee la suspensión para el cabeceo), `drivetrain.clutchTorque`,
  `drivetrain.loadTorque` y `drivetrain.reflectedInertia` (trabado),
  `drivetrain.locked`, `wheel.speedFL`…`RR` (km/h; los lee el ABS de A20).
- **Lee**: `engine.torque`, `engine.rpm`, `engine.state`,
  `brakes.torque*`.
- **Cambia `engineCore`** (A21 lo implementa, con test de que sin tren
  motriz nada cambia):
  - `engine.torque = Tmax(rpm)·(air.massFlow/ṁ_fondo(rpm))·calidad −
    Tf(rpm)`, `calidad = min(1, ignition.spark)·engine.compression·
    f_mezcla·f_avance`; `f_mezcla` = 1 entre 0,9 y 1,2, lineal a 0 en 0,5 y
    1,8; `f_avance = 1 − 0,004·(avance − 28)²` acotado a [0,5; 1];
    `ṁ_fondo(rpm)` = la fórmula de `carburetor.md` §5.1 con mariposa 1.
  - Con tren motriz: `engine.rpm` integra `J·dω/dt = engine.torque −
    clutchTorque` (patinando) o con `J + reflectedInertia` y
    `loadTorque` (trabado). Sin tren motriz, `params.rpm` como hoy.
  - `engine.load = clamp(engine.torque/Tmax(rpm), 0, 1)` (reemplaza a
    `throttle`; el frenado motor da torque negativo, que queda en
    `engine.torque`, pero la carga no baja de 0: Wiebe y la refrigeración
    esperan 0..1).
  - Regulador de ralentí de §5.2 (actúa sobre el `throttle` efectivo que
    ven la admisión y la alimentación; es la IAC de A18).
