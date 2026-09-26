# Módulo — Refrigeración (`cooling`) — **especificación completa**

> Spec viva, escrita por el agente planificador el 2026-09-26 (plan
> `plans/2026-09-26-cooling.md`). Los números de §5 salen de una simulación
> de referencia de dos nodos hecha al escribir la spec; el modelo del solver
> tiene más nodos, así que los tests usan **rangos** y la constante que no
> cuadre se ajusta aquí con la cuenta (§14).

## 1. Arquetipo y variantes

Un solo arquetipo: bomba centrífuga movida por la correa, camisa del motor,
termostato con bypass, radiador con tapa a presión y depósito de expansión,
calefactor y ventilador. Lo intercambiable:

| Pieza | Antigua | Moderna | Se implementa |
|---|---|---|---|
| Ventilador | mecánico con embrague viscoso (gira con el motor) | eléctrico con termocontacto o ECU (cuelga del bus 12 V) | los dos |
| Depósito | radiador con tapa + botella de rebalse sin presión | depósito de expansión presurizado | se dibuja según la variante; la física es la misma (§5.6) |
| Indicador | reloj de temperatura | reloj + testigo | el reloj en los dos |

Descriptores: `cooling-viscous` ("Refrigeración años 70", ventilador
viscoso) y `cooling-electric` ("Refrigeración años 2000", electroventilador).
`#/lab/cooling` redirige a `cooling-electric`.

**Dos redes en el mismo solver**:
- **hidráulica** (`fluid: 'coolant'`, bar y L/h): bomba, camisa, termostato,
  radiador, bypass, calefactor, depósito;
- **térmica** (dominio nuevo `thermal`: potencial en °C, flujo en W,
  capacidad en J/K): nodos del motor, radiador, calefactor y ambiente.
El calor que lleva el refrigerante (advección) lo pasa un controlador: lee
los caudales de la red hidráulica (paso anterior, §25) y los escribe como
control de los elementos `advection` de la red térmica. La constante de
tiempo térmica (minutos) hace despreciable el retraso de 1 ms.

## 2. Piezas (`partId`)

`engineBlock` (camisa de agua), `waterPump`, `pumpBelt`, `thermostat`,
`bypass`, `upperHose`, `lowerHose`, `radiator`, `radiatorCap`,
`expansionTank`, `heaterValve`, `heaterCore`, `tempSensor`, `tempGauge`.
Viscoso: `fan`, `fanClutch`. Eléctrico: `fan`, `fanMotor`, `fanSwitch`,
`fanRelay`, `battery`, `fuse`.

## 3. Parámetros

| key | rango | default | significado |
|---|---|---|---|
| `rpm` | 0–6500 | 800 | stub de `engine.rpm` |
| `load` | 0–1 | 0 | stub de `engine.load` |
| `vehicleSpeedKmh` | 0–160 | 0 | stub de `vehicle.speed` (aire de marcha) |
| `ambientC` | −10–45 | 25 | temperatura ambiente |
| `heaterOn` | bool | false | abre la llave del calefactor y prende el soplador |
| `batteryV` | 10–14,5 | 13,8 | sólo eléctrico (stub del bus) |
| `fastThermal` | bool | false | calentamiento ×20 (multiplica todos los flujos de calor; como `fastConsumption`) |

Acciones: `setEngineTemp(°C)` (pone motor y radiador a esa temperatura),
`topUp()` (rellena el refrigerante).

## 4. Fallas (ids §26)

| id §26 | clave | tipo | efecto |
|---|---|---|---|
| `thermostat.state` | `thermostat` | `'ok' \| 'stuckOpen' \| 'stuckClosed'` | apertura fija en 1 o en 0 (con la fuga de 2 %) |
| `waterPump.wear` | `pumpWear` | 0–1 | álabes corroídos: `qMax` y `pMax` ×`(1 − 0,85·s)` |
| `waterPump.leak` | `pumpLeak` | 0–1 | pierde por el agujero testigo: `leak k = 3·s` |
| `lowerHose.leak` | `hoseLeak` | 0–1 | manguera rota: `leak k = 40·s` |
| `pumpBelt.slipping` | `beltSlip` | 0–1 | la bomba gira ×`(1 − 0,5·s)` (y el alternador, en el vehículo) |
| `radiator.finsClogged` | `finsClog` | 0–1 | panal tapado por fuera: `UA·(1 − 0,8·s)` |
| `radiator.tubesClogged` | `tubesClog` | 0–1 | sarro: restricción `k·(1 + 30·s)` y `UA·(1 − 0,4·s)` |
| `radiatorCap.failed` | `capFailed` | toggle | no sostiene presión: ebullición a 107 °C |
| `heaterCore.clogged` | `heaterClog` | 0–1 | el calefactor calienta poco |
| `fan.dead` | `fanDead` | toggle | eléctrico: motor cortado; viscoso: aspa rota |
| `fanClutch.worn` | `fanClutchWorn` | 0–1 | viscoso: acople máximo `0,9 − 0,6·s` |
| `fanSwitch.dead` | `fanSwitchDead` | toggle | eléctrico: el termocontacto nunca cierra |
| `tempSensor.fault` | `sensorFault` | `'ok' \| 'readsCold' \| 'open'` | el reloj marca 30 °C menos, o el mínimo: **el motor está caliente y el reloj miente** |

## 5. Física

### 5.1. Red hidráulica (fluido `coolant`)

| elemento | tipo | ley / valor |
|---|---|---|
| bomba | **nuevo** `centrifugalPump` (in, out) | altura `H = pMax·(n/6000)²`, `q = qMax·(n/6000)·√⁺(1 − Δp/H)·(1 − aire)`; `qMax = 9000 L/h` (150 L/min), `pMax = 1,5 bar`; `n` = rpm de la bomba (control `n`) |
| camisa | `restrictor` | `k = 6e-9` bar/(L/h)² (0,5 bar a 9000 L/h) |
| termostato | **nuevo** `variableOrifice` (a, b) | conductancia `g = gOpen·abre + gLeak`; `abre = clamp((T_motor − 88)/12, 0, 1)`; `gOpen = 9000/√0,4` L/h/√bar, `gLeak = 0,02·gOpen` |
| radiador | `restrictor` | `k = 2,5e-9`·(1 + 30·tubesClog) |
| bypass | `restrictor` | `k = 4e-8` (cerrado el termostato, circula todo por acá) |
| calefactor | `variableOrifice` + `restrictor` | `abre = heaterOn ? 1 − 0,97·heaterClog : 0`; `gOpen = 900/√0,5` |
| depósito | `pressureSource` (el nodo de aspiración) | `p = p_sistema` (§5.6) |
| fugas | `leak` (x2) | a la atmósfera, integran el nivel (§5.7) |

`variableOrifice` usa la ley del `restrictor` con `k_ef = 1/g²`
(`q = Δp/√(k_ef·(|Δp| + ε))`): es antisimétrico y suave en 0.
`√⁺(x)` es la raíz suave de `sim/elements/common.ts` (`smoothSqrt`).

### 5.2. Red térmica (dominio `thermal`)

| nodo | capacidad |
|---|---|
| `engine` (bloque + camisa) | 50 kJ/K |
| `radiatorT` | 8 kJ/K |
| `heaterT` | 1 kJ/K |
| `ambient` | fijo en `ambientC` |

| elemento nuevo | puertos | ley |
|---|---|---|
| `heatSource` | a | inyecta `control.q` W en su nodo |
| `thermalConductance` | a, b | `q = control.g·(Ta − Tb)` (W/K) |
| `advection` | a (aguas arriba), b | inyecta en **b** `control.mc·(Ta − Tb)` W y nada en a (esquema *upwind*); `mc = ṁ·cp` en W/K |

- Calor al refrigerante: `Q = 3 kW + 45 kW·carga·rpm/6000` (con el motor
  apagado 0; en el vehículo, `engine.rpm`, `engine.load` y 0 si no está en
  marcha).
- Advección: `mc = q[L/h]/3600·1,05 kg/L·3600 J/(kg·K)` en los dos sentidos
  del lazo: `engine → radiatorT` y `radiatorT → engine` con el caudal del
  radiador; igual con el calefactor.
- Pérdida natural del bloque: `thermalConductance` 8 W/K a ambiente.
- Radiador a ambiente: `g = UA = (30 + 770·(1 − e^{−aire/12}))·(1 −
  0,8·finsClog)·(1 − 0,4·tubesClog)` W/K, con `aire` (m/s) =
  `vehicleSpeedKmh/3,6 + aire_ventilador`.
- Calefactor a la cabina: `g = 100 W/K` con `heaterOn`, 0 sin (con 900 L/h
  el nodo del calefactor queda en ~84 °C y entrega ~6 kW).
- `fastThermal`: todos los controles térmicos (`q`, `g`, `mc`) ×20. El
  estado publica los valores sin escalar.

### 5.3. Ventilador

- **Eléctrico**: termocontacto cierra a 100 °C y abre a 95 °C (histéresis;
  lee `tempSensor`, que es el nodo `engine` salvo la falla). Cierra un
  `switch` (relé) hacia el motor del ventilador (`resistor 1,3 Ω` → ~10 A a
  13,8 V). `aire_ventilador = 7 m/s·clamp(I/10 A, 0, 1,1)`. `fanDead`: el
  resistor pasa a 1e7 Ω.
- **Viscoso**: `aire_ventilador = 7 m/s·(rpm/3000)·acople`, tope 9 m/s;
  `acople = 0,3 + 0,6·clamp((T_radiador − 60)/25, 0, 1)` y como máximo
  `0,9 − 0,6·fanClutchWorn`.

### 5.4. Termostato y aire en el circuito

`abre` sigue a `T_motor` con τ = 5 s (la cera tarda). La bomba recibe
`aire = max(aire_nivel, aire_ebullición)`:
- `aire_nivel = clamp((5,5 − nivel)/1,5, 0, 0,9)` con el nivel en litros
  (lleno 7 L);
- `aire_ebullición = clamp((T_motor − T_ebull)/5, 0, 0,8)`.
Con aire, la camisa transfiere peor: la conductancia efectiva del motor al
refrigerante se modela bajando `mc` del lazo ×`(1 − aire)`.

### 5.5. Ebullición

`T_ebull = 107 + 20·p_sistema` °C (mezcla 50 % a presión atmosférica:
107 °C; a 1,1 bar: 129 °C). Estado `boiling` si `T_motor > T_ebull`.

### 5.6. Presión del sistema

`p_sistema = capFailed ? 0 : min(1,1, max(0, 0,016·(T_motor − 20)))` bar (la
dilatación sube la presión hasta que abre la tapa). Frío: 0; a 90 °C: 1,1.

### 5.7. Nivel

`nivel -= (q_fugaBomba + q_fugaManguera)/3600·dt` (L). Las fugas sólo
fluyen con presión (`leak` ya es `k·s·√p⁺`); con el motor apagado y frío
no se pierde nada: eso es una pista real.

### 5.8. Referencia (simulación de dos nodos del planificador)

| escenario | resultado |
|---|---|
| calentamiento en ralentí, 25 °C | 42 °C a 5 min, 69 a 15, 88 a 25 |
| ralentí caliente, ventilador sano | 95 °C estable |
| tráfico 1200 rpm / carga 0,15 / 0 km/h, ventilador muerto | 94 a 20 min, 109 a 30 y subiendo |
| carretera 3000 / 0,5 / 100 km/h | 89 °C |
| termostato abierto, 5 °C, carretera | 27 °C (el real queda en 40–60; el modelo exagera, se acepta) |
| termostato cerrado, carretera | 91 a 5 min, 128 a 10, 150 a 15 |
| subida 5000 / 0,9 / 60 km/h | 94 °C |
| panal tapado 0,7 en subida 4000 / 0,7 / 60 | 105 °C |

## 6. Estado

`engineTemp`, `radiatorTemp`, `heaterTemp` (°C), `gaugeTemp` (°C que marca
el reloj), `thermostatOpen` (0..1), `qPump`, `qRadiator`, `qBypass`,
`qHeater` (L/h), `pSystem` (bar), `boilPoint` (°C), `boiling` (bool),
`level` (L), `pumpAir` (0..1), `fanOn` (bool), `fanAir` (m/s),
`fanCurrent` (A), `heatIn`, `heatRadiator`, `heatCabin` (kW, sin escalar).

## 7. Lecturas

Temperatura del motor (verde 85–100, `history`), lo que marca el reloj,
temperatura del radiador (`history`), apertura del termostato (%), caudal
de la bomba y del radiador (L/min), presión del sistema (bar), punto de
ebullición, nivel (L), calor que entra y que sale (kW, `history`),
ventilador (on/off y aire).

## 8. Vista (viewBox 1300×720)

Motor a la izquierda con la camisa, bomba abajo con su polea y correa,
termostato arriba en la salida (válvula que se abre con `thermostatOpen`),
manguera superior al radiador (derecha), radiador con los tubos y el panal
(el panal se ve sucio con `finsClog`), ventilador delante (aspas que giran
con `fanAir`), manguera inferior de vuelta a la bomba, bypass corto entre
termostato y bomba, calefactor al medio con su llave, depósito con nivel y
la tapa. Partículas `p-coolant` **coloreadas por temperatura** (interpolan
`--coolant` → `--coolant-hot` entre 40 y 110 °C), burbujas `p-air` con
`pumpAir`, vapor en el motor con `boiling`, goteo en las fugas.

Drawers nuevos (`src/render/svg/drawers/cooling/`): `engineJacket`,
`waterPump`, `thermostat`, `radiator`, `fan`, `expansionTank`,
`heaterCore`, `tempGauge`. Canales: `engineJacket.{temp, boiling}`,
`thermostat.open`, `radiator.{temp, dirt}`, `fan.{speed, dead}`,
`expansionTank.{level, pressure}`, `heaterCore.{temp, on}`,
`tempGauge.{reading}`, y `potential`/`flow` por enlace. Los que delatan una
falla: `radiator.dirt`, `fan.dead`, `tempGauge.reading` (miente).

## 9. Narración

- `thermostatOpen` pasa de 0 a > 0 → info: "El termostato empieza a abrir:
  el refrigerante ya pasa por el radiador."
- motor frío (< 80 °C tras 20 min equivalentes) con `thermostat='stuckOpen'`
  → warn: "El motor no llega a temperatura: el termostato está abierto y el
  radiador lo enfría todo el tiempo."
- `engineTemp > 105` → warn: "El motor se está recalentando."
- `boiling` → bad: "¡Hierve el refrigerante! Se forma vapor y la bomba
  empieza a mover aire."
- `level < 5,5` → bad: "Falta refrigerante: la bomba aspira aire."
- `gaugeTemp` difiere de `engineTemp` > 15 °C → warn (sólo en laboratorio):
  "El reloj no marca lo que pasa en el motor: el sensor falla."
- `fanOn` → info: "Se prendió el ventilador."
- `capFailed` y > 100 °C → warn: "La tapa no sostiene presión: hierve a
  107 °C en vez de 129."

## 10. Presets

"Calentar desde frío" (`fastThermal`), "Ralentí en verano", "Tráfico con
el ventilador muerto", "Termostato pegado abierto en invierno",
"Termostato pegado cerrado", "Panal tapado subiendo una cuesta",
"Manguera rota", "El reloj miente" (`sensorFault='readsCold'` + tráfico).

## 11. Tests (`tests/cooling/*.test.ts`)

Los escenarios largos usan `fastThermal` (×20) para durar poco; el tiempo
equivalente es el que dice cada test. `failures === 0` en todos.

1. Elementos nuevos (`tests/sim/elements.test.ts`): `centrifugalPump`,
   `variableOrifice`, `heatSource`, `thermalConductance`, `advection`: ley y
   jacobiano contra diferencias finitas (error < 1e-4). `advection`
   conserva la energía en un lazo cerrado de 3 nodos (Σ C·T constante
   ± 1e-6).
2. Validación: conectar un puerto `thermal` con uno `hydraulic` es error
   (`domain-mismatch`).
3. Calentamiento en ralentí desde 25 °C: llega a 85 °C entre **15 y 30 min**
   equivalentes.
4. Ralentí caliente (arranca en 88 °C), 20 min: `engineTemp` en **[88;
   100]**.
5. Tráfico (1200 / 0,15 / 0 km/h) con `fanDead`, 30 min: `> 105 °C` y
   subiendo; sin la falla, ≤ 101 °C.
6. Carretera 3000 / 0,5 / 100 km/h, 20 min: **[86; 95] °C**.
7. `stuckOpen`, 5 °C, carretera, 30 min: **< 60 °C**.
8. `stuckClosed`, carretera, 15 min: **> 120 °C** y `boiling`.
9. `capFailed` + tráfico con `fanDead`: `boiling` aparece con
   `engineTemp < 110`.
10. Subida 5000 / 0,9 / 60 km/h, 15 min: **≤ 101 °C**; con `finsClog 0,7`:
    **> 104 °C**.
11. `hoseLeak = 1` caliente: el nivel baja; bajo 5,5 L aparece `pumpAir > 0`
    y `engineTemp > 110` antes de 10 min equivalentes.
12. Calefactor con el motor a 90 °C: `heatCabin` en **[3; 8] kW**; con
    `heaterClog = 1`, < 2 kW.
13. Eléctrico: con el ventilador prendido `fanCurrent` en [9; 11,5] A.
    Viscoso: a 3000 rpm y radiador a 90 °C `fanAir` en [5; 8] m/s.
14. `sensorFault='readsCold'`: `gaugeTemp = engineTemp − 30 ± 0,5`.
15. Robustez (200 combinaciones × 2 s) y determinismo.

## 12. En el vehículo

- **Publica**: `engine.coolantTemp` (la del **sensor**, o sea la que ve la
  ECU; si el sensor miente, la ECU también se engaña — pista buena),
  `cooling.boiling` (0/1).
- **Lee**: `engine.rpm`, `engine.load`, `engine.state` (sin calor si no
  está en marcha), `vehicle.speed` (stub `vehicleSpeedKmh` hasta A21).
- **Bus `12v`**: el electroventilador cuelga del bus (10 A: una batería
  débil lo hace girar más lento).
- `pumpBelt.slipping` es la misma correa del alternador: en el vehículo,
  desde A17, la bomba usa `max(beltSlip, belt.slip)` (la señal la publica el
  eléctrico; stub 0).
- Cruce de fluidos (empaquetadura de culata): elemento `breach` de A15;
  este sistema sólo expone el nodo `engineBlock.jacket` para conectarlo.
