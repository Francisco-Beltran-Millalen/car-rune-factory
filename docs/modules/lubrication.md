# Módulo — Lubricación (`lubrication`) — **especificación completa**

> Spec viva, escrita por el agente planificador el 2026-09-26 (plan
> `plans/2026-09-26-lubrication.md`). Las presiones de §5.6 salen de la
> cuenta algebraica del planificador (bomba ideal contra conductancias
> laminares); si un rango no cuadra, se ajustan las constantes aquí (§14).

## 1. Arquetipo y variantes

Un solo arquetipo: cárter húmedo, bomba de engranajes (desplazamiento
positivo), válvula de alivio, filtro con válvula de bypass, galería
principal, cojinetes (bancada, bielas, árbol de levas) que devuelven al
cárter, y un indicador de presión.

| Pieza | Antigua | Moderna | Se implementa |
|---|---|---|---|
| Filtro | cartucho dentro de una carcasa | enroscable (spin-on) con válvula antirretorno | los dos |
| Indicador | manómetro en el tablero | sólo testigo (interruptor a 0,5 bar) | los dos |

Descriptores: `lubrication-gauge` ("Lubricación años 70": cartucho +
manómetro + testigo) y `lubrication-lamp` ("Lubricación años 2000":
enroscable + testigo). `#/lab/lubrication` redirige a `lubrication-lamp`.

## 2. Piezas (`partId`)

`sump`, `drainPlug`, `pickup` (chupador con rejilla), `oilPump`,
`reliefValve`, `oilFilter`, `filterBypass`, `mainGallery`, `mainBearings`,
`rodBearings`, `camBearings`, `pressureSwitch`, `warningLamp`, `battery`,
`key`. Manómetro: `oilGauge`. Enroscable: `antiDrainback`.

## 3. Parámetros

| key | rango | default | significado |
|---|---|---|---|
| `ignitionKey` | `'off' \| 'on' \| 'run'` | `'off'` | con `on` y motor detenido el testigo se prende (prueba de ampolleta) |
| `rpm` | 0–6500 | 800 | stub de `engine.rpm` (con `off`/`on` el motor está detenido) |
| `oilTempC` | −10–150 | 90 | stub de la temperatura del aceite (en el vehículo se calcula, §5.3) |
| `oilGrade` | `'5W-30' \| '10W-40' \| '20W-50'` | `'10W-40'` | viscosidad |
| `lateralG` | 0–1 | 0 | curva/frenada fuerte: el aceite se corre en el cárter |

Acciones: `setOilLevel(L)`, `changeOil()` (4,0 L nuevos y filtro nuevo:
limpia `filterClog` sólo si el modo lo permite — en el laboratorio es un
atajo que pone el nivel y el estado de suciedad; las fallas las cambia el
modo).

## 4. Fallas (ids §26)

| id §26 | clave | tipo | efecto |
|---|---|---|---|
| `mainBearings.wear` | `bearingWear` | 0–1 | holgura: conductancia ×`(1 + s)³` en todos los cojinetes |
| `oilPump.wear` | `pumpWear` | 0–1 | caudal ×`(1 − 0,5·s)`, fuga interna ×`(1 + 4·s)` |
| `reliefValve.stuckOpen` | `reliefStuckOpen` | toggle | la válvula abre a 0,8 bar |
| `oilFilter.clog` | `filterClog` | 0–1 | `k·(1 + 1000·s)`: abre el bypass y el aceite pasa sin filtrar |
| `pickup.clog` | `pickupClog` | 0–1 | rejilla tapada: `k·(1 + 300·s)` en la aspiración → cavitación a altas rpm |
| `oilFilter.gasketLeak` | `filterGasketLeak` | 0–1 | fuga con presión (`leak k = 30·s`): el nivel baja rápido en marcha |
| `oilPan.drip` | `panDrip` | 0–1 | goteo del tapón: `0,05·s` L/h aun detenido |
| `antiDrainback.failed` | `antiDrainbackFailed` | toggle | enroscable: el filtro se vacía detenido → 3 s sin presión al partir |
| `pressureSwitch.stuck` | `switchStuck` | `'ok' \| 'alwaysOn' \| 'neverOn'` | el testigo miente |

## 5. Física

### 5.1. Red (fluido `oil`, bar relativos y L/h)

| pieza | elemento | valores |
|---|---|---|
| cárter | `tank` (`capacity = 5`) | nodo fijo 0 bar; nivel 4,0 L; el aire de la aspiración lo calcula el controlador (§5.4), no el `pickupAir` del `tank`. Control nuevo del `tank`: `drain` (L/h que se pierden sin pasar por la red) |
| rejilla | `restrictor` | `k = 1e-8`, `clogFactor = 300` |
| bomba | **nuevo** `displacementPump` (in, out) | `q = disp·n·60·ηv·(1 − aire) − slip·Δp` (L/h: `disp·n` da L/min); `disp = 6,67e-3 L/rev` (40 L/min = 2400 L/h a 6000; 320 L/h a 800, de donde sale 1,14 bar de §5.7), `ηv = 1 − 0,5·wear`, `slip = 20 L/h/bar·(14/ν)·(1 + 4·wear)`; control `n` (rpm), `air`, `slipFactor` |
| alivio | `reliefRegulator` (in = salida de bomba, ret = cárter, ref = cárter) | `set = 4,5 bar` (0,8 con la falla), `k = 10000 L/h/bar`, `smooth = 0,02` |
| filtro | `restrictor` | `k = 7e-8` (0,1 bar a 1200 L/h), `clogFactor = 1000` |
| bypass del filtro | `reliefRegulator` (in = entrada, ret = salida, ref = salida) | `set = 1,0 bar` |
| galería | `volume` | `c = 0,002 L/bar` |
| cojinetes | **nuevo** `linearRestrictor` (a, b; control `g`) ×3 → cárter | `G_total = 260 L/h/bar` a 14 cSt, repartido bancada 45 %, bielas 35 %, levas/culata 20 % |
| fuga del filtro | `leak` | en la galería |

`g` de cada cojinete = `G_parte·(14/ν)·(1 + wear_ef)³`, con `wear_ef =
max(bearingWear, bearingDamage)` (§5.5).

### 5.2. Viscosidad

`ν(T) = ν100·e^{β·(100 − T)}` cSt:

| grado | ν100 | β | ν a 20 °C |
|---|---|---|---|
| 5W-30 | 10 | 0,030 | 110 |
| 10W-40 | 14 | 0,031 | 167 |
| 20W-50 | 18 | 0,033 | 252 |

### 5.3. Temperatura del aceite

Laboratorio: `oilTempC`. Vehículo: `T_aceite` sigue a
`engine.coolantTemp + 10·engine.load` con τ = 120 s (estado).

### 5.4. Aire y cavitación

`aire = max(aire_nivel, aire_cavitación)`:
- `aire_nivel = clamp((2,0 − nivel_ef)/1,0, 0, 1)`, con el nivel efectivo
  `nivel_ef = nivel − 1,5·lateralG` (el aceite se corre en las curvas): a
  4 L nada; a 2,3 L con 0,6 g, 0,6; a 1 L, todo aire;
- `aire_cavitación = clamp((−0,6 − p_aspiración)/0,3, 0, 0,8)`.
- `antiDrainbackFailed` (sólo enroscable): si el motor estuvo detenido más
  de 60 s, al arrancar `startupDry = 3 s` y durante ese tiempo `aire = 1`
  (la bomba está llenando el filtro vacío).

### 5.5. Daño y agarrotamiento

Con el motor en marcha y `p_galería < 0,3 bar`:
`bearingDamage += 0,02/s·(rpm/3000)` (acelerado para el laboratorio; se
dice en la narración). `bearingDamage ≥ 0,95` → `seized` (el motor se
clava; en el vehículo `engineCore` lo detiene y no vuelve a girar).
Golpeteo de bielas: `knock = clamp((wear_ef − 0,5)·2, 0, 1)·carga`.

### 5.6. Testigo y manómetro

El interruptor cierra a masa con `p_galería < 0,5 bar` → el testigo
(`resistor 60 Ω` ≈ 0,2 A, en el bus 12 V) se prende con la llave en
`on`/`run`. El manómetro marca `p_galería` con τ = 0,3 s.

### 5.7. Referencia (cuenta del planificador, 10W-40, bomba sana)

| T aceite | 800 rpm | 2000 | 3000 | 6000 |
|---|---|---|---|---|
| 20 °C | 4,5 (alivio) | 4,5 | 4,5 | 4,5 |
| 60 °C | 3,95 | 4,5 | 4,5 | 4,5 |
| 100 °C | 1,14 | 2,86 | 4,29 | 4,5 (alivio) |
| 120 °C | 0,62 | 1,54 | 2,31 | 4,5 |

Ralentí caliente por grado: 5W-30 0,82, 10W-40 1,14, 20W-50 1,47 bar.
Cojinetes gastados (con `(1 + s)³`), ralentí caliente: 0,2 → 0,68 bar
(testigo apagado), 0,5 → 0,36 (prendido), 1,0 → 0,15. Bomba gastada 1,0:
ralentí caliente 0,44, 3000 → 1,67.

## 6. Estado

`pGallery`, `pPumpOut`, `pSuction`, `dpFilter` (bar), `qPump`, `qRelief`,
`qBypass`, `qBearings` (L/h), `viscosity` (cSt), `oilTemp` (°C), `level`
(L), `pumpAir` (0..1), `bypassOpen` (bool), `lampOn` (bool), `gauge`
(bar), `bearingDamage` (0..1), `seized` (bool), `knock` (0..1),
`startupDry` (s restantes sin presión por el antirretorno).

## 7. Lecturas

Presión en la galería (manómetro 0–6, verde 1–4,5, `history`), caudal de
la bomba, por el alivio y por los cojinetes (L/min), caída en el filtro
(bar), viscosidad (cSt), temperatura del aceite, nivel (L, verde 3,5–4,5),
testigo (on/off), daño de cojinetes (%).

## 8. Vista (viewBox 1200×720)

Cárter abajo (nivel ∝ `level`, se inclina con `lateralG`), chupador con
rejilla, bomba de engranajes (dos engranajes que giran ∝ rpm), válvula de
alivio con resorte (se abre con `qRelief`), filtro (cartucho en carcasa o
enroscable según la variante) con la chapaleta de bypass, galería
horizontal con las derivaciones a 5 bancadas, taladros a las bielas y
subida a la culata, retornos goteando al cárter. Testigo y (70) manómetro a
la derecha, con el cable al bus. Partículas `p-oil` ∝ caudal; el color del
tubo por presión; `p-air` con aire. Drawers nuevos en
`src/render/svg/drawers/lubrication/`: `sump`, `gearPump`, `reliefValve`,
`oilFilter`, `gallery`, `bearing`, `warningLamp`, `oilGauge`. Canales que
delatan falla: `bearing.wear`, `oilFilter.dirt`, `pickup.dirt`.

## 9. Narración

- llave en `on` sin motor → info: "Testigo prendido con el motor detenido:
  es normal (prueba de ampolleta)."
- aceite frío y alivio abierto → info: "El aceite frío es espeso: la
  presión sube al tope y la válvula de alivio devuelve el sobrante."
- `lampOn` en marcha → bad: "Se prendió el testigo de aceite: la presión
  bajó de 0,5 bar."
- `bypassOpen` → warn: "El filtro está tapado: la válvula de bypass deja
  pasar aceite sin filtrar."
- `pumpAir > 0,1` → bad: "La bomba aspira aire (poco aceite o rejilla
  tapada)."
- `bearingDamage` creciendo → bad: "Sin presión los cojinetes se están
  dañando (acelerado ×1000)."
- `knock > 0,3` → warn: "Golpeteo de bielas: los cojinetes tienen mucha
  holgura."
- `seized` → bad: "El motor se agarrotó."
- `startupDry > 0` → warn: "Al partir no hay presión por unos segundos: el
  filtro se vació (válvula antirretorno)."

## 10. Presets

"Arranque en frío" (20 °C), "Caliente en ralentí", "Aceite equivocado"
(5W-30 a 120 °C en ralentí), "Cojinetes gastados: se prende el testigo en
ralentí caliente" (0,5), "Poco aceite en las curvas" (nivel 2,3 L,
`lateralG` 0,6), "Filtro tapado", "Motor sin aceite" (nivel 1 L: el daño
avanza hasta agarrotar), "Testigo que miente".

## 11. Tests (`tests/lubrication/*.test.ts`)

1. Elementos nuevos (`displacementPump`, `linearRestrictor`, control `drain`
   del `tank`): ley + jacobiano contra diferencias finitas.
2. Caliente (100 °C, 10W-40): 800 rpm **[0,9; 1,5]**, 2000 **[2,4; 3,3]**,
   3000 **[3,9; 4,6]**, 6000 **[4,4; 4,9]**.
3. Frío (20 °C) en ralentí: **≥ 4,4 bar** y `qRelief > 0`.
4. Ralentí caliente por grado: 5W-30 < 10W-40 < 20W-50, con 5W-30 en [0,6;
   1,0].
5. `bearingWear = 0,2` → testigo apagado en ralentí caliente; `0,5` →
   prendido.
6. `pumpWear = 1` → ralentí caliente < 0,6 y 3000 rpm en [1,3; 2,1].
7. `filterClog = 1` → `bypassOpen`, `dpFilter` en [0,9; 1,3].
8. `reliefStuckOpen` → 3000 rpm caliente < 1,2 bar.
9. `pickupClog = 1`, caliente: 6000 rpm con `pumpAir > 0`; ralentí sin aire.
10. Nivel 2,3 L con `lateralG = 0,6` → `pumpAir > 0` y la presión cae; con
    `lateralG = 0` no.
11. Nivel 1 L en marcha a 3000 rpm → `seized` antes de 90 s.
12. Llave `on` sin motor → `lampOn`; `switchStuck='neverOn'` → nunca.
13. `antiDrainbackFailed` (enroscable): los primeros ~3 s tras arrancar
    `pGallery < 0,3`; sana: > 0,8 antes de 1 s.
14. Robustez y determinismo; `failures === 0`.

## 12. En el vehículo

- **Publica**: `lubrication.pressure` (galería; la lee el tensor hidráulico
  de A11 y `engineCore`), `lubrication.seized` (0/1) y
  `lubrication.viscosity` (cSt; la lee el motor de arranque de A17: aceite
  frío = motor duro de girar).
- **Lee**: `engine.rpm`, `engine.state`, `engine.coolantTemp`,
  `engine.load`.
- **Bus `12v`**: el testigo.
- Pista entre sistemas: con `chainGuide.broken` de A11 el filtro se tapa
  más rápido (A15 puede sumar `filterClog` efectivo desde la señal
  `engine.debris`; queda registrado, no se implementa en A14).
