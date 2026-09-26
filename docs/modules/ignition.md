# Módulo — Encendido (`ignition`) — **especificación completa**

> Spec viva, escrita por el agente planificador el 2026-09-26 (plan
> `plans/2026-09-26-ignition.md`). Si cambia una constante, se cambia acá con
> la cuenta (§14) y se anota en `AHORA.md`.

## 1. Arquetipo y variantes

**Una bobina**: primario RL que se carga durante el *dwell*, y al cortarse
el primario la energía `½·L·i²` pasa al secundario y salta en la bujía si
alcanza el voltaje de ruptura. Lo intercambiable:

| Pieza | Antigua (~1970–85) | Moderna (~1995–2010) |
|---|---|---|
| Corte del primario | platinos + condensador (con resistencia balasto) | transistor (igniter) con límite de corriente |
| Reparto de la alta | distribuidor: rotor + tapa + cables | una bobina por cilindro (COP) |
| Avance | contrapesos (rpm) + cápsula de vacío (`intake.map`) | mapa de la ECU (rpm y `intake.map`) |
| Sincronía | el distribuidor gira con la **leva** (`engine.camAngle`) | sensor de cigüeñal 60-2 (`engine.crankAngle`) + sensor de leva |

Se implementan dos descriptores del mismo código:

- `ignition-points` — "Encendido años 70": platinos, condensador, balasto,
  bobina única, distribuidor con avance centrífugo y por vacío.
- `ignition-cop` — "Encendido años 2000": ECU, sensor de cigüeñal y de
  leva, igniter, 4 bobinas COP.

Quedan **registradas** (no se implementan): electrónico con distribuidor
(Hall o inductivo, ~1985–95: sería `ignition-points` con el igniter de COP
en vez de platinos) y DIS de chispa perdida (dos bobinas dobles). Salen
combinando piezas; se hacen si el usuario las pide.

**Por qué un modelo por eventos y no el solver para la bobina.** A 6000 rpm
un cilindro de 4 enciende cada 5 ms y el dwell dura ~3 ms: con el paso de
1 ms (§4) serían 3 pasos de carga y el corte caería con 36° de error. El
voltaje del secundario (kV en µs) tampoco cabe en el solver (se limita a
±1 V por iteración, `solver.md` §4). Por eso:

- **el solver** ve la parte de baja: batería/bus → llave → (balasto) →
  bobina como una **carga de corriente promedio** (`currentLoad`, §5.6);
- **un controlador** (`ignitionCore`) calcula cada evento de forma
  **analítica** en el ángulo exacto dentro del paso: corriente al corte,
  energía, voltaje disponible, voltaje pedido y si hubo chispa.

## 2. Piezas (`partId`)

Comunes: `battery`, `key`, `coil` (en COP: `coil1`…`coil4`), `sparkPlug1`…
`sparkPlug4`, `scope` (osciloscopio, sólo visual).

`ignition-points`: `ballast`, `points`, `condenser`, `distributor`,
`rotor`, `distributorCap`, `htLead1`…`htLead4`, `coilLead` (cable central),
`centrifugalAdvance`, `vacuumAdvance`, `vacuumLine`.

`ignition-cop`: `ecu`, `crankSensor`, `toothWheel`, `camSensor`,
`igniter`.

## 3. Parámetros (`DEFAULT_PARAMS`)

| key | tipo/rango | default | significado |
|---|---|---|---|
| `ignitionKey` | `'off' \| 'on' \| 'start' \| 'run'` | `'off'` | en `start` el balasto se puentea (platinos) |
| `rpm` | 0–6500 | 800 | stub del motor (§29) |
| `throttle` | 0–1 | 0 | stub → `intake.map = −0,65 + 0,65·throttle` |
| `batteryV` | 9–14,5 | 12,6 | tensión en vacío de la batería del laboratorio |
| `camOffset` | −20–20 | 0 | ° de atraso de la leva que usa el **stub de fase** del laboratorio (entrada de prueba; no es el `camOffset` que calcula `four-stroke`, aunque represente lo mismo) |
| `compression` | 0–1 | 1 | stub de `engine.compression` (escala la presión en la chispa) |
| `humidity` | 0–1 | 0 | humedad ambiente (agrava la tapa fisurada) |
| `dwellMs` | 1–6 | 3 | sólo COP: tiempo de carga que pide la ECU |

## 4. Fallas (ids §26)

| id §26 | clave | tipo | variante | efecto |
|---|---|---|---|---|
| `sparkPlugs.gapWear` | `plugGapWear` | 0–1 | las dos | separación `0,7 + 0,9·s` mm en las 4 |
| `sparkPlug2.fouled` | `plugFouled2` | 0–1 | las dos | derivación: `η·(1 − 0,85·s)` en el cilindro 2 |
| `coil.weak` | `coilWeak` | 0–1 | las dos (COP: bobina 3) | `L·(1 − 0,6·s)` |
| `points.gap` | `pointsGap` | 0–1 | points | platinos muy abiertos: dwell `50°·(1 − 0,4·s)` de distribuidor y `+10°·s` de avance |
| `points.pitted` | `pointsPitted` | 0–1 | points | `+1 Ω·max(s, picado)` en el primario |
| `condenser.open` | `condenserOpen` | toggle | points | `η = 0,12` (el arco se come la energía) y el picado crece solo (§5.5) |
| `condenser.shorted` | `condenserShorted` | toggle | points | el primario nunca se corta: **no hay chispa** |
| `ballast.open` | `ballastOpen` | toggle | points | sin corriente en `run`; en `start` está puenteado: **arranca y se apaga al soltar la llave** |
| `distributorCap.cracked` | `capCracked` | 0–1 | points | fuga a masa: falla `s·(0,3 + 0,7·humidity)` de las chispas (rng con semilla) |
| `rotor.worn` | `rotorWorn` | 0–1 | points | `+4 kV·s` al voltaje pedido |
| `htLead3.open` | `htLead3Open` | toggle | points | cilindro 3 sin chispa |
| `centrifugalAdvance.stuck` | `centrifugalStuck` | toggle | points | avance centrífugo fijo en 0 |
| `vacuumAdvance.diaphragm` | `vacuumDiaphragm` | toggle | points | sin avance por vacío; además es una **entrada de aire falsa** (publica `ignition.vacuumLeak`, §12) |
| `crankSensor.dead` | `crankSensorDead` | toggle | cop | sin sincronía: **ninguna chispa** (y en el vehículo, ninguna inyección) |
| `crankSensor.gap` | `crankSensorGap` | 0–1 | cop | señal débil: sin sincronía bajo `150 + 350·s` rpm → cuesta partir |
| `camSensor.dead` | `camSensorDead` | toggle | cop | pasa a chispa perdida (sigue andando) y deja código |
| `coil2.dead` | `coil2Dead` | toggle | cop | cilindro 2 sin chispa |
| `igniter.dead` | `igniterDead` | toggle | cop | ninguna chispa |

## 5. Física

Constantes:

| | platinos | COP |
|---|---|---|
| primario `R` | 1,5 Ω (+ balasto 1,5 Ω en `run`) | 0,5 Ω |
| `L` | 8 mH | 3 mH |
| límite de corriente | — | 8 A (el igniter disipa el resto) |
| dwell | 50° de distribuidor = 55,6 % del período | `dwellMs` (máx. 80 % del período) |
| `η` (energía útil) | 0,5 | 0,5 |
| capacidad del secundario `Cs` | 50 pF | 50 pF |
| voltaje máximo | 35 kV | 35 kV |

1. **Fase y eventos**. Hay 4 eventos por ciclo (720°), uno por cilindro en
   el orden 1-3-4-2 (desfases 0, 540, 180, 360). El ángulo del corte de
   cada cilindro es `PMS_cil − avance`:
   - platinos: se mide sobre `engine.camAngle` (el distribuidor gira con la
     leva): **si la leva va atrasada, la chispa también**;
   - COP: se mide sobre `engine.crankAngle` (sensor de cigüeñal).
   El controlador busca los cortes que caen en `[θ, θ + Δθ)` del paso y los
   procesa en su ángulo exacto (varios por paso a rpm altas).
2. **Avance** (° APMS de cigüeñal):
   - platinos: `8 + centrífugo + vacío + 10·pointsGap`; centrífugo =
     `24·clamp((rpm − 1000)/2000, 0, 1)`; vacío (**de puerto**: sólo con
     `throttle > 0,02`) = `16·clamp((−map − 0,2)/0,35, 0, 1)`.
   - COP: `10 + 20·clamp((rpm − 800)/2800, 0, 1) + 12·clamp(−map/0,65, 0, 1)`.
   Valores: ralentí platinos 8°, crucero 3000 rpm mariposa 0,3 → 43,7°, a
   fondo 32°; COP ralentí 22°, a fondo 3000 → 25,7°, 6000 → 30°.
3. **Corriente al corte**:
   `i = V_bobina/R_t·(1 − e^{−t_d·R_t/L})`, con `t_d` = dwell en segundos
   (platinos: `0,556·período`; COP: `min(dwellMs, 0,8·período)`), `R_t` =
   R + picado (+ balasto si `run`), y en COP `i = min(i, 8 A)`.
   `V_bobina` es la tensión del nodo de la bobina en el **solver** (paso
   anterior, §25): así una batería débil o un balasto abierto se notan solos.
4. **Voltaje disponible**: `E = ½·L·i²`, `Vdisp = min(35 kV, √(2·η·E/Cs))`.
   **Voltaje pedido** (ruptura):
   `Vped = 2 kV + 2 kV·gap_mm·p_bar + 4 kV·rotorWorn`, con `p_bar` la
   presión del cilindro en la chispa estimada con
   `sim/engine/geometry.ts`: `p = (1,013 + map)·(V_CA/V(360 − avance))^1,3·compression`.
   Chispa si `Vdisp·(1 − derivación) ≥ Vped` y no hay una falla que la
   anule (condensador en corto, cable abierto, bobina muerta, sin
   sincronía). Duración del arco: `t_arco = max(0, η·E − ½·Cs·Vped²)/20 W`.
5. **Platinos y condensador**: `condenser.open` baja `η` a 0,12 y hace
   crecer el picado: `picado += 0,05/s` mientras hay cortes (acelerado,
   narrado); el picado suma `1 Ω·picado` al primario.
6. **Carga en el bus (solver)**. Elemento nuevo `currentLoad` (puertos `a`,
   `b` eléctricos): `I = control.i·clamp((Va − Vb)/1 V, 0, 1)` (se apaga
   suave sin tensión). El controlador le escribe la corriente **promedio**
   del paso: `Σ(∫i dt de cada dwell que cae en el paso)/dt`. Valores
   esperados: platinos 2,2 A en ralentí, 1,5 A a 3000, 0,95 A a 6000; COP
   (4 bobinas) 0,43 A en ralentí, 1,6 A a 3000, 3,3 A a 6000.
   Circuito de baja:
   - platinos: `battery.+ → key → ballast → coil(currentLoad) → masa`. El
     balasto es un `switch` con `rOn = 1,5 Ω` y `rOff = 1e7 Ω`, cerrado
     salvo con `ballastOpen` (el `resistor` no tiene control para abrirse
     en marcha). En paralelo, otro `switch` (`rOn = 0,001`) cerrado sólo en
     `start` (el contacto de arranque del burro);
   - COP: `battery.+ → key → coilBus → coil1..4(currentLoad) → masa`.
7. **Sincronía (COP)**: sin `crankSensor.dead` y con
   `rpm ≥ 150 + 350·crankSensorGap`. Sin sensor de leva, chispa perdida:
   cada bobina dispara también en el PMS de escape (la corriente promedio se
   duplica) y queda el código `P0340`.
8. **Código de correlación (COP)**: `camOffset_medido = crankAngle −
   camAngle`; si `|camOffset_medido| > 6°` durante 2 s → código `P0016`
   ("correlación cigüeñal/leva"). Es la pista del chavetero ovalado en un
   auto moderno: la chispa está bien pero la ECU avisa.
9. **Señales**: `ignition.spark` = fracción de chispas buenas de los
   últimos eventos (media exponencial, τ = 0,2 s; 0..1). `ignition.advance`
   = avance efectivo del último evento, **medido sobre el cigüeñal** (en
   platinos incluye el atraso de la leva). `ignition.vacuumLeak` = entrada
   de aire del diafragma roto (kg/h, 1,5 con el motor en vacío, 0 sano).

Comprobación a mano (referencia del planificador):

| caso | i al corte | E | Vdisp | Vped (gap 0,7 / 1,6) |
|---|---|---|---|---|
| platinos 800 rpm | 4,6 A | 85 mJ | 35 kV | 10,4 / 21,2 (ralentí, p≈6) |
| platinos 6000 a fondo | 2,96 A | 35 mJ | 26,5 kV | 13,2 / 27,6 (p≈8) |
| platinos 6000, batería 12,0 V | — | — | 23,0 kV | → 1,6 falla, 0,7 no |
| platinos arranque (balasto puenteado, 10,5 V) | 7,0 A | 196 mJ | 35 kV | |
| COP cualquier rpm | 8 A (límite) | 96 mJ | 35 kV | |
| condensador abierto, 3000 | | | 17,6 kV | |

## 6. Estado

`engineState`-independiente (este sistema no decide si el motor anda).
`crankAngle` y `camAngle` (°, del bus), `advance` (°), `dwellMs` (ms),
`iBreak` (A), `energy` (mJ), `vAvail` (kV), `vReq` (kV), `arcMs` (ms),
`lastCylinder` (1..4), `sparkOk` (bool, último evento), `sparkRate`
(0..1, señal), `sparks` ([4] 0..1, por cilindro, media), `coilV` (V),
`busCurrent` (A), `sync` (bool, COP), `codes` (string[], COP), `pitting`
(0..1), `eventCount`.

## 7. Lecturas

Avance (°, `history`), tensión en la bobina (V, verde 11,5–14,5), corriente
al corte (A), energía (mJ), voltaje disponible y pedido (kV, `history` los
dos), chispas buenas (%, verde 98–100), corriente del bus (A), rpm de
sincronía (COP), códigos (texto en el panel de lecturas como valor 0/1 por
código activo).

## 8. Vista (viewBox 1300×720)

- **Baja tensión** arriba (red del solver, drawers eléctricos existentes +
  nuevos): batería, llave, balasto con su puente de arranque, bobina.
  Partículas `p-electric` ∝ `busCurrent`.
- **Platinos**: drawer `distributor` (vista de arriba): leva de 4 lóbulos
  que gira con `camAngle/2`, platinos que abren/cierran (el contacto se ve
  quemado con `pitting`), condensador, rotor apuntando al terminal activo,
  tapa con los 4 terminales y los cables a las bujías; la cápsula de vacío
  al costado con su manguera (`--vacuum`) y los contrapesos que se abren
  con las rpm.
- **COP**: drawer `toothWheel` (rueda 60-2 con el sensor y el hueco de dos
  dientes), `ecu`, 4 bobinas sobre las bujías (`coilCop`).
- **Bujías** (`sparkPlug`): destello amarillo en cada chispa buena, gris y
  sin destello si falla; la separación se dibuja proporcional a `gap`.
- **Osciloscopio** (drawer `scope`, abajo a la derecha): dos canales,
  corriente del primario (rampa del dwell hasta `iBreak`) y voltaje del
  secundario (pico a `vReq`, línea de arco de ~1,5 kV durante `arcMs`,
  oscilación amortiguada al final). El trazo se arma **analíticamente** en
  el drawer con los canales del último evento, así se ve nítido aunque el
  paso sea de 1 ms. Se congela con la simulación en pausa.

Canales (`present.ts`): `plugN.{spark, gap, fouled}`, `points.{open,
pitting}`, `rotor.{angle, target}`, `distributor.{cam, weights, vacuum}`,
`wheel.{angle, sync}`, `coilN.{charging, dead}`, `scope.{i, v, arc, req,
cyl}`, `ecu.{codes}`. Los que delatan falla con nombre propio
(`points.pitting`, `plugN.fouled`).

## 9. Narración

- Balasto abierto y llave en `run` sin chispas → bad: "Con la llave en
  marcha no llega corriente a la bobina: el balasto está cortado. En
  arranque sí, porque se puentea."
- `condenserShorted` → bad: "El condensador está en corto: los platinos no
  cortan la corriente y no hay chispa."
- `condenserOpen` → warn: "Sin condensador los platinos hacen arco: la
  chispa es débil y los contactos se queman."
- chispas < 90 % con rpm > 4000 y `vReq` alta → warn: "A alta carga la
  bujía pide {vReq} kV y la bobina da {vAvail}: falla en alta."
- `|advance − esperado| > 5°` en platinos por la leva → warn: "La chispa
  viene {x}° atrasada: el distribuidor gira con la leva y la leva está
  fuera de punto."
- código `P0016` → warn: "La ECU ve que la leva no coincide con el cigüeñal
  (P0016): revisa la distribución."
- sin sincronía → bad: "La ECU no ve el sensor de cigüeñal: no hay chispa
  (ni inyección)."
- `camSensorDead` → info: "Sin sensor de leva la ECU enciende en chispa
  perdida: anda, pero deja el código P0340."
- `vacuumDiaphragm` → warn: "El diafragma del avance por vacío está roto:
  no adelanta en crucero y entra aire falso al múltiple."

## 10. Presets

Platinos: "Sano en ralentí", "Crucero (se ve el avance por vacío)",
"Arranca y se apaga al soltar la llave" (balasto), "Falla en alta: bujías
gastadas" (gap 1, a fondo 6000), "Condensador malo", "Leva atrasada 10°:
la chispa también". COP: "Sano", "Sensor de cigüeñal muerto", "Bobina 2
muerta", "Leva atrasada 10°: chispa bien, código P0016", "Cuesta partir:
sensor con mucha separación".

## 11. Tests (`tests/ignition/*.test.ts`)

1. Primario COP sin límite de corriente: a `t = τ = L/R = 6 ms` la corriente
   es 63,2 % ± 0,5 de `V/R`.
2. COP sano: `ignition.spark = 1` en la grilla rpm {250, 800, 3000, 6000} ×
   mariposa {0; 0,5; 1}.
3. Platinos sanos: `ignition.spark = 1` en la misma grilla (a 250 rpm con
   `start`).
4. Platinos + `plugGapWear = 1`, a fondo 6000 rpm: `spark < 0,9`; en
   ralentí `spark = 1`. COP con la misma falla: `spark = 1`.
5. Platinos, batería 10 V (sin alternador), `plugGapWear = 1`, 6000 a fondo:
   `spark < 0,5`.
6. `ballastOpen`: en `start` chispa 1; al pasar a `run`, 0 en < 0,3 s.
7. `condenserShorted` → 0 chispas; `condenserOpen` a 3000: `vAvail` en
   [15; 20] kV y `pitting` crece.
8. `crankSensorDead` → 0 chispas y `sync = false`; `crankSensorGap = 1` →
   sin sincronía a 250 rpm, con sincronía a 800.
9. `camOffset = 10` (stub): platinos `advance` baja 10° ± 0,5; COP
   `advance` igual que con 0 y código `P0016` activo tras 2 s.
10. Avance: platinos ralentí 8 ± 0,5; crucero 3000/0,3 en [40; 46]; COP
    ralentí 22 ± 0,5.
11. Corriente del bus (solver): platinos ralentí 2,2 ± 0,3 A; COP ralentí
    0,43 ± 0,1 A; COP 6000 3,3 ± 0,4 A. `failures === 0`.
12. Varios cortes en un paso: a 6500 rpm no se pierde ningún evento (4 por
    ciclo exactos durante 1 s).
13. Robustez y determinismo (como §11 de four-stroke).

## 12. En el vehículo

- **Publica**: `ignition.spark`, `ignition.advance`, `ignition.vacuumLeak`
  (kg/h; la consume la admisión en A18; hasta entonces `engineCore` la
  suma al aire no medido, plan del vehículo), `ecu.sync` (COP; 1 en
  platinos) — la lee el combustible en A15 para cortar la inyección sin
  sincronía.
- **Lee**: `engine.crankAngle`, `engine.camAngle` (same-step),
  `engine.rpm`, `intake.map`, `engine.compression`. El `throttle` es param
  del vehículo.
- **Bus `12v`**: la baja tensión cuelga del bus. En `vehicle-70` este
  sistema es el **proveedor** del bus (su batería y llave) hasta que exista
  el eléctrico (A17).
