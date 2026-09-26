# Módulo — Ciclo de 4 tiempos y distribución (`four-stroke`) — **especificación completa**

> Spec viva. La escribió el agente planificador el 2026-09-26 (plan
> `plans/2026-09-26-four-stroke.md`). Si cambia una constante, se cambia acá
> con la cuenta (ARCHITECTURE §14) y se anota en `AHORA.md`. Los números de
> §5 salen de una simulación de referencia hecha al escribir esta spec; los
> rangos de §11 están puestos con margen alrededor de esos valores.

## 1. Arquetipo y variantes

Un motor de pistón de 4 tiempos, **4 cilindros en línea**, orden de
encendido 1-3-4-2. Es un **mecanismo**: no usa el solver (no hay red de
esfuerzo/flujo), integra su propio estado dentro de un controlador.

| Pieza intercambiable | Variantes | Se implementa |
|---|---|---|
| Accionamiento de la distribución | cadena · correa dentada · engranajes | **cadena** y **correa** (engranajes queda registrado: sin tensor, sin fallas de estiramiento; sólo desgaste de dientes) |
| Tren de válvulas | OHV (varillas y balancines) · SOHC · DOHC | **OHV** y **DOHC** (SOHC sale combinando: mismo árbol que DOHC con balancines; queda registrado) |
| Tensor | resorte · hidráulico (presión de aceite) | los dos |

Dos descriptores generados por el mismo código (D-V8 del plan del vehículo):

- `four-stroke-ohv` — "Motor años 70": OHV, cadena corta, tensor de resorte,
  reglaje de taqués manual (tiene la falla `rocker.lash`).
- `four-stroke-dohc` — "Motor años 2000": DOHC, cadena con tensor
  hidráulico. La **correa** es un param de este mismo descriptor
  (`drive: 'chain' | 'belt'`), con sus fallas propias.

La ruta `#/lab/four-stroke` redirige a `four-stroke-dohc` (la que existía en
el catálogo).

## 2. Piezas (`partId`)

Motor: `cyl1`…`cyl4` (cada cilindro como conjunto; son los dueños de las
fallas por cilindro), `piston`, `rings`, `rod`, `crank`, `head`,
`intakeValve`, `exhaustValve`, `camshaft`, `sparkPlug`, `intakePort`,
`exhaustPort`. Sólo OHV: `pushrod`, `rocker`.

Distribución: `crankBolt` (perno de la polea/piñón), `crankKey` (chaveta y
chavetero), `crankSprocket`, `timingChain` (o `timingBelt`), `tensioner`,
`chainGuide` (no existe en correa), `camSprocket`.

El diagrama dibuja **un** cilindro (el elegido con `viewCylinder`); `piston`,
`rings`, `intakeValve`, etc. son las piezas de ese dibujo. Las fallas por
cilindro son de `cylN`.

## 3. Parámetros (`DEFAULT_PARAMS`)

| key | tipo/rango | default | significado |
|---|---|---|---|
| `mode` | `'auto' \| 'manual'` | `'auto'` | `manual`: el cigüeñal queda en `crankDeg` (slider), sin integrar rpm |
| `rpm` | 60–6500 | 800 | rpm del laboratorio (en el vehículo: señal `engine.rpm`) |
| `crankDeg` | 0–720 | 0 | ángulo en modo manual |
| `throttle` | 0–1 | 0 | mariposa → presión del múltiple (en el vehículo: señal `intake.map`) |
| `sparkAdvance` | 0–40 | 10 | ° APMS (en el vehículo: señal `ignition.advance`) |
| `spark` | bool | true | stub de chispa (§29); en el vehículo, `ignition.spark` |
| `oilPressure` | 0–6 | 3 | bar, stub del tensor hidráulico (§29); en el vehículo, `lubrication.pressure` |
| `viewCylinder` | 1–4 | 1 | qué cilindro se dibuja |
| `drive` | `'chain' \| 'belt'` | `'chain'` | sólo en `four-stroke-dohc` |
| `showOverlap` | bool | false | resalta el cruce de válvulas en el diagrama |

Acción: `compressionTest()` — ver §5.8.

## 4. Fallas (ids §26)

| id §26 | clave plana | tipo | efecto (detalle en §5) |
|---|---|---|---|
| `cyl1.ringWear` … `cyl4.ringWear` | `ringWear1`…`4` | 0–1 | fuga de anillos `kLeak = 8·s` |
| `cyl1.burntValve` … `cyl4.burntValve` | `burntValve1`…`4` | 0–1 | fuga al escape `kValve = 20·s` en compresión/expansión |
| `crankBolt.loose` | `crankBoltLoose` | toggle | el chavetero se gasta solo (§5.6, estado `keywayDamage`) |
| `crankKey.keywayWorn` | `keywayWorn` | 0–1 | juego del piñón `play = 8°·max(s, keywayDamage)` |
| `crankKey.sheared` | `keySheared` | toggle | el piñón resbala sobre el cigüeñal (§5.6) |
| `tensioner.weak` | `tensionerWeak` | 0–1 | holgura de la cadena; hidráulico: además depende de la presión de aceite |
| `chainGuide.broken` | `guideBroken` | toggle | holgura +0,5 y restos de plástico (narración, pista para lubricación) |
| `timingChain.stretched` | `chainStretch` | 0–1 | atraso `6°·s` |
| `timingChain.skippedTeeth` | `skippedTeeth` | enum `-2…2` | salto de dientes: `17,14°` por diente (21 dientes en el cigüeñal) |
| `timingBelt.worn` | `beltWear` | 0–1 | sólo `drive='belt'`: atraso `3°·s`; a ≥ 0,9 se corta (estado `beltSnapped`) tras 5 s con carga > 0,5 |
| `rocker.lash` | `valveLash` | 0–1 | sólo OHV: juego de taqués `0,6 mm·s` → alzada menor y tic-tic |

**Ya no son fallas** (las del plan maestro): `camTimingOffset` pasa a ser
`timingChain.skippedTeeth`; `noSpark` pasa al control `spark` (es de otro
sistema); `ringWear` y `burntExhaustValve` pasan a ser por cilindro.

## 5. Física

Constantes (`K` en `model/constants.ts`):

| símbolo | valor | nota |
|---|---|---|
| diámetro `B`, carrera `S` | 86 mm, 86 mm | cilindrada 0,4996 L/cil, 2,0 L total |
| biela `l` | 143 mm | |
| relación de compresión `CR` | 10 | `Vc = Vd/(CR−1) = 55,5 cm³` |
| eventos (° de cigüeñal, 0 = PMS de cruce) | AA −10 (10° APMS), CA 220 (40° DPMI), AE 500 (40° APMI), CE 730 (10° DPMS) | perfil `sin²` sobre la duración, alzada máx. 9 mm |
| holgura válvula-pistón en PMS `g0` | 1,6 mm | motor de interferencia (§5.7) |
| exponente politrópico | `n = 1,3` en marcha, `1,2` al arrastre (< 400 rpm) | el arrastre pierde calor |
| Wiebe | `a = 5`, `m = 2`, duración 50° | parte en `sparkAdvance` APMS de compresión |
| calor por ciclo a fondo `Qwot` | 1250 J/cil | escala con `p_CA/1,013` y con la calidad de mezcla |
| presión de escape | 1,10 bar abs | + `exhaust.backpressure` en el vehículo |
| fricción | `Tf = 12 + 0,002·rpm` N·m | en el cigüeñal |
| dientes | cigüeñal 21, leva 42 | 1 diente = 17,14° de cigüeñal |

1. **Ángulo**. `auto`: `crank += rpm/60·360·dt` (mod 720). `manual`:
   `crank = crankDeg`. En el vehículo el ángulo lo integra este sistema a
   partir de `engine.rpm` y lo publica como `engine.crankAngle` (señal de
   fase, same-step; plan del vehículo §5.2).
2. **Fase de la leva**. `camOffset` (° de cigüeñal, + = atraso) =
   `17,14·skippedTeeth + 6·chainStretch + 3·beltWear + keywayOffset + slip +
   jitter`. `engine.camAngle = wrap(crank − camOffset, 720)`. Los eventos de
   válvula de todos los cilindros se evalúan con `camAngle` (menos el
   desfase de cada cilindro: 0, 540, 180, 360 para 1..4, orden 1-3-4-2).
3. **Geometría**. `s(θ) = r + l − (r·cosθ + √(l² − r²·sin²θ))` (distancia
   al PMS, `r = S/2`), `V(θ) = Vc + A·s(θ)`. PMS en 0/360, PMI en 180/540.
4. **Gas (por cilindro)**, con **subpasos de ≤ 1°** dentro del paso de
   1 ms (a 6000 rpm son 36 subpasos; el subpaso es interno al mecanismo y no
   rompe §4):
   - con las dos válvulas cerradas:
     `dp = −n·p·dV/V + (n−1)/V·dQ·1e-5` (bar, `Q` en J, `V` en m³) menos la
     fuga `dp_fuga = −p·(kLeak·√(p−1) + kValve·√(p−p_esc))·Δt` (sólo con
     `p > 1`);
   - con una válvula abierta, la presión se relaja a la del puerto:
     `p ← p_puerto + (p − p_puerto)·e^{−Δt/τ}`, `τ = 2 ms·9/max(alzada, 0,5)`;
     admisión: `p_puerto = 1,013 + pMan` (`pMan` relativo; lab:
     `−0,65 + 0,65·throttle`; vehículo: `intake.map`); escape: 1,10 bar abs;
   - `dQ = Q·(xb(θ+Δθ) − xb(θ))`, `xb = 1 − e^{−a·((θ−θs)/50)^{m+1}}`,
     `Q = Qwot·(p_CA/1,013)·f_mezcla·chispa`, `p_CA` = presión al cierre de
     admisión del ciclo. `f_mezcla = 1` entre 0,9 y 1,2 de `fuel.mixture`,
     baja lineal a 0 en 0,5 y en 1,8 (lab: 1). `chispa`: 1/0 (lab) o
     `ignition.spark` (vehículo, fracción).
5. **Trabajo y torque**. Trabajo del ciclo = `∮p·dV`; torque instantáneo del
   cilindro = `(p − 1,013)·1e5·A·ds/dθ` (N·m, con `ds/dθ` en m/rad);
   torque del motor = suma de los 4 − `Tf`. Por ciclo se guarda el trabajo
   indicado de cada cilindro y el pico de presión.
6. **Distribución**:
   - `keywayOffset = play·(0,3 + 0,7·carga) + 0,2·play·sin(2·crank)`, con
     `play = 8°·max(keywayWorn, keywayDamage)` y `carga = throttle` (lab) o
     `engine.load`. Con `play > 2°` hay **golpeteo** (canal `knock` del
     piñón, una vez por vuelta).
   - `crankBolt.loose`: `keywayDamage += 0,02/s·(rpm/3000)·(0,5 + carga)`
     (acelerado ×1000 respecto de la realidad para verlo en el laboratorio;
     se dice en la narración). Si `keywayDamage ≥ 1` → `keySheared` pasa a
     ser estado (`keyShearedState = true`).
   - `crankKey.sheared` (falla o estado): `slip += 20°/s·(0,2 + carga)`
     mientras el motor gira; el sensor de cigüeñal sigue leyendo el cigüeñal,
     la leva queda cada vez más atrás.
   - **Holgura** `slack = tensionerWeak + 0,5·guideBroken`; con tensor
     hidráulico `slack += 0,6·(1 − clamp(oilPressure/1,0, 0, 1))` (al partir
     en frío la presión tarda: golpeteo los primeros segundos). `jitter =
     ±2°·slack` a la frecuencia de encendido. `slack > 0,3` → **ruido de
     cadena** (canal `rattle`). `slack > 0,8` y un cambio de rpm > 1500 rpm/s
     → salta un diente (estado `teethJumped`, suma a `skippedTeeth`; el rng
     con semilla decide con prob. `0,5` por evento).
7. **Choque de válvulas**. En cada subpaso: margen =
   `g0 + s(θ)·1000 − alzada` (mm) para la válvula que esté abierta cerca del
   PMS. Si margen < 0 → evento `valveHit` en ese cilindro: estado
   `bentValve[cyl] = true` (queda como `burntValve = 1`), narración "bad".
   Con `g0 = 1,6 mm`: 1 diente (17°) deja 0,2 mm de margen; **2 dientes
   (34°) chocan** (margen −1,7 mm), en los dos sentidos.
8. **Prueba de compresión** (acción `compressionTest()`): pone `mode='auto'`,
   `rpm = 250`, `throttle = 1`, `spark = false` durante 3 s y guarda el pico
   de cada cilindro en `compression[1..4]` (bar **manométricos**). Con
   `n = 1,2` y `p_CA ≈ 1,0 bar abs` el sano da ~13,4 bar. Al terminar vuelve
   a los params previos.
9. **Señales que publica** (plan del vehículo §6): `engine.crankAngle` y
   `engine.camAngle` (°, same-step), `engine.compression` = promedio de
   `pico_cil / pico_sano` (0..1, calculado analíticamente cada 0,1 s con la
   fórmula de la prueba de compresión, sin ejecutar la prueba) y
   `engine.cylinderBalance` = `min/promedio` del trabajo indicado de los 4
   cilindros en el último ciclo (1 = parejo).

Comprobación a mano (simulación de referencia, 3000 rpm, avance 25°):

| caso | pico (bar abs) | trabajo neto/cil (J) | IMEP (bar) | torque 4 cil (N·m, indicado) |
|---|---|---|---|---|
| a fondo | 66 | 585 | 11,7 | 186 |
| mariposa 0,3 | 37 | 298 | 6,0 | 95 |
| ralentí (mariposa 0) | 24 | 174 | 3,5 | 56 |
| a fondo sin chispa | 17,9 | −6 | −0,1 | −2 |

Avance vs trabajo a fondo: 0° → 503 J, 10° → 552, 20° → 581, 30° → 582,
40° → 555 (MBT ≈ 25–30°). Arrastre a 250 rpm, pico abs según fuga de
anillos `k`: 0 → 14,4; 2 → 11,2; 4 → 9,1; 8 → 6,5.

## 6. Estado (`state`), con unidades

`crankAngle` (°), `camAngle` (°), `camOffset` (°), `stroke` (nombre del
tiempo del cilindro visto: `'admisión' | 'compresión' | 'expansión' |
'escape'`), `pressure` (bar abs, cil. visto), `volume` (cm³, cil. visto),
`intakeLift`/`exhaustLift` (mm, cil. visto), `burnFraction` (0..1),
`torque` (N·m, motor), `workPerCycle` ([4], J), `peakPressure` ([4], bar
abs), `compression` ([4], bar manométricos, de la última prueba),
`compressionRel` (0..1, señal), `cylinderBalance` (0..1), `slack` (0..1),
`keywayPlay` (°), `keywayDamage` (0..1), `keyShearedState` (bool),
`teethJumped` (entero), `bentValve` ([4] bool), `beltSnapped` (bool),
`knock` (0..1, pulso), `rattle` (0..1), `valveHit` (0..1, pulso),
`testing` (bool, prueba en curso).

## 7. Lecturas

Ángulo del cigüeñal, tiempo actual (texto en la vista), presión del cilindro
(bar abs, `history`), volumen (cm³), torque del motor (N·m, `history`),
trabajo por ciclo del cilindro visto (J), desfase de la leva (°, `history`,
verde −3..3), holgura de la cadena (%), compresión 1..4 (bar, verde 11–15),
equilibrio entre cilindros (%).

## 8. Vista (viewBox 1400×760)

El módulo **no es una red**, pero la dibuja el renderer genérico igual: el
`CircuitDef` sólo lleva piezas `visual` (sin puertos ni enlaces) y los
drawers nuevos leen canales del presenter. Drawers en
`src/render/svg/drawers/engine/`:

- `cylinderSection` (izquierda, 60–560 × 40–700): corte del cilindro visto,
  con culata, válvulas (bajan según `intakeLift/exhaustLift`), bujía
  (destello con el canal `spark`), pistón, anillos, biela y cigüeñal que
  giran con `crank`. El gas se pinta por fase (`--mixture` → `--burn` →
  `--exhaust`) y su opacidad por `pressure`. Nombre del tiempo en grande.
  OHV agrega varilla y balancín; DOHC dibuja dos árboles arriba.
  `data-part` en cada subpieza.
- `timingDrive` (centro, 600–960 × 40–700): piñón del cigüeñal con la
  chaveta y un **inset con zoom del chavetero** (el ovalado se ve como una
  ranura más ancha de un lado y el piñón bailando `keywayPlay`), cadena o
  correa (eslabones que avanzan con `crank`; la holgura se dibuja como una
  comba proporcional a `slack`), tensor (émbolo que sale según la holgura),
  guía (partida si `guideBroken`), piñón de leva con una marca de
  sincronización y la marca de referencia fija: **la distancia entre las dos
  marcas es `camOffset`**.
- `pvDiagram` (derecha, 1000–1360 × 60–420): P-V del cilindro visto, ejes
  lineales, punto actual y la traza del último ciclo (el drawer acumula los
  puntos que le llegan; es estado de la vista, no del modelo).
- `compressionBars` (derecha abajo, 1000–1360 × 460–700): cuatro barras con
  la última prueba de compresión y la franja verde 11–15 bar.

Canales (en `present.ts`): `cylinder.{crank, stroke, pressure, volume,
intakeLift, exhaustLift, burn, spark, hit}`, `timing.{crank, cam, offset,
slack, play, knock, rattle, guideBroken, drive}`, `pv.{pressure, volume,
cycle}`, `compression.{c1..c4}`. Los que delatan una falla llevan nombre
propio (`timing.play`, `timing.slack`) para que el juego los pueda ocultar.

## 9. Narración (máx. 3, por severidad)

- `stroke` → info: "Admisión: el pistón baja y aspira mezcla." (una por
  tiempo, sólo con `rpm < 300` o en manual).
- `|camOffset| > 3°` → warn: "La leva va {x}° atrasada respecto del
  cigüeñal: la distribución está fuera de punto."
- `keywayPlay > 2°` → warn: "El piñón tiene juego sobre el cigüeñal: el
  chavetero está ovalado. Se escucha un golpeteo y el punto varía con la
  carga."
- `crankBoltLoose` → warn: "El perno del cigüeñal está flojo: el piñón
  trabaja suelto y gasta el chavetero (acelerado ×1000)."
- `keyShearedState || keySheared` → bad: "La chaveta se cortó: el piñón
  resbala y la leva se queda atrás."
- `slack > 0,3` → warn: "La cadena está floja: golpetea (sobre todo al
  partir, antes de que suba la presión de aceite)."
- `guideBroken` → warn: "La guía de la cadena está rota: quedan trozos de
  plástico en el cárter."
- `valveHit` → bad: "¡Las válvulas chocaron con el pistón en el cilindro
  {n}! Ese cilindro se quedó sin compresión."
- compresión de un cilindro < 9 bar tras la prueba → warn: "El cilindro {n}
  comprime poco: anillos o válvula."
- `burnFraction` subiendo con `spark` false → nunca pasa; con `spark` false
  y motor girando → info: "Sin chispa: se comprime y se expande sin
  combustión; el trabajo neto es casi cero."

## 10. Presets

"Motor sano a 3000 rpm", "Cámara lenta del ciclo" (rpm 120), "Prueba de
compresión: anillos gastados en el 3" (`ringWear3 = 1` + acción),
"Válvula quemada en el 2", "Chavetero ovalado" (la falla que vio el
usuario: `keywayWorn = 0,8`, carga 0,8), "Perno flojo → chaveta cortada"
(`crankBoltLoose`), "Cadena estirada" (`chainStretch = 1`), "Saltó un
diente" (`skippedTeeth = 1`), "Saltaron dos dientes: choque"
(`skippedTeeth = 2`), "Tensor hidráulico sin presión al partir" (dohc,
`oilPressure = 0,2`).

## 11. Tests (`tests/four-stroke/*.test.ts`) — criterios de aceptación

Helper `run(model, s)` con `dt = 0,001`.

1. Geometría: `s(0) = 0`, `s(180) = 86 mm ± 0,01`, `V(0) = 55,5 cm³ ± 0,1`,
   `V(180) = 555,1 cm³ ± 0,3`.
2. Válvulas: admisión abierta en 0° y 200°, cerrada en 240° y 400°; escape
   abierto en 520° y 700°, cerrado en 60°. Alzada máxima 9 mm ± 0,05.
3. Prueba de compresión sana: los 4 cilindros en **[12,5; 14,0] bar**
   manométricos.
4. `ringWear3 = 1` → cilindro 3 < 7,0; los otros siguen en [12,5; 14,0].
   `burntValve2 = 1` → cilindro 2 < 5,0.
5. A fondo, 3000 rpm, avance 25°: trabajo por ciclo de cada cilindro en
   **[520; 650] J**, pico en **[55; 75] bar abs**, `cylinderBalance > 0,97`.
6. Sin chispa a fondo: trabajo por ciclo en **[−30; 10] J**.
7. Avance: el trabajo a 25° supera al de 0° en ≥ 12 % y al de 40° en ≥ 2 %.
8. `skippedTeeth = 1` → sin `valveHit` en 10 s; `skippedTeeth = 2` y
   `−2` → `valveHit` en < 0,1 s y `bentValve` de algún cilindro.
9. `keywayWorn = 1`, carga 1 → `camOffset` promedio en **[6; 9]°**; con
   carga 0 → en [1,5; 3,5]°.
10. `crankBoltLoose`, 3000 rpm, carga 1 → `keyShearedState` antes de 60 s;
    después `camOffset` crece.
11. dohc con `oilPressure = 0,2` → `slack ≥ 0,45` y `rattle > 0`; con
    `oilPressure = 3` y tensor sano → `slack = 0`.
12. Señales: con cadena sana `|camOffset| < 0,01`, `engine.compression` en
    [0,97; 1,0]; con `ringWear1..4 = 1` → < 0,6.
13. Robustez (§6): 300 combinaciones aleatorias con semilla × 2 s → sin
    `NaN`/`Infinity`, presión en [0; 150] bar abs.
14. Determinismo: dos modelos con la misma secuencia → estado idéntico.
15. Subpasos: a 6000 rpm el trabajo por ciclo difiere < 1 % entre subpaso de
    1° y de 0,25° (fija que 1° alcanza).

Si un rango no cuadra, se ajustan las constantes (no los tests) y se
documenta aquí con la cuenta.

## 12. En el vehículo

- **Publica**: `engine.crankAngle`, `engine.camAngle` (same-step),
  `engine.compression`, `engine.cylinderBalance`.
- **Lee**: `engine.rpm`, `engine.load`, `intake.map`, `ignition.advance`,
  `ignition.spark`, `fuel.mixture`, `lubrication.pressure`,
  `exhaust.backpressure` (stub 0 hasta A19).
- En el laboratorio, cada lectura sale del stub del bus de laboratorio con el
  param correspondiente (§3).
- En `vehicle-70` es `four-stroke-ohv`; en `vehicle-2000`, `four-stroke-dohc`
  con cadena. Su región del diagrama del vehículo es un **inset** con
  `cylinderSection` y `timingDrive` a escala 0,5 (el drawer recibe `scale`
  en `part.params`).
