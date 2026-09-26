# Módulo 1 — Sistema de combustible (inyección con retorno) — **especificación completa**

> Extraído de `docs/plans/2026-09-22-plan-maestro.md`. Este archivo es el **vivo**: si cambia la spec, se cambia acá (y se anota en `AHORA.md`).

## 1. Piezas (`partId`)
`battery`, `key`, `relay`, `tank`, `strainer` (colador de la bomba), `pump`, `checkValve`, `feedLine`, `filter`, `rail`, `injector1..injector4`, `injectorWires` (arnés de cables ECU→inyectores), `manifold`, `regulator`, `vacuumHose`, `returnLine`, `ecu` (bloque simple que manda los pulsos a los inyectores).

## 2. Parámetros (`DEFAULT_PARAMS`)
| key | tipo/rango | default | significado |
|---|---|---|---|
| `ignitionKey` | `'off' \| 'on' \| 'start' \| 'run'` | `'off'` | `on` = contacto (cebado 2 s); `start` = arranque; `run` = motor en marcha |
| `rpm` | 0–6500 | 800 | RPM pedidas (si el motor está detenido se ignoran) |
| `throttle` | 0–1 | 0 | acelerador → carga y vacío |
| `batteryV` | 10–14.5 | 12.6 | tensión de batería (con el motor en marcha se suma +1.4 V del alternador) |
| `fastConsumption` | bool | false | multiplica ×100 el consumo del estanque para ver el nivel bajar |

Acciones: `refill()` (estanque a 45 L), `setTank(L)`.

## 3. Fallas (`DEFAULT_FAULTS`, todas "sano" por defecto)
| key | tipo | efecto en el modelo |
|---|---|---|
| `strainerClog` | 0–1 | `kStrainer *= 1 + 2500·s` (a 1.0 estrangula como el filtro a 1.0) |
| `filterClog` | 0–1 | `kFilter *= 1 + 1000·s` |
| `pumpWear` | 0–1 | `Qmax *= 1 − 0.7·s`, `Pmax *= 1 − 0.7·s` (al 80 % ya no sostiene a fondo) |
| `relay` | `'ok' \| 'intermittent' \| 'dead'` | `intermittent`: se corta 1,2 s a intervalos pseudoaleatorios (rng con semilla, en promedio cada 3 s); `dead`: nunca cierra |
| `regulator` | `'ok' \| 'stuckOpen' \| 'stuckClosed'` | `stuckOpen`: setpoint 0.8 bar; `stuckClosed`: sin retorno |
| `vacuumHoseOff` | bool | la referencia del regulador pasa a 0 bar (atmósfera) |
| `injectorLeak` | 0–1 | el inyector 2 gotea `0.6·s·√pRail` L/h continuamente hacia el múltiple |
| `lineLeak` | 0–1 | fuga en la línea de alimentación: `2.0·s·√pRail` L/h (se dibuja goteo) |

## 4. Física (paso `dt`, orden de evaluación)
Constantes: `Qmax0 = 120 L/h` (a 13.5 V, caudal libre), `Pmax0 = 6.5 bar` (cierre total a 13.5 V), `kStrainer0 = 4e-6`, `kLine0 = 3e-6`, `kFilter0 = 1e-5` (bar/(L/h)²), `C = 0.005 L/bar` (compliancia del riel + mangueras), `kReg = 1000 L/h/bar`, `regSet = 3.0 bar`, `injFlow3bar = 12 L/h` por inyector, `tankCapacity = 50 L`, `pickupLow = 1.0 L`.

1. **Estado del motor y del relé**
   - `off`: relé abierto, `engineState='off'`.
   - Transición a `on`: `primeTimer = 2 s`. El relé queda cerrado mientras `primeTimer > 0`.
   - `start`: relé cerrado. Motor girando a 250 rpm. Pasa a `running` si la mezcla es suficiente (`mixtureRatio ≥ 0.6`) durante 0.5 s acumulados.
   - `run`: relé cerrado solo si `engineState` es `running` o `misfire`. Si el motor está `stalled`, el relé se abre (la ECU corta la bomba sin rpm) y el usuario tiene que volver a `start`.
   - `rpmEff = engineState ∈ {running, misfire} ? params.rpm : (cranking ? 250 : 0)`.
   - Aplicar la falla `relay`.
2. **Tensión de la bomba**: `V = batteryV + (running ? 1.4 : 0) − (cranking ? 2.0 : 0)`, y `vf = clamp(V / 13.5, 0, 1.1)`.
3. **Aire en la aspiración**: `pickupAir = 1 − clamp(tankLevel / pickupLow, 0, 1)`. El caudal efectivo se multiplica por `(1 − pickupAir)`.
4. **Caudal de la bomba (cerrado, sin iterar)**, con `K = kStrainer + kLine + kFilter`, `Qm = Qmax·vf`, `Pm = Pmax·vf` y `aire = pickupAir`:
   - Caudal: `qPump = Qm·(1 − (pRail + K·qPump²)/Pm)·(1 − aire)`. Si `aire = 1`, el relé está abierto o `pRail ≥ Pm` → `qPump = 0` (la válvula check impide el retroceso).
   - Forma cerrada: `c = Qm·(1 − pRail/Pm)`, `a = Qm·K/Pm`, `A = a·(1 − aire)`, `qPump = (−1 + √(1 + 4·A·c·(1 − aire))) / (2A)`. El aire entra en la ecuación, como en el elemento del solver.
   - `pPumpOut = pRail + (kLine + kFilter)·qPump²` es la boca de salida de la bomba, **sin** la caída del colador (que está en la aspiración); `dpFilter = kFilter·qPump²`.
   - `pumpCurrent = relé ? (1.5 + 5.5·(pRail + K·qPump²)/Pm)·vf : 0` (A): la corriente usa el Δp completo, colador incluido.
5. **Vacío del múltiple**: `pMan = motorGirando ? −0.65 + 0.65·throttle : 0` (bar relativos; ralentí ≈ −0.65, a fondo ≈ 0). `pRef = vacuumHoseOff ? 0 : pMan`.
6. **Regulador**: `set = regulator==='stuckOpen' ? 0.8 : regSet`. `qReturn = regulator==='stuckClosed' ? 0 : kReg·max(0, pRail − (pRef + set))`. `regOpen = clamp(qReturn / 100, 0, 1)` (para la animación del diafragma).
7. **Inyectores** (secuenciales, orden de encendido 1-3-4-2, desfase 0/180/360/540°):
   - `crankAngle += rpmEff/60·360·dt` (mod 720).
   - Ancho de pulso pedido: `pw = 1.8 ms + 10.5 ms·throttle` (+3 ms enriquecimiento si está en arranque).
   - `pwDeg = pw·rpmEff/60·360/1000`. El inyector `i` está abierto si `(crankAngle − offset_i) mod 720 < pwDeg`.
   - `Kinj = injFlow3bar / √3`. El caudal instantáneo de un inyector abierto es `Kinj·√max(0, pRail − pMan)`.
   - `qInjTotal` = suma de los inyectores abiertos (instantáneo). `qInjAvg` = media exponencial con τ = 0.2 s (para mostrar).
   - `mixtureRatio = qInjAvg / qInjExpected`, donde `qInjExpected` es el mismo cálculo con `pRail − pMan = 3.0` (presión correcta).
8. **Estado del motor según la mezcla** (solo si está en marcha): `ratio < 0.4` durante 0.3 s → `stalled`. `ratio < 0.8` → `misfire` (era 0.75, ver §9b). `ratio > 1.35` → `misfire` (mezcla rica). En otro caso → `running`.
9. **Fugas**: `qLeakInj` y `qLeakLine` según las fallas (0 si `pRail ≤ 0`).
10. **Riel**: `pRail += (qPump − qInjTotal − qReturn − qLeakInj − qLeakLine) / 3600 / C · dt` y `pRail = max(0, pRail)`.
11. **Estanque**: `tankLevel −= (qInjTotal + qLeakInj + qLeakLine)/3600·dt·(fastConsumption ? 100 : 1)`. El retorno vuelve al estanque, así que no cuenta. `tankLevel = max(0, …)`.

Estabilidad: con `C = 0.005` y `kReg = 1000`, τ = C/kReg ≈ 18 ms. Con `dt = 1 ms` Euler explícito es estable (dt ≪ 2τ). El test 6.9 lo verifica.

Comprobación a mano de las constantes (para que el agente de T3 parta con números coherentes):
- Ralentí: la bomba entrega ~75 L/h y los inyectores piden ~0.6 L/h. El retorno es ~74 L/h y el regulador sobrepasa el setpoint en 74/1000 ≈ 0.07 bar → `pRail − pMan ≈ 3.07`.
- A fondo a 6000 rpm: duty ≈ 0.62, así que se inyectan ≈ 29.5 L/h. La bomba entrega ~68 L/h → retorno ≈ 38 L/h.
- Filtro tapado 1.0 a fondo: kFilter = 1e-2 → equilibrio con `pRail ≈ 1.66 bar`, mezcla ≈ 0.71 → misfire. En ralentí la bomba todavía entrega ~18 L/h, suficiente.
- Colador tapado 1.0: con `strainerClogFactor = 2500` su resistencia a 1.0 es `kStrainer ≈ 1e-2`, igual que el filtro a 1.0: a fondo `pRail ≈ 1.66`, mezcla ≈ 0.71 → misfire; en ralentí entrega ~18 L/h y anda.
- `pumpWear=1` + 11 V: Pmax = 6.5·0.3·0.919 ≈ 1.8 bar → `pRail ≈ 0.93`, mezcla ≈ 0.56 → misfire.
- `pumpWear=0.8` a fondo: Pm ≈ 2.0 bar → `pRail ≈ 1.77`, mezcla ≈ 0.77 → misfire; en ralentí sostiene (2.36 bar).
- Inyector goteando 1.0 con el motor apagado: √p baja 0.0167/s → de 3 a 1 bar en ~44 s.

## 5. Estado (`state`), con unidades
`engineState` ('off'|'cranking'|'running'|'misfire'|'stalled'), `relayOn` (bool), `primeTimer` (s), `pumpV` (V), `pumpCurrent` (A), `qPump` (L/h), `pPumpOut` (bar), `dpFilter` (bar), `pRail` (bar), `pMan` (bar), `pRef` (bar), `regOpen` (0–1), `qReturn` (L/h), `qInjTotal` (L/h), `qInjAvg` (L/h), `mixtureRatio` (–), `injectors` ([{open: bool}] ×4), `qLeakInj` (L/h), `qLeakLine` (L/h), `tankLevel` (L), `pickupAir` (0–1), `crankAngle` (°), `rpmEff` (rpm).

## 6. Lecturas
Presión de riel (manómetro 0–8, verde 2.3–3.8 relativo al vacío; mostrar también `pRail − pMan`), caudal de la bomba, caudal inyectado (promedio), caudal de retorno, caída en el filtro, corriente de la bomba, nivel del estanque (L y %), vacío del múltiple, mezcla (% de la esperada). Todas con `history: true` menos el nivel.

## 7. Vista (viewBox 1200×700, coordenadas aproximadas)

Desde A7 el renderer es genérico (`src/render/svg/`): este apartado describe lo
que dibuja y anima. Las coordenadas, los tipos visuales y las rutas de cada
conexión viven en `fuel/circuit.ts` (`visual`, `route` y
`visual.owner/pipeClass/flowClass/scale/opacity`); los canales que animan los
drawers (`pump.flow`, `filter.dirt`, `regulator.open`, `rail.pressure`, …) en
`fuel/present.ts`. Las piezas sólo visuales (`ecu`, `checkValve`,
`injectorWires`, `returnLine`) usan el elemento no-op `visual` del registro del
módulo (`FUEL_TYPES`).

- **Bloque eléctrico** arriba a la izquierda (40–300, 30–150): batería → llave → relé (contacto animado) → cable a la bomba. Cuando hay corriente, partículas `p-electric`.
- **Estanque** abajo a la izquierda (60–380, 400–660). Rectángulo con el líquido (alto ∝ `tankLevel/50`) y una ondulación suave. **Bomba** vertical dentro (rotor que gira con velocidad ∝ `qPump`), **colador** en la base y **válvula check** en la salida.
- **Línea de alimentación**: sube desde la bomba hasta el **filtro** (560, 200; cilindro con una flecha de sentido) y sigue al **riel** (700–1100, 110–150).
- **Inyectores**: 4 cuerpos en x = 760, 860, 960, 1060, colgando del riel hacia el **múltiple de admisión** (680–1120, 250–340). Cuando `open`: aguja levantada y cono de spray (triángulo con opacidad que se desvanece).
- **Regulador** en el extremo del riel (1140, 130): cuerpo con diafragma y resorte (el resorte se comprime según `regOpen`). **Manguera de vacío** punteada `--vacuum` hacia el múltiple. Si `vacuumHoseOff`, la manguera se dibuja suelta.
- **Línea de retorno**: baja por la derecha y vuelve al estanque por arriba (entra al líquido).
- **Codificación visual**:
  - La velocidad de las partículas ∝ caudal (escala 4.6).
  - El color interior de cada tubería se interpola por presión (tenue a 0 bar, saturado a 4 bar).
  - Con `pickupAir > 0`, una fracción de las partículas pasa a `p-air`.
  - Las fugas se dibujan como gotas que caen.
  - El manómetro va montado sobre el riel.
  - `engineState` se muestra como una etiqueta de color en el múltiple.
- **Partículas por tramo**: aspiración→bomba (qPump), bomba→filtro (qPump − qLeakLine después del punto de fuga), filtro→riel (qPump − qLeakLine), riel (∝ qPump − qReturn/2, solo visual), retorno (qReturn).

## 8. Narración (reglas; mostrar como máximo 3, por severidad)
- Relé cerrado en cebado → info: "Contacto: la ECU activa la bomba 2 s para presurizar el riel."
- `pRail − pRef` entre 2.7 y 3.3 con el motor en marcha → info: "Presión estable: el regulador devuelve el sobrante al estanque."
- `dpFilter > 0.5` → warn: "El filtro está restringiendo: pierde {dp} bar. Se nota más al acelerar."
- `pickupAir > 0` → bad: "La bomba aspira aire: el estanque está casi vacío."
- `vacuumHoseOff` en ralentí → warn: "Sin referencia de vacío, la presión en ralentí sube ~0.6 bar (mezcla rica)."
- `regulator==='stuckClosed'` → bad: "Sin retorno: la presión sube hasta el límite de la bomba."
- `engineState==='stalled'` → bad: "El motor se detuvo por falta de combustible."
- Motor apagado y la presión cae rápido → warn: "La presión residual no se mantiene: hay una fuga (inyector o línea)."
- `mixtureRatio > 1.35` → warn: "Mezcla rica: entra más combustible del que la ECU calculó."

## 9. Tests de física (`tests/fuel/model.test.ts`) — criterios de aceptación
Helper: `run(model, seconds)` avanza con `dt = 0.001`.
1. Cebado: `ignitionKey='on'` → a los 1.5 s `pRail ∈ [2.8, 3.3]`. A los 4 s el relé está abierto y la presión se mantiene > 2.5 (presión residual).
2. Ralentí sano (`run`, 800 rpm, throttle 0): `pRail − pMan ∈ [2.95, 3.15]` y `pRail ∈ [2.3, 2.5]`.
3. A fondo (throttle 1, 6000 rpm): `pRail ∈ [2.8, 3.2]`, `qReturn > 0`, `engineState==='running'`.
4. Filtro tapado 1.0 a fondo (6000 rpm): `pRail < 2.0` y `engineState` ∈ {misfire, stalled}. En ralentí sigue `running`.
5. `vacuumHoseOff` en ralentí: `pRail` sube ≥ 0.55 bar respecto al caso 2.
6. `regulator='stuckClosed'`: `pRail > 4.5` y `qReturn === 0`.
7. `pumpWear=1` con batería 11 V a fondo → `engineState !== 'running'`.
8. Motor apagado tras el cebado con `injectorLeak=1` → la presión baja a < 1 bar en ≤ 60 s. Sin fuga se mantiene > 2.5 durante 60 s.
9. `tankLevel=0.2` → `pickupAir > 0.7` y `qPump` baja proporcionalmente.
10. Robustez: 1000 combinaciones aleatorias (rng con semilla) de params y faults × 2 s → nunca `NaN`/`Infinity` y `pRail` entre −0,65 (la referencia clampa en 0; el solver llega hasta la presión del múltiple, §9d) y 7.5.
11. Determinismo: dos modelos con la misma secuencia dan estados idénticos.

Si algún rango no cuadra con las constantes, el agente **ajusta las constantes** (no los tests) y documenta el cambio en `docs/modules/fuel.md`.

## 9b. Decisiones de implementación (T3) y valores medidos

- Pasar la llave directo a `run` con el motor en `off` equivale a pasar por
  `start`: el motor entra en `cranking` (así la UI no obliga a pasar por
  "Arranque").
- Con el motor en marcha, `rpm` se limita a ≥ 600 (ralentí mínimo).
- Offsets de inyección por inyector (1..4) = `[0, 540, 180, 360]`°, que da el
  orden 1-3-4-2.
- `mixtureRatio` = promedio real / promedio esperado, los dos filtrados con
  τ = 0.2 s sobre el **mismo** patrón de pulsos. Así el ratio sólo refleja la
  presión (≈ √(Δp/3)) y no el ruido de los pulsos a bajas rpm.
- El relé intermitente usa el rng con semilla (`overrides.seed`, 12345 por
  defecto): corte de 1,2 s con probabilidad `dt/3` por paso. El corte de 0.3 s
  de A6 no se notaba a fondo (§9d).

Medido con `startEngine` → 3 s → promedio de 1 s (`dt = 1 ms`):

| Caso | pRail | pRail−pMan | qPump | qInj | qReturn | mezcla | estado |
|---|---|---|---|---|---|---|---|
| Ralentí sano | 2.43 | 3.08 | 77.7 | 0.6 | 77.1 | 1.01 | running |
| A fondo 6000 rpm | 3.04 | 3.04 | 67.0 | 29.0 | 38.0 | 1.01 | running |
| Filtro 1.0, ralentí | 2.37 | 3.02 | 18.4 | 0.6 | 17.7 | 1.00 | running |
| Filtro 1.0, a fondo | 1.66 | 1.60 | 20.2 | 20.6 | 0 | 0.71 | misfire |
| Filtro 0.8, a fondo | 1.85 | 1.80 | 21.7 | 22.1 | 0 | 0.76 | misfire |
| Colador 1.0, ralentí | 2.37 | 3.02 | 18.4 | 0.6 | 17.7 | 1.00 | running |
| Colador 1.0, a fondo | 1.66 | 1.60 | 20.2 | 20.6 | 0 | 0.71 | misfire |
| Colador 0.8, a fondo | 1.85 | 1.80 | 21.7 | 22.1 | 0 | 0.76 | misfire |
| Colador 0.5, a fondo | 2.28 | 2.27 | 25.0 | 25.0 | 0 | 0.87 | running |
| Bomba 0.5, a fondo | 2.84 | 2.85 | 28.1 | 28.1 | 0 | 0.97 | running |
| Bomba 0.8, a fondo | 1.77 | 1.76 | 22.1 | 22.1 | 0 | 0.77 | misfire |
| Bomba 0.8, ralentí | 2.36 | 3.01 | 11.1 | 0.6 | 10.5 | 1.00 | running |
| Bomba 1.0 + 11 V, a fondo | 0.93 | 0.92 | 16.0 | 16.0 | 0 | 0.55 | misfire |
| Manguera de vacío suelta | 3.07 | 3.72 | 66.5 | 0.7 | 65.7 | 1.11 | running |
| Regulador pegado cerrado | 6.68 | 7.34 | 1.0 | 1.0 | 0 | 1.56 | misfire (rica) |
| Regulador pegado abierto | 0.24 | 0.89 | 87.4 | 0.3 | 87.2 | 0.54 | cranking: gira y no parte |

**Umbral de mezcla pobre 0.75 → 0.8.** Con el filtro tapado, la presión a
fondo cae con una constante de tiempo de ~2 s (la pendiente neta de la curva
bomba − inyectores es chica frente a la compliancia `C`). Con 0.75 el filtro
al 90 % dejaba la mezcla en 0.776 y el motor nunca fallaba. 0.8 equivale a
λ ≈ 1.25, cerca del límite real de falla por mezcla pobre. La tabla se
re-midió en A6b con el umbral 0,8 y las constantes de §9d (filtro 0,8 a
fondo → misfire; A6 había medido esa fila con 0.75).

Consecuencia para los presets (§10): con filtro 0.8 el motor queda justo en el
límite y no tironea. El preset "Tironea al acelerar en subida" usa **0.9**.

## 10. Presets
"Arranque normal", "Tironea al acelerar en subida" (filtro 0.9), "Ralentí rico" (manguera suelta), "Cuesta partir en la mañana" (inyector goteando + pierde la presión residual), "Me quedé sin bencina" (estanque 0.5 L + consumo acelerado).

## 9c. A6 — el compilado sobre el solver: paridad y divergencias

Desde A6 el descriptor usa `createCompiledFuelModel()` (`src/modules/fuel/circuit.ts`),
compilado con `compileCircuit` (CONTRATOS 4.10). El modelo a mano queda como
**referencia** (`reference-model.ts`) y la suite de §9 corre contra los dos
(`describe.each`), más `tests/fuel/parity.test.ts` (13 escenarios de la tabla
de §9b: `pRail` ≤ 0,05 bar y caudales ≤ 3 % + 0,01 L/h en régimen,
`failures === 0`).

Circuito (`fuel-return`): batería con `r = 0,001 Ω` → llave → relé → bomba
(eléctrico), y estanque (nodo fijo) → colador → bomba → línea → filtro → riel
(compliancia 0,005) → 4 inyectores → múltiple (`pressureSource` con el vacío).
El colador va en la aspiración (P25 §3.3). El regulador devuelve al estanque y
su referencia es un `pressureSource` que la ECU pone en `pMan` o en 0 según la
manguera (`vacuumHose`). Sin `checkValve`: la bomba ya bloquea el retroceso y
su transición de 0,02 bar rompería la paridad.

**Puente eléctrico**: llave y relé quedan **siempre cerrados** en el circuito;
el corte lo hace `battery.control.v = relayOn ? v : 0` (alternador), que es
exactamente `pumpV = relayOn ? v : 0` de la referencia. Así el solver no ve un
escalón de conductancia de 1e7 (que lo dejaba sin converger).

**Divergencias medidas** (A6; estado final en §9d):
- **Aire de la bomba**: resuelto en A6b. Las dos implementaciones resuelven
  `q = Qm(1−Δp/Pm)(1−aire)` dentro del balance. Con `tankLevel = 0,2`:
  `qPump` relativo **0,2065 (referencia) vs 0,2067 (compilado)**, 2,6 % sobre
  `1−aire` porque el aire también reduce la caída resistiva.
- **Riel sin `max(0,·)`**: justificado en A6b. La referencia clampa
  `pRail ≥ 0`; el solver no, y con el múltiple en vacío el riel baja hasta
  `pMan` (fuzz de A6b: mínimo medido −0,04; cota usada −0,7 en el fuzz del
  compilado), que es donde el goteo hacia el múltiple deja de fluir. Sin
  venteo ni fuga el riel sellado no debería llegar ahí: la simplificación es
  la referencia.
- **`pPumpOut`**: alineado en A6b. La referencia ahora define `pPumpOut` como
  la boca de salida de la bomba (`pRail + (kLine + kFilter)·q²`), sin la caída
  del colador de la aspiración, y usa el Δp completo para la corriente. Antes
  difería en `kStrainer·q²` (0,02 bar con el colador sano, 1,3 bar al máximo).
- Guarda de la bomba en `V ≤ 0` (no `V < 0,5`): la rama normal ya es suave y
  segura por εP, y así no hay escalón de corriente al conmutar.
- El fuzz del compilado es reducido (200 × 1000 pasos); el tiempo medido se
  anota en `solver.md`. La relajación por nodo del solver (que destrabó los
  transitorios) está en `solver.md` §4.

## 9d. A6b — síntomas calibrados

Tres fallas no daban su síntoma con las constantes de A6 (ARCHITECTURE §14):
`strainer.clog` no hacía nada, `relay.state = 'intermittent'` no se notaba y
`pump.wear` sólo fallaba al 100 %. Se calibraron las constantes de
`reference-model.ts` (`K`), compartidas por las dos implementaciones, así que
la paridad se mantiene. Tests nuevos: `tests/fuel/symptoms.test.ts` (uno por
falla, escenario contacto → arranque → ralentí → fondo) y tres escenarios más
en `parity.test.ts`.

| Falla | Constante | Antes | Ahora | Síntoma a fondo (medido) |
|---|---|---|---|---|
| `strainer.clog = 1` | `strainerClogFactor` | 150 | **2500** (`kStrainer ≈ 1e-2`) | pRail 1,66 · mezcla 0,71 · misfire; en ralentí running (2,37) |
| `relay.state = 'intermittent'` | `relayCutTime` / `relayCutMeanInterval` | 0,3 s / 2 s | **1,2 s / 3 s** | 5 cortes en 15 s: pRail mín 1,40 · mezcla mín 0,73 y sale de running; en ralentí no se nota |
| `pump.wear = 0,8` | `wearP` | 0,5 | **0,7** | pRail 1,77 · mezcla 0,77 · misfire; al 50 % sigue running (2,84 · 0,97) |

- El colador a 1.0 queda con la misma resistencia que el filtro a 1.0 (los dos
  `k ≈ 1e-2`): está en la boca de la aspiración, y su síntoma es el mismo ahogo
  a fondo, no a ralentí.
- El corte del relé de 0,3 s sólo bajaba `pRail` a 2,42 a fondo (mezcla 0,89):
  con 1,2 s la presión llega a ~1,4 y el motor tironea. En ralentí tarda decenas
  de segundos en notarse (los inyectores piden 0,6 L/h y `C = 0,005 L/bar`);
  es físico, y en el laboratorio se ve en el relé, las partículas de la bomba
  y la narración.
- `pump.wear = 0,8` a fondo ya no sostiene: la bomba gastada pierde presión de
  cierre (`Pm ≈ 2,0 bar`) antes que caudal. En ralentí sí sostiene.
- Las dos divergencias de §9c quedaron cerradas: el aire se resuelve igual en
  las dos implementaciones (0,2065 vs 0,2067), `pPumpOut` quedó alineado y el
  riel sin clamp se justifica (llega hasta `pMan`, no más abajo).


