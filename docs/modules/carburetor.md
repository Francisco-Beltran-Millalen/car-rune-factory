# Módulo — Carburador (`carburetor`) — **especificación completa**

> Spec viva, escrita por el agente planificador el 2026-09-26 (plan
> `plans/2026-09-26-carburetor.md`). Los números de §5.5 salen de una
> simulación de referencia; si un rango no cuadra, se ajustan las
> constantes aquí con la cuenta (§14).

## 1. Arquetipo y variantes

**Sistema hermano** de `fuel` (la inyección): física distinta (la bencina
la aspira la depresión del venturi, no la empuja la presión de un riel) y
publica la **misma** señal `fuel.mixture` (§28), así `engineCore` y el resto
del auto no saben cuál está montado.

Un solo descriptor, `carburetor` ("Carburador años 70"): un cuerpo
(monocuerpo) con cuba y flotador, circuitos de ralentí y principal, bomba
de aceleración, estrangulador (choke) manual, y bomba de bencina mecánica
movida por el árbol de levas.

Quedan registradas (no se implementan): doble cuerpo progresivo (un segundo
venturi que abre a fondo), choke automático (bimetálico), y el monopunto
TBI (~1985–95), que es de la familia de `fuel` (un inyector sobre la
mariposa) y no de ésta.

**Por qué la mezcla se calcula como proporción.** El aire (kg/h) viene de
afuera del sistema (`air.massFlow`); el carburador no lo mueve, lo mide con
el venturi. La red del solver es sólo la de la bencina (estanque → bomba →
filtro → aguja → cuba → surtidores). Lo que sale por los surtidores lo
decide un controlador con la física del venturi (§5.2) y se lo pide a la
cuba con un elemento de caudal impuesto.

## 2. Piezas (`partId`)

`tank`, `fuelLine`, `mechPump` (bomba mecánica de diafragma), `pumpCam`
(excéntrica), `fuelFilter`, `needleValve`, `float`, `floatBowl`, `mainJet`,
`idleJet`, `idleScrew` (tornillo de mezcla), `venturi`, `throttlePlate`,
`choke`, `accelPump`, `airHorn` (boca, donde va el filtro de aire).

## 3. Parámetros

| key | rango | default | significado |
|---|---|---|---|
| `rpm` | 0–6500 | 800 | stub de `engine.rpm` (0 = motor detenido: la bomba mecánica no bombea) |
| `throttle` | 0–1 | 0 | mariposa (param del vehículo) |
| `engineTempC` | −10–110 | 90 | stub de `engine.coolantTemp` (vaporización) |
| `choke` | 0–1 | 0 | estrangulador tirado (manual) |
| `idleScrew` | 0,5–1,5 | 1 | tornillo de mezcla del ralentí |

Acciones: `refill()` (estanque a 40 L), `primeBowl()` (llena la cuba, como
bombear a mano la palanca de la bomba).

## 4. Fallas (ids §26)

| id §26 | clave | tipo | efecto |
|---|---|---|---|
| `idleJet.clog` | `idleJetClog` | 0–1 | circuito de ralentí ×`(1 − s)` |
| `mainJet.clog` | `mainJetClog` | 0–1 | circuito principal ×`(1 − 0,9·s)` |
| `float.punctured` | `floatPunctured` | toggle | el flotador se hunde: la aguja no cierra → la cuba rebalsa → **se ahoga** |
| `needleValve.stuck` | `needleStuck` | toggle | aguja pegada cerrada: la cuba se vacía → se para a fondo en segundos |
| `choke.stuck` | `chokeStuck` | `'ok' \| 'closed' \| 'open'` | `closed`: choke = 1 siempre (rico en caliente); `open`: choke = 0 (no parte en frío) |
| `accelPump.failed` | `accelPumpFailed` | toggle | diafragma roto: **tironeo** al pisar de golpe |
| `mechPump.wear` | `pumpWear` | 0–1 | caudal ×`(1 − 0,8·s)`: se queda sin bencina en subidas largas a fondo |
| `mechPump.diaphragm` | `pumpDiaphragm` | toggle | diafragma roto: caudal ×0,5 y fuga de bencina (al cárter en el auto real: pista en el aceite) |
| `fuelFilter.clog` | `filterClog` | 0–1 | `k·(1 + 2000·s)` |

## 5. Física

### 5.1. Aire (entrada)

`ṁa` (kg/h) = `air.massFlow`. Stub del laboratorio (§29; es el mismo de
`src/sim/signals/stubs.ts`):

`ṁa = 1,2e-3·2,0·rpm/120·(0,8 + 0,05·throttle)·((1,013 + map)/1,013)·3600`,
con `map = −0,65 + 0,65·throttle`. Ralentí (800 rpm) = 16,5 kg/h; a fondo a
6000 rpm = 366 kg/h.

### 5.2. Venturi y circuitos (controlador `carbCore`)

- Depresión del venturi: `Δpv = kv·ṁa²`, `kv = 4,45e-7 bar/(kg/h)²`
  (0,06 bar a 367 kg/h).
- Altura de la bencina bajo el surtidor: `h = 0,0006 bar·(1 − (nivel −
  0,060)/0,020)` (una cuba más llena "acerca" la bencina a la boca).
- **Fracción del principal** `φ = √⁺(1 − h/Δpv)` (0 si `Δpv ≤ h`): el
  principal empieza a entregar con ~37 kg/h de aire y domina (`φ = 0,8`)
  desde ~61 kg/h.
- Proporción de régimen (1 = la mezcla que el carburador está calibrado a
  entregar, ~13:1):
  `r = φ·(1 − 0,9·mainJetClog) + (1 − φ)·idleScrew·(1 − idleJetClog)`.
  Sano: `r = 1` en todo el rango (por construcción); las fallas y el
  tornillo la sacan de 1 **sólo en su zona** (ralentí o carga).
- Cuba alta: `r·(1 + 25·max(0, nivel − 0,062))`; cuba llena (rebalse,
  `nivel ≥ 0,099`): `+1,0` (la bencina cae directo al múltiple).
- Choke: `r·(1 + choke_ef)`, `choke_ef` = `choke` o lo que fije la falla.
- Vaporización: `r·vap(T)`, `vap = 0,45 + 0,55·clamp((T − 10)/70, 0, 1)`
  (a 20 °C 0,53: frío y sin choke **no parte**, porque `engineCore` pide
  0,6 para arrancar).

### 5.3. Transitorio y bomba de aceleración

- La bencina que realmente llega sigue a la pedida con retraso:
  `q_real += (q_pedida − q_real)·dt/0,25 s`, con `q_pedida = r·ṁa/13`
  (kg/h). La mezcla es `q_real/(ṁa/13) + b`. **Guarda (§6)**: con
  `ṁa < 0,5 kg/h` (motor detenido) la mezcla publicada es 0 y no se divide.
- Bomba de aceleración: `b += 0,8·max(0, dThrottle/dt)·dt` y `b` decae con
  τ = 0,4 s. Con `accelPumpFailed`, `b = 0`.
- Referencia: pisar de 0,1 a 1 en 0,1 s → sana, mínimo 0,92 y máximo 1,17;
  sin bomba, mínimo 0,51 (tironeo: `misfire`, no se para porque dura poco);
  abriendo en 1 s sin bomba, mínimo 0,82 (pisando suave no se nota).

### 5.4. Red de la bencina (solver, fluido `fuel`, L/h y bar)

| pieza | elemento | valores |
|---|---|---|
| estanque | `tank` | 50 L, `pickupLow = 1` |
| bomba mecánica | `displacementPump` (de A14) | `disp = 5e-4 L/rev`, `n = rpm/2` (la mueve la leva), `pMax = 0,3 bar`, `wearQ = 0,8` → 90 L/h a 6000 rpm (la demanda a fondo es 38 L/h); `wear` |
| fuga del diafragma | `leak` | `k = 10` con la falla |
| filtro | `restrictor` | `k = 2e-5`, `clogFactor = 2000` |
| aguja | `variableOrifice` (de A13) | `gOpen = 164 L/h/√bar` (90 L/h a 0,3 bar), `gLeak = 0`; `open = clamp((0,060 − nivel)/0,008, 0, 1)` (1 con `floatPunctured`, 0 con `needleStuck`) |
| cuba | `tank` | `capacity = 0,1 L`, nivel inicial 0,06 L |
| surtidores | **nuevo** `flowSource` (a → b) | caudal impuesto `control.q` (L/h) desde la cuba a un `pressureSource` (el múltiple, 0 bar); `q = q_real/0,74·disponible` |

`disponible = clamp(nivel/0,01, 0, 1)`: con la cuba casi vacía los
surtidores no entregan lo pedido y la mezcla cae sola. La proporción
publicada usa lo realmente entregado.

### 5.5. Referencia (planificador)

| caso | resultado |
|---|---|
| sano, cualquier rpm/mariposa en régimen | mezcla 1,00 |
| 20 °C sin choke | 0,53 (no parte) · con choke 1 → 1,06 |
| 90 °C con choke 1 | 2,0 (rica, humo negro) |
| `idleJetClog = 1` | ralentí 0 (se para) · 2500 rpm / 0,2 → 0,86 · crucero bien |
| `mainJetClog = 0,6` | a fondo 6000 → 0,46 · ralentí 1,0 |
| `needleStuck` a fondo 6000 (38 L/h) | la cuba (0,06 L) dura ~6 s |
| `floatPunctured` en ralentí | entran ~12 L/h y salen 1,7: la cuba se llena en ~14 s, mezcla > 1,9 y rebalsa |
| `pumpWear = 0,8` | la bomba da 36 %: a fondo a 4000 rpm entran ~21 L/h y se piden 25 → la cuba se vacía en ~50 s; en crucero (3000 / 0,3, pide 10 L/h) se sostiene |

## 6. Estado

`airMass` (kg/h), `venturiDp` (mbar), `mainFraction` (φ), `mixtureTarget`,
`mixture` (0..3, señal), `fuelDelivered` (L/h), `accelBoost`, `bowlLevel`
(L), `needleOpen` (0..1), `qPump` (L/h), `pPump` (bar), `tankLevel` (L),
`flooding` (bool), `vaporization` (0..1), `chokeEff` (0..1).

## 7. Lecturas

Mezcla (% de la calibrada, verde 85–125, `history`), aire (kg/h),
depresión del venturi (mbar), fracción del principal (%), bencina entregada
(L/h), nivel de la cuba (mL, verde 50–65), apertura de la aguja (%),
caudal y presión de la bomba mecánica, nivel del estanque.

## 8. Vista (viewBox 1200×720)

Corte del carburador al centro: boca con el choke (chapaleta que gira con
`chokeEff`), venturi (estrechamiento) con el surtidor principal que pulveriza
(spray ∝ `mainFraction·fuelDelivered`), mariposa abajo (gira con
`throttle`), orificio de ralentí bajo la mariposa (spray ∝ `1 − φ`),
tornillo de mezcla, cuba al costado con el flotador que sube y baja con el
nivel y la aguja en la entrada, bomba de aceleración con su chorro. Abajo a
la izquierda el estanque y la bomba mecánica con la excéntrica que gira
(rpm/2) y el diafragma que late. Flechas de aire `p-air` entrando por la
boca (velocidad ∝ `airMass`), bencina `p-fuel`, mezcla `p-mixture` saliendo
hacia el múltiple. Drawers nuevos en `src/render/svg/drawers/carburetor/`:
`carbBody`, `floatBowl`, `mechPump`, `choke`. Canales que delatan falla:
`floatBowl.level` (una cuba rebalsando), `carbBody.idleSpray`.

## 9. Narración

- ralentí → info: "En ralentí la mariposa está casi cerrada: la bencina sale
  por el orificio de ralentí, debajo de ella, aspirada por el vacío del
  múltiple."
- `mainFraction > 0,8` → info: "Con más aire el venturi hace depresión y
  aspira la bencina por el surtidor principal."
- frío sin choke → warn: "Con el motor frío la bencina no se evapora bien:
  la mezcla queda pobre. Tira el choke."
- caliente con choke → warn: "Choke tirado con el motor caliente: mezcla
  muy rica (humo negro)."
- `flooding` → bad: "La cuba rebalsa: la bencina cae al múltiple y el motor
  se ahoga."
- `bowlLevel < 0,02` → bad: "La cuba se está vaciando: no alcanza a entrar
  bencina."
- mínimo de mezcla < 0,7 tras un pisotón → warn: "Tironeo al pisar: falta
  el chorro de la bomba de aceleración."
- `pumpDiaphragm` → warn: "El diafragma de la bomba mecánica está roto:
  bombea la mitad y pierde bencina (en el auto va al cárter: el aceite huele
  a bencina)."

## 10. Presets

"Ralentí caliente", "Partida en frío con choke", "Se olvidó el choke",
"Se para en ralentí pero anda en carretera" (surtidor de ralentí tapado),
"Le falta fuerza a fondo" (principal tapado 0,5), "Tironea al pisar"
(bomba de aceleración), "Se ahoga" (flotador pinchado), "Se para en la
subida" (bomba mecánica gastada 0,8, a fondo 4000).

## 11. Tests (`tests/carburetor/*.test.ts`)

1. `flowSource`: ley y jacobiano (cero) en `tests/sim/elements.test.ts`.
2. Sano, grilla rpm {800, 1500, 3000, 6000} × mariposa {0; 0,3; 1} en
   régimen: mezcla en **[0,97; 1,03]**; `failures === 0`.
3. Umbral del principal: `mainFraction = 0` con ṁa < 36 kg/h y > 0,78 con
   ṁa = 61 kg/h.
4. Frío (20 °C): sin choke mezcla en [0,5; 0,58]; con choke 1 en [1,0; 1,12].
   Caliente con choke 1: > 1,9.
5. `idleJetClog = 1`: ralentí < 0,1; 3000 rpm / 0,3 > 0,85.
6. `mainJetClog = 0,6`: a fondo 6000 < 0,55; ralentí > 0,95.
7. Pisotón 0,1 → 1 en 0,1 s a 2500 rpm: sano mínimo ≥ 0,85 y máximo ≤ 1,3;
   con `accelPumpFailed` mínimo ≤ 0,65 y vuelve a > 0,9 en < 1,2 s.
8. `needleStuck` a fondo 6000: `bowlLevel < 0,01` en [4; 9] s y la mezcla
   cae bajo 0,4.
9. `floatPunctured` en ralentí: `flooding` en < 20 s y mezcla > 1,9.
10. `pumpWear = 0,8`: a fondo a 4000 rpm la cuba baja de 0,01 L en < 90 s;
    en crucero 3000 / 0,3 se sostiene sobre 0,04 L durante 120 s.
11. Motor detenido (`rpm = 0`): la bomba no bombea; `primeBowl()` llena la
    cuba.
12. Robustez y determinismo.

## 12. En el vehículo

- **Publica**: `fuel.mixture` (dueño en `vehicle-70`).
- **Lee**: `air.massFlow`, `intake.map`, `engine.rpm` (bomba mecánica y
  stub), `engine.coolantTemp` (vaporización). `throttle` y `choke` son
  params del vehículo.
- No usa el bus eléctrico (no tiene nada eléctrico).
- La fuga del diafragma de la bomba mecánica queda registrada como cruce
  bencina → aceite (elemento `breach` de A15) si se quiere la pista en el
  aceite; A16 sólo la dibuja como fuga.
