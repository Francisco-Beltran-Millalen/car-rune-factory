# Módulo — Frenos (`brakes`) — **especificación completa**

> Spec viva, escrita por el agente planificador el 2026-09-26 (plan
> `plans/2026-09-26-brakes.md`). Tarea A20, bloque S2 (después de A15 y
> A18: usa `gasOrifice` y el bus de vacío). Números de §5.8 de la
> cuenta del planificador.

## 1. Arquetipo y variantes

Freno hidráulico de dos circuitos: pedal → servo de vacío → cilindro
maestro doble → líneas → cálipers (disco, adelante) y cilindros de rueda
(tambor, atrás), con válvula repartidora hacia atrás.

| Pieza | Antigua | Moderna | Se implementa |
|---|---|---|---|
| Partición | delantero / trasero | en diagonal (FWD) | las dos (una por variante) |
| Traseros | tambor con ajuste automático | tambor o disco | tambor en las dos |
| Antibloqueo | no hay | ABS de 4 canales | las dos |
| Servo | de vacío | de vacío | el mismo |

Descriptores: `brakes-classic` ("Frenos años 70": partición del/tras, sin
ABS) y `brakes-abs` ("Frenos años 2000": diagonal + ABS). `#/lab/brakes`
redirige a `brakes-abs`. Registrado: disco atrás, tambor adelante (años 60),
freno de estacionamiento eléctrico, control de estabilidad.

## 2. Piezas (`partId`)

`pedal`, `servo`, `servoCheckValve`, `vacuumHose`, `masterCylinder`,
`reservoir`, `lineFront`, `lineRear` (o `lineDiagA`, `lineDiagB`),
`proportioningValve`, `caliperFL`, `caliperFR`, `padsFL`, `padsFR`,
`discFL`, `discFR`, `wheelCylRL`, `wheelCylRR`, `shoesRL`, `shoesRR`,
`drumRL`, `drumRR`, `adjusterRL`, `adjusterRR`, `handbrake`. ABS:
`absUnit`, `wheelSensorFL`…`RR`.

## 3. Parámetros

| key | rango | default | significado |
|---|---|---|---|
| `pedalForce` | 0–500 | 0 | N en el pedal |
| `engineRunning` | bool | true | stub: hay vacío (`intake.map`) o no |
| `speedKmh` | 0–160 | 0 | velocidad inicial para la prueba de frenado (acción) |
| `roadMu` | 0,2–1 | 0,9 | adherencia (0,3 = mojado/hielo) |
| `fluidAgeYears` | 0–6 | 1 | agua absorbida: baja el punto de ebullición |
| `handbrake` | bool | false | tira los tambores traseros |

Acciones: `stopTest()` (lanza el auto a `speedKmh` y mide la distancia con
el `pedalForce` actual), `bleed()` (purga: saca el aire — sólo estado),
`longDescent()` (calienta los frenos como una bajada de 5 km, en 30 s
simulados).

## 4. Fallas (ids §26)

| id §26 | clave | tipo | efecto |
|---|---|---|---|
| `lines.air` | `airInLines` | 0–1 | burbuja `2 mL·s` a 1 bar: pedal esponjoso |
| `lineRear.leak` (o `lineDiagB.leak`) | `lineLeak` | 0–1 | fuga: el circuito pierde líquido; el pedal se hunde y ese circuito queda sin presión |
| `masterCylinder.bypass` | `mcBypass` | 0–1 | sello interno: con fuerza constante el pedal baja lento |
| `servo.diaphragm` | `servoLeak` | 0–1 | pedal duro y entrada de aire al múltiple (`8 mm²·s`) |
| `servoCheckValve.failed` | `checkValveFailed` | toggle | detenido, el servo pierde el vacío en segundos |
| `caliperFL.seized` | `caliperSeized` | `'ok' \| 'released' \| 'applied'` | `released`: no aprieta (tira a la derecha); `applied`: queda frenando (se calienta, tira a la izquierda) |
| `padsFR.contaminated` | `padsOily` | 0–1 | μ ×`(1 − 0,5·s)` en esa rueda: tira |
| `padsFL.worn` | `padsWorn` | 0–1 | a 1, metal con metal: ruido y μ 0,25; el pistón sale más (más volumen) |
| `adjusterRL.seized` | `adjusterSeized` | 0–1 | la zapata queda lejos: `+1,5 mL·s` para llegar; pedal largo |
| `proportioningValve.stuck` | `propValveStuck` | toggle | deja pasar toda la presión atrás: las traseras se bloquean primero |
| `wheelSensorRL.dead` | `absSensorDead` | toggle | ABS apagado, testigo |

## 5. Física

### 5.1. Pedal y servo (controlador `brakeCore`)

- Palanca del pedal 4:1: `F_varilla = 4·pedalForce`.
- Servo: `F = F_varilla + min(2·F_varilla, A_d·|p_servo|·1e5)`, con
  `A_d = 0,0415 m²` (230 mm): a 0,6 bar el tope de asistencia es 2490 N.
  Con `servoLeak` la asistencia ×`(1 − 0,7·s)`.
- Cámara del servo: red de aire chica (fluido `air`, kg/h): `volume`
  (3 L), `checkValve` hacia el vacío (`pressureSource` en `intake.map`;
  stub `−0,65` con el motor en marcha, `0` detenido; con
  `checkValveFailed`, `restrictor` en vez de válvula), consumo de aire en
  cada aplicación (`flowSource`: `0,03 kg/h por bar/s` de subida de la
  presión de línea: una frenada a 60 bar gasta ~0,15 bar de la reserva) y la fuga del diafragma (`gasOrifice`). Sin motor
  quedan 2–3 frenadas asistidas: la prueba clásica.
- Presión pedida: `p_cmd = F/A_mc`, `A_mc = 3,8 cm²` (22 mm), **limitada a
  1000 bar/s** (1 bar por paso): el solver avanza como máximo ±1 bar por
  iteración (`solver.md` §4) y un escalón de 60 bar en un paso no
  convergería.

### 5.2. Red hidráulica (fluido `brake`, bar y L/h)

| pieza | elemento | valores |
|---|---|---|
| cilindro maestro | **nuevo** `masterCylinder` (out1, out2) | cada salida `q_i = g·(p_cmd − p_i)` con `g = 2000 L/h/bar` mientras el pistón tenga carrera (`V_i < 6 mL`); al fondo, `q_i ≤ 0`; al soltar vuelve hasta `V_i = 0` y el depósito compensa. Estado `V1`, `V2` (mL) en `commit` |
| bypass interno | `restrictor` out→depósito | `k` infinito sano; con la falla `k = 2e-2/s²` |
| líneas | `restrictor` | `k = 1e-6` (sin efecto en régimen) |
| repartidora | **nuevo** `proportioningValve` (in, out) | `p_out = p_in` hasta 30 bar; arriba `30 + 0,3·(p_in − 30)`; con la falla, `p_out = p_in` |
| cáliper / cilindro de rueda | **nuevo** `brakeActuator` (a) | volumen `V(p) = V_luz·(1 − e^{−p/0,5}) + C·p`, con `V_luz = 0,5 mL` (+ desgaste/ajuste), `C = 0,015 mL/bar` delante, `0,01` atrás. Es una capacidad no lineal: `q = (V(p) − V_prev)/dt` (el estado se guarda en `commit`, §24) |
| aire en las líneas | **nuevo** `gasPocket` (a) | `V_gas = V0·1,013/(1,013 + p)` (isotérmico): la burbuja se comprime y "come" carrera |
| fuga | `leak` | `k = 0,5·s` |
| ABS | `variableOrifice` de entrada (1 por rueda, `gOpen = 60 L/h/√bar`, `gLeak = 0`) + `variableOrifice` de descarga (`gOpen = 60`, `gLeak = 0`) a un acumulador `volume` (`c = 0,002 L/bar`) | abiertos/cerrados (0/1) por el controlador ABS: el ciclo de ~10 Hz sale de los umbrales de §5.5 |

### 5.3. Fuerza en cada rueda

- Disco: `T = p·A_cal·2·μ·r_ef`, `A_cal = 22,9 cm²` (54 mm), `r_ef =
  0,11 m`.
- Tambor: `T = p·A_cil·BF·r_tambor`, `A_cil = 2,84 cm²` (19 mm), `BF =
  2,5` (zapata primaria y secundaria), `r = 0,1 m`.
- `μ = 0,4·f_temp·(1 − 0,5·aceite)`; pastillas gastadas a 1: 0,25.
  `f_temp = 1` hasta 350 °C y baja lineal a 0,5 a 600 °C (**fading**).
- Freno de mano: los tambores traseros con `T = 400 N·m` cada uno.

### 5.4. Auto de prueba (sólo laboratorio)

Masa 1100 kg, radio de rueda 0,30 m, reparto estático 60/40,
transferencia `ΔN = m·a·0,55/2,5` (altura del centro de gravedad / batalla).
Cada rueda: `F = min(T/r, roadMu·N)`; si `T/r > roadMu·N` la rueda se
**bloquea** (estado). Desaceleración = `ΣF/m`. Tirón lateral:
`pull = (F_izq − F_der)/ΣF` (+ = a la izquierda). En el vehículo este
modelo lo reemplaza el tren motriz (A21): los frenos publican torques.

### 5.5. ABS

Por rueda: si el deslizamiento estimado (`1 − ω·r/v`) pasa 0,15, cierra la
entrada y abre la descarga (baja la presión); bajo 0,08, cierra la
descarga y vuelve a abrir la entrada. Ciclos de ~10 Hz visibles en cámara
lenta. Sin sensor, apagado y testigo.

### 5.6. Temperatura

Por disco/tambor: `C = 5 kJ/K` (disco) / `7 kJ/K` (tambor); entra la
potencia de frenado de esa rueda (`T·ω`), sale `h·(T − 25)` con `h = 15 +
0,5·v[km/h]` W/K. El líquido de cada rueda sigue la temperatura del
disco/tambor ×0,5 (τ 30 s). Ebullición del líquido: `230 − 25·años` °C
(DOT 4: 230 seco, ~155 °C a los 3 años); si hierve, `gasPocket` de 1 mL en
ese circuito (**vapor lock**: el pedal se va al fondo en la bajada).

### 5.7. Pedal

Recorrido `= 10 mm (juego) + (V1 + V2)/A_mc`; al fondo con 35 mm de
carrera útil. Sensación (texto): `firme` si llega a 60 bar en < 20 mm,
`esponjoso` si necesita > 25 mm, `al fondo` si un circuito se quedó sin
carrera, `duro` si la asistencia es < 30 %.

### 5.8. Referencia (planificador, auto de prueba, sano)

| pedal | presión | T delantera (c/u) | T trasera (c/u) | desaceleración |
|---|---|---|---|---|
| 100 N | 32 bar | 636 N·m | 216 N·m | 0,53 g |
| 200 N | 63 bar | 1272 N·m | 283 N·m | 0,89 g (con 0,9 de adherencia bloquean las delanteras: su fuerza queda en `0,9·N`; sin bloqueo serían 0,96) |
| 200 N sin vacío | 21 bar | | | ~0,33 g (pedal duro) |

## 6. Estado

`pFront`, `pRear` (o `pA`, `pB`), `pCmd` (bar), `pedalTravel` (mm),
`pedalFeel` (texto), `servoVacuum` (bar), `assist` (0..1), `v1`, `v2`
(mL), `torque{FL,FR,RL,RR}` (N·m), `locked{…}` (bool), `speed` (km/h,
prueba), `decel` (g), `pull` (−1..1), `stopDistance` (m), `temp{…}`
(°C), `fluidTemp{…}`, `vaporLock` (bool), `absActive` (bool),
`absLamp` (bool), `reservoirLevel` (mL).

## 7. Lecturas

Presión de cada circuito (`history`), recorrido del pedal (mm, verde
15–30), vacío del servo, asistencia (%), desaceleración (g, `history`),
tirón (%), distancia de frenado (m), temperatura de discos, nivel del
depósito.

## 8. Vista (viewBox 1300×760)

Pedal con su recorrido a la izquierda, servo (diafragma que se mueve,
vacío en `--vacuum`), cilindro maestro con los dos pistones y el depósito
(nivel), líneas a las 4 ruedas vistas desde arriba (auto esquemático),
cálipers que aprietan el disco (color por temperatura), tambores con las
zapatas que abren, repartidora, ABS (bloque con válvulas que titilan).
Partículas `p-brake` (clase nueva, color del líquido de frenos: token
`--brake`) ∝ caudal, burbujas con aire. Flecha de tirón sobre el auto y
ruedas bloqueadas marcadas. Drawers en `src/render/svg/drawers/brakes/`:
`pedalServo`, `masterCylinder`, `caliperDisc`, `drumBrake`,
`proportioningValve`, `absUnit`, `carTopView`.

## 9. Narración

- recorrido > 25 mm con presión baja → warn: "Pedal esponjoso: hay aire en
  las líneas (se comprime antes de empujar el líquido)."
- un circuito sin presión → bad: "Un circuito perdió presión: el pedal
  baja más y frena sólo con {circuito}."
- `assist < 0,3` con pedal → warn: "Pedal duro: el servo no tiene vacío."
- `|pull| > 0,1` → warn: "El auto tira hacia la {izq/der} al frenar: una
  rueda frena distinto."
- rueda bloqueada → warn: "Se bloqueó la rueda {x}."; con ABS activo →
  info: "El ABS suelta y vuelve a apretar: la rueda sigue girando."
- `vaporLock` → bad: "El líquido hirvió: el vapor se comprime y el pedal se
  va al fondo."
- fading → warn: "Los discos pasan de 350 °C: las pastillas pierden
  agarre."

## 10. Presets

"Frenada normal", "Pedal esponjoso" (aire), "Fuga en el circuito trasero",
"Motor apagado: 3 frenadas" (`engineRunning` false), "Tira a la derecha"
(cáliper FL suelto), "Cáliper pegado" (applied), "Pastillas con aceite",
"Hielo sin ABS" (`brakes-classic`, `roadMu` 0,3), "Hielo con ABS", "Bajada
larga con líquido viejo" (`fluidAgeYears` 4 + `longDescent`).

## 11. Tests (`tests/brakes/*.test.ts`)

1. Elementos nuevos (`masterCylinder`, `proportioningValve`,
   `brakeActuator`, `gasPocket`): ley y jacobiano; `brakeActuator` y
   `gasPocket` conservan volumen (∫q dt = ΔV).
2. Pedal 100 N sano: presión en **[29; 35] bar**, desaceleración en
   **[0,48; 0,58] g**; 200 N: presión en [58; 68]. `failures === 0`.
3. Rampa: el pedal de 0 a 300 N en 0,1 s no produce pasos fallidos
   (`failures === 0`) y la presión sigue a `p_cmd` con < 0,02 s de retraso.
4. `airInLines = 1`: para 30 bar el recorrido es ≥ 1,5× el sano.
5. `lineLeak = 1` (classic): el circuito trasero cae a < 2 bar en < 10 s
   con el pedal apretado y el recorrido llega al fondo; el delantero sigue
   frenando.
6. Sin motor (`engineRunning` false, check sano): asistencia > 50 % en la
   1.ª frenada y < 20 % en la 4.ª; con `checkValveFailed` < 20 % en la 1.ª.
7. `caliperSeized='released'`: `pull` < −0,2 (tira a la derecha);
   `padsOily = 1` (FR): `pull` > 0,1.
8. `roadMu = 0,3`, 200 N: `brakes-classic` bloquea al menos una rueda;
   `brakes-abs` sin ruedas bloqueadas > 0,2 s seguidos y distancia desde
   50 km/h ≤ la de `brakes-classic`.
9. `propValveStuck` + 200 N en seco: las traseras se bloquean antes que las
   delanteras.
10. `longDescent` con 4 años: `vaporLock` y el recorrido llega al fondo;
    con 1 año, no.
11. Robustez y determinismo.

## 12. En el vehículo

- **Publica**: `brakes.torqueFL`/`FR`/`RL`/`RR` (N·m; los integra el tren
  motriz, A21), `brakes.lampOn` (ABS o nivel).
- **Lee**: el bus `vacuum` (el servo se cuelga del múltiple, A18: la fuga
  del diafragma es una fuga real del motor — el clásico "ralentí inestable
  causado por los frenos"), `vehicle.speed` y las velocidades de rueda
  (`wheel.speedFL`… de A21; stub: el auto de prueba).
- Fluido propio `brake`: nunca toca los demás (§30).
