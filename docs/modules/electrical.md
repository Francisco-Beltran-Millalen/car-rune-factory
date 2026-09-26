# Módulo — Eléctrico: batería, arranque y carga (`electrical`) — **especificación completa**

> Spec viva, escrita por el agente planificador el 2026-09-26 (plan
> `plans/2026-09-26-electrical.md`). Tarea A17, bloque S2 (después de A15).
> Los números de §5.7 salen de la cuenta del planificador.

## 1. Arquetipo y variantes

La red de 12 V del auto: batería, motor de arranque con su solenoide, un
generador con su regulador, masas, fusibles, relés y consumos. En el
vehículo este sistema pasa a ser el **proveedor del bus `12v`** (plan del
vehículo §8): los demás circuitos sueltan su batería provisoria.

| Pieza | Antigua | Moderna | Se implementa |
|---|---|---|---|
| Generador | dínamo (corriente continua) + regulador externo de contactos con disyuntor (*cut-out*) | alternador con puente de diodos y regulador interno | los dos |
| Indicador | amperímetro o testigo | testigo de carga | testigo en los dos; amperímetro en el dínamo |
| Arranque | directo | directo (con reducción en algunos) | directo |

Intermedia registrada: alternador con regulador externo (~1970–85): sale
combinando piezas; no se implementa salvo pedido.

Descriptores: `electrical-dynamo` ("Eléctrico años 70") y
`electrical-alternator` ("Eléctrico años 2000"). `#/lab/electrical`
redirige a `electrical-alternator`.

## 2. Piezas (`partId`)

`battery`, `batteryTerminal`, `groundStrap` (masa motor–chasis),
`chassisGround`, `ignitionSwitch`, `starterSolenoid`, `starter`,
`accessoryBelt`, `fuseBox`, `fuseLights`, `fuseFan`, `lightsRelay`,
`headlights`, `blowerFan` (soplador), `rearDefrost`, `gloveboxLamp`,
`chargeLamp`, `engineLoads` (encendido + bomba, como una carga
equivalente). Dínamo: `dynamo`, `regulator` (externo), `cutout`,
`ammeter`. Alternador: `alternator` (con `diodes` y `regulator` internos).

## 3. Parámetros

| key | rango | default | significado |
|---|---|---|---|
| `ignitionKey` | `'off' \| 'on' \| 'start' \| 'run'` | `'off'` | como el combustible; `start` alimenta el solenoide |
| `rpm` | 600–6500 | 800 | rpm pedidas con el motor en marcha (el arranque lo da el motor de partida) |
| `ambientC` | −20–45 | 20 | frío: batería con más resistencia y motor más duro de girar |
| `soc` | 0–1 | 0,9 | carga inicial de la batería (se aplica en `reset`) |
| `lights` | bool | false | faros (110 W) |
| `blower` | bool | false | soplador (15 A) |
| `defrost` | bool | false | desempañador (13 A) |
| `fastBattery` | bool | false | carga/descarga ×100 |

Acciones: `park(horas)` (integra la descarga con la llave en `off`, sin
simular paso a paso), `chargeBattery()` (SOC a 1), `replaceFuse(id)`.

## 4. Fallas (ids §26)

| id §26 | clave | tipo | efecto |
|---|---|---|---|
| `battery.sulfated` | `batterySulfated` | 0–1 | capacidad ×`(1 − 0,8·s)`, resistencia ×`(1 + 5·s)` |
| `battery.deadCell` | `batteryDeadCell` | toggle | una celda en corto: tensión en vacío −2,1 V |
| `batteryTerminal.corroded` | `terminalCorroded` | 0–1 | `+0,03 Ω·s` en el borne positivo (afecta todo) |
| `groundStrap.corroded` | `groundCorroded` | 0–1 | `+0,04 Ω·s` en la masa motor–chasis (afecta **sólo** lo que vuelve por el motor: el arranque y el generador) |
| `starter.brushesWorn` | `starterBrushes` | 0–1 | resistencia del motor ×`(1 + 1,5·s)` |
| `starterSolenoid.contacts` | `solenoidContacts` | 0–1 | contactos quemados: `+0,05 Ω·s`; a 1, a veces no cierra (clic y nada; rng) |
| `accessoryBelt.slipping` | `beltSlip` | 0–1 | el generador (y la bomba de agua, en el vehículo) gira ×`(1 − 0,5·s)` |
| `alternator.diode` | `alternatorDiode` | toggle | un diodo abierto: corriente máx. ×0,66 y rizado (canal) |
| `alternator.brushes` | `alternatorBrushes` | toggle | sin campo: no carga, testigo prendido |
| `regulator.state` | `regulator` | `'ok' \| 'overcharge' \| 'undercharge'` | consigna 15,5 V o 13,0 V |
| `cutout.stuck` | `cutoutStuck` | toggle | dínamo: el disyuntor no abre → detenido, la batería se descarga por el dínamo |
| `headlightWiring.short` | `lightsShort` | toggle | corto a masa después del fusible: el fusible se funde al prender los faros |
| `gloveboxLamp.stuck` | `gloveboxStuck` | toggle | consumo parásito 0,3 A con todo apagado |

## 5. Física

### 5.1. Red (solver, dominio eléctrico, V y A)

- **Batería**: elemento `battery` existente (`V = v − R·I`); el controlador
  escribe `v` = tensión en vacío y el `r` efectivo lo pone un `resistor`
  variable en serie (elemento nuevo `variableResistor`, control `r`).
  `OCV = 11,8 + 0,8·SOC` (−2,1 V con la celda muerta); `R = 0,010·(1 +
  2·(1 − SOC))·(1 + 5·sulfated)·f_frío`, `f_frío = 1 + 0,02·max(0, 20 −
  T)`. `SOC −= I·dt/(3600·Cap)`, `Cap = 45 Ah·(1 − 0,8·sulfated)`
  (×100 con `fastBattery`); la corriente la da la sonda del elemento.
- **Borne y masas**: `variableResistor` (`0,001 + 0,03·terminal`), masa del
  motor `variableResistor` (`0,001 + 0,04·ground`). El arranque y el
  generador vuelven por la masa del motor; faros y demás por la del chasis.
- **Arranque**: `starterSolenoid` es un `switch` (cierra en `start`;
  `rOn = 0,001 + 0,05·contacts`), cable 0,003 Ω, motor = elemento nuevo
  `dcMotor` (a, b; param `rm = 0,02 Ω`·(1 + 1,5·brushes); control `e`,
  la fuerza contraelectromotriz): `I = (Va − Vb − e)/rm`.
- **Generador**: elemento nuevo `generator` (+, −): fuente de corriente
  regulada `I = Imax·softclamp(g·(Vset − V))`, con `g = 50 A/V` y `Imax`
  según §5.3; nunca negativa (diodos) salvo el dínamo con disyuntor pegado,
  donde se modela como `dcMotor` inverso (§5.3).
- **Consumos** (`resistor`s detrás de fusibles y relés, a masa de chasis):
  faros 1,3 Ω (≈ 110 W), soplador 0,9 Ω, desempañador 1,05 Ω, testigo de
  carga 60 Ω, `engineLoads` 2,6 Ω (≈ 5 A: encendido + bomba; en el vehículo
  se reemplaza por los consumos reales de cada sistema en el bus), guantera
  (0,3 A: 42 Ω) con la falla.
- **Fusible**: elemento nuevo `fuse` (a, b; params `rating` A, `r =
  0,005 Ω`): estado `heat += (I² − rating²)⁺·dt`, se funde (pasa a `rOff`)
  con `heat > rating²·0,1 s`; `replaceFuse` lo repone. Faros 15 A,
  ventilador 20 A.

### 5.2. Motor de arranque (controlador `starterCore`)

`ω` (rad/s del motor de partida): `J·dω/dt = kφ·I − T_carga/8 − b·ω`, con
`kφ = 0,037 V·s/rad`, reducción 8:1, `J = 0,004 kg·m²`, `b = 1e-4`. La
fuerza contraelectromotriz del paso siguiente es `e = kφ·ω`. Carga del motor
al girar: `T_carga = 30 + 8·(ν/14)^0,3` N·m (47 a 20 °C, 50 a 0 °C) (ν = viscosidad del aceite;
laboratorio: de `ambientC` con el 10W-40 de `lubrication.md` §5.2).
`starter.rpm = ω·60/(2π)/8`. La constante electromecánica
(`J·R/kφ² ≈ 0,1 s`) es 100 veces el paso: la integración explícita es
estable.

### 5.3. Generador

- **Alternador**: `n = 2,5·rpm·(1 − 0,5·beltSlip)`;
  `Imax = 70·(1 − e^{−max(0, n − 1000)/2500})` A (×0,66 con diodo abierto,
  0 sin escobillas); `Vset = 14,2` (15,5 / 13,0 según el regulador).
  Ralentí: `Imax ≈ 23 A`; 2000 rpm: 56 A.
- **Dínamo**: `n = 1,8·rpm·(1 − 0,5·beltSlip)`;
  `Imax = 22·clamp((n − 1500)/2000, 0, 1)` A (en ralentí casi no carga:
  real); `Vset = 14,0`. Disyuntor: conecta si la tensión del dínamo supera
  la de la batería en 0,5 V, desconecta si se invierte la corriente. Con
  `cutoutStuck` queda conectado: detenido, la batería alimenta al dínamo
  como motor (`dcMotor` con `rm = 0,8 Ω` → ~15 A).
- Testigo de carga: prendido con la llave en `on`/`run` si la tensión del
  generador es menor que la de la batería (o sin escobillas).

### 5.4. Arranque del motor

El laboratorio incluye `engineCore` (vehículo, A15) con stubs ideales
salvo `starter.rpm` y `electrical.crankVoltage`, que salen de acá: el motor
parte si gira ≥ 150 rpm con ≥ 6 V en la batería durante 0,5 s (reglas del
plan del vehículo §4.8). Con el motor en marcha, `rpm` es el param.

### 5.5. Estacionado

`park(h)`: `SOC −= I_parásita·h/Cap` con `I_parásita = 0,02 A` (reloj,
alarma) `+ 0,3` (guantera). Sin guantera, 45 Ah duran semanas; con la
falla, `park(72)` deja la batería sin arranque.

### 5.6. Sobrecarga

Con `V > 15 V` durante más de 60 s simulados: estado `gassing` (la batería
hierve: pierde agua), y los faros se queman (resistor abierto) con
probabilidad por minuto (rng).

### 5.7. Referencia (cuenta del planificador con las fórmulas de §5.1–§5.2)

Resistencia del camino del arranque: batería (§5.1) + borne 0,001 +
solenoide 0,001 + cable 0,003 + masa del motor 0,001 + motor 0,02 Ω. La
corriente la fija el torque de carga (`I = T_carga/8/kφ`); la tensión de
la batería es `OCV − I·R_batería`.

| caso | I (A) | V batería | rpm de arranque | ¿parte? (≥ 150) |
|---|---|---|---|---|
| sano, SOC 0,9, 20 °C | 158 | 10,6 | 210 | sí |
| SOC 0,5 | 158 | 9,0 | 159 | sí, justo |
| SOC 0,25 | 158 | 8,0 | 127 | no |
| sulfatada 1,0 | 158 | 1,1 | 0 | no (clic) |
| masa del motor corroída 0,5 (+0,02 Ω) | 158 | **10,6** | 108 | no: **la batería "está bien"** |
| frío 0 °C, batería sana | 170 | 9,7 | 169 | sí |
| escobillas gastadas 1,0 | 158 | 10,6 | 57 | no |
| rotor bloqueado (sano, SOC 0,9) | 329 | | 0 | |

## 6. Estado

`soc` (0..1), `batteryV` (V en bornes), `batteryI` (A, + descarga),
`ocv`, `rInt` (Ω), `starterI` (A), `starterRpm`, `crankVoltage`,
`generatorI` (A), `generatorOn` (bool), `busV` (V del bus), `chargeLamp`
(bool), `ammeter` (A, dínamo), `fuses` (`{lights, fan}` estado),
`gassing` (bool), `headlightsBurnt` (bool), `ripple` (0..1).

## 7. Lecturas

Tensión de batería (verde 12,4–14,6, `history`), corriente de batería
(`history`), carga (%), corriente de arranque, rpm de arranque, corriente
del generador, caída en la masa del motor (V — la medición que delata la
masa mala), testigo, amperímetro (dínamo).

## 8. Vista (viewBox 1300×720)

Batería a la izquierda (celdas; la muerta en gris; burbujas con
`gassing`), borne con verde de corrosión (`terminalCorroded`), cable grueso
al solenoide y al motor de partida (piñón que avanza al engranar con la
corona), masa del motor dibujada como trenza con óxido. Generador arriba con
la correa (desliza con `beltSlip`), regulador (dínamo: con sus contactos y
el disyuntor), caja de fusibles, relé de faros, consumos a la derecha
(faros que brillan ∝ V², soplador, desempañador), testigo y amperímetro.
Partículas `p-electric` ∝ corriente en cada tramo, **con sentido**: se ve
cuando la batería entrega y cuando recibe. Drawers nuevos en
`src/render/svg/drawers/electrical2/`: `batteryCells`, `starterMotor`,
`generator` (alternador o dínamo por `part.params.kind`), `regulatorBox`,
`fuse`, `lamp`, `ammeter`. Reusa `relay`, `key` y los cables del
combustible.

## 9. Narración

- arranque con < 150 rpm → bad: "El motor de partida gira lento ({rpm}
  rpm): no alcanza para partir."
- caída en la masa > 0,5 V al arrancar → warn: "Se pierden {v} V en la masa
  del motor: la batería está bien pero la corriente no vuelve."
- `chargeLamp` en marcha → bad: "El testigo de carga está prendido: el
  generador no carga y todo sale de la batería."
- dínamo en ralentí → info: "En ralentí el dínamo casi no carga: es normal
  en un auto de esta época."
- `busV > 15` → bad: "Sobrecarga: el regulador deja pasar {v} V. La batería
  hierve y las ampolletas se queman."
- fusible fundido → warn: "Se fundió el fusible de {x}: hay un corto
  después de él."
- `cutoutStuck` detenido → bad: "El disyuntor quedó pegado: la batería se
  descarga por el dínamo."

## 10. Presets

"Arranque sano", "Batería a medias en invierno", "Masa del motor
corroída" (la batería mide bien y no parte), "Escobillas del partidor
gastadas", "No carga (alternador sin escobillas)", "Correa patinando con
todo prendido", "Regulador pasado", "Se descarga estacionado" (guantera +
`park(72)`), "Corto en los faros", "Disyuntor pegado" (dínamo).

## 11. Tests (`tests/electrical/*.test.ts`)

1. Elementos nuevos (`variableResistor`, `dcMotor`, `generator`, `fuse`):
   ley y jacobiano; el fusible se funde con 2× su corriente en < 1 s y no
   con 0,9× en 60 s.
2. Arranque, grilla de §5.7: rpm de arranque en ±10 % de la tabla y la
   decisión de partir igual a la tabla. `failures === 0`.
3. `groundCorroded = 0,5` (+0,02 Ω): `batteryV` durante el arranque > 10,3 V y
   `starterRpm < 150`.
4. Alternador sano en ralentí con faros + soplador: `busV` en [13,6; 14,4],
   `batteryI ≤ 0` (carga).
5. `alternatorBrushes`: `chargeLamp`, `busV < 12,8` y `soc` baja.
6. Dínamo en ralentí con faros: `generatorI < 5 A` y la batería descarga;
   a 2500 rpm carga.
7. `beltSlip = 1` en ralentí con todo prendido: alternador no alcanza
   (`batteryI > 0`).
8. `regulator='overcharge'`: `busV` en [15,2; 15,8] y `gassing` tras 60 s.
9. `lightsShort`: al prender los faros el fusible se funde en < 0,5 s.
10. `park(72)` con `gloveboxStuck` desde SOC 0,9 → no parte; sin la falla
    → parte.
11. `cutoutStuck`, dínamo, llave en `off`: `batteryI` en [10; 20] A.
12. Robustez y determinismo.

## 12. En el vehículo

- **Proveedor del bus `12v`** (y de `chassis`): los circuitos de
  combustible (`vehicle-2000`) y encendido (`vehicle-70`) sueltan su
  batería y su llave; la llave pasa a ser `ignitionSwitch` de este sistema.
  `engineLoads` desaparece: los consumos son los de cada sistema.
- **Publica**: `electrical.crankVoltage` (deja de ser provisional),
  `starter.rpm`, `belt.slip` (la lee la refrigeración para la bomba de
  agua), `charging.lamp`.
- **Lee**: `engine.rpm`, `engine.state`, `lubrication.viscosity` (nueva:
  la publica lubricación, ver `lubrication.md` §12; stub con
  `ambientC`).
