# Módulo — Admisión (`intake`) — **especificación completa**

> Spec viva, escrita por el agente planificador el 2026-09-26 (plan
> `plans/2026-09-26-intake.md`). Tarea A18, bloque S2 (después de A15).
> Números de §5.6 de la cuenta del planificador (flujo compresible ideal).

## 1. Arquetipo y variantes

El camino del aire: filtro → (medidor) → mariposa → múltiple → cilindros,
con las entradas que llegan al múltiple por mangueras de vacío. Es la dueña
de `intake.map`, `air.massFlow` y `air.ratio`, que hasta acá calculaba
`engineCore` como provisionales (plan del vehículo §4.8).

| Pieza | Antigua | Moderna | Se implementa |
|---|---|---|---|
| Medición del aire | el venturi del carburador | caudalímetro (MAF) de hilo caliente | los dos |
| Ralentí | tornillo tope de la mariposa | válvula de aire de ralentí (IAC) de la ECU | los dos (IAC con apertura fija: sin rpm dinámicas no hay lazo; A21 lo cierra) |
| Filtro | redondo sobre el carburador | caja con panel | los dos (sólo cambia el dibujo) |
| Ventilación del cárter | tubo al aire | válvula PCV al múltiple | la PCV en los dos |

Descriptores: `intake-carb` ("Admisión años 70", la mariposa es la del
carburador) e `intake-efi` ("Admisión años 2000"). `#/lab/intake` redirige
a `intake-efi`. Registrado: MAP sin MAF (*speed-density*), turbo.

## 2. Piezas (`partId`)

`airFilter`, `airBox` (o `airCleaner`), `throttlePlate`, `throttleStop`
(carb) / `iacValve` (efi), `manifold`, `intakeGasket`, `pcvValve`,
`pcvHose`, `vacuumPort` (el bus de vacío), `vacuumGauge` (herramienta del
laboratorio), `engineIntake` (los cilindros como consumidor). EFI: `maf`,
`mapSensor`.

## 3. Parámetros

| key | rango | default | significado |
|---|---|---|---|
| `rpm` | 0–6500 | 800 | stub de `engine.rpm` (0 = detenido) |
| `throttle` | 0–1 | 0 | mariposa |
| `iacOpen` | 0–1 | 0,5 | efi: apertura de la IAC (0,5 = el ralentí de 800 rpm) |
| `idleStop` | 0–1 | 0,5 | carb: tornillo tope |
| `cylinderBalance` | 0–1 | 1 | stub de `engine.cylinderBalance` (hace temblar el vacuómetro) |
| `backpressure` | 0–1,5 | 0 | stub de `exhaust.backpressure` (bar) |

## 4. Fallas (ids §26)

| id §26 | clave | tipo | efecto |
|---|---|---|---|
| `airFilter.clog` | `filterClog` | 0–1 | `k·(1 + 30·s)`: menos aire a fondo (menos fuerza), sin cambiar la mezcla con MAF |
| `vacuumHose.off` | `vacuumHoseOff` | toggle | 12,6 mm² abiertos al múltiple (manguera de 4 mm): aire **no medido** |
| `intakeGasket.leak` | `gasketLeak` | 0–1 | `0–20 mm²` no medidos |
| `pcvHose.cracked` | `pcvCracked` | toggle | 6 mm² no medidos |
| `maf.dirty` | `mafDirty` | 0–1 | efi: el MAF lee ×`(1 − 0,4·s)`: la ECU dosa para menos aire → pobre |
| `iacValve.stuck` | `iacStuck` | `'ok' \| 'closed' \| 'open'` | efi: apertura 0,05 o 1 |
| `throttlePlate.dirty` | `throttleDirty` | 0–1 | carbonilla en el borde: el paso en ralentí ×`(1 − 0,6·s)` |

## 5. Física

Red del solver con fluido `air`: **potencial en bar relativos, flujo en
kg/h** (el aire no usa L/h; la capacidad se expresa en esas unidades).

### 5.1. Elementos

| pieza | elemento | ley / valor |
|---|---|---|
| atmósfera | nodo fijo 0 bar (`fixed`) | |
| filtro | `restrictor` | `k = 1,5e-7` bar/(kg/h)² (0,02 bar a 366 kg/h), `clogFactor = 30` |
| mariposa, IAC, fugas | **nuevo** `gasOrifice` (a, b; control `area` mm²; param `T` en K, default 300) | flujo isentrópico: `ṁ = Cd·A·p_a,abs·√(2γ/((γ−1)·R·T))·√(pr^{2/γ} − pr^{(γ+1)/γ})`, con `pr = p_b,abs/p_a,abs`, estrangulado (`pr ≤ 0,528`) a la constante de §5.2; antisimétrico; la raíz se regulariza como `smoothSqrt` cerca de `pr = 1` |
| múltiple | `volume` | `params.c = 0,00348` kg/bar (`C = V/(R·T)`, `V = 3 L`, `T = 300 K`); el `volume` ya multiplica por 3600 (`solver.md` §6): **no dividir** |
| cilindros | **nuevo** `enginePump` (a) | `ṁ = kp·rpm·VE·(1,013 + p)`, `kp = 0,0711` kg/h/(rpm·bar), `VE = (0,8 + 0,05·throttle)·(1 − 0,3·backpressure)` |

Áreas: mariposa `A = 2376·(1 − cos(90°·throttle))` mm² (55 mm); paso de
ralentí: carb `A = 38·idleStop·(1 − 0,6·dirty)`, efi `A = 38·iacOpen`
(19 mm² dan ~16,2 kg/h, el aire del ralentí). Las áreas son **efectivas** (ya
incluyen el coeficiente de descarga).

### 5.2. Constantes del gas

`γ = 1,4`, `R = 287 J/(kg·K)`, `T = 300 K` (el flujo escala con
`√(300/T)`: el param `T` del elemento lo corrige para gas caliente); estrangulado,
`ṁ*/(A·p_a,abs) = 234 kg/(s·m²·bar)`; en las unidades del solver
`ṁ*[kg/h] = 0,842·A[mm²]·p_a,abs[bar]` (19 mm² a 1,013 bar → 16,2 kg/h, el
aire del ralentí).

### 5.3. Señales

- `intake.map` = potencial del múltiple (bar relativos).
- `air.massFlow` = `ṁ` del `enginePump`.
- aire medido: efi `= ṁ` que pasa por el filtro (el MAF está después) ×
  `(1 − 0,4·mafDirty)`; carb = `ṁ` por la mariposa + paso de ralentí.
- `air.ratio = air.massFlow / aire medido` (1 sano; > 1 entrada de aire
  falsa o MAF sucio; lo usa `engineCore`: `mix = fuel.mixture / air.ratio`).
- `air.unmetered` = suma de las fugas (kg/h, informativa).

### 5.4. Vacuómetro

Lectura del vacuómetro (herramienta clásica): `−map` en bar y en inHg
(`×29,53`), con una oscilación `a·sin(2π·f·t)`: `f` = frecuencia de
encendido (`rpm/30` Hz para 4 cilindros), `a = 0,15·(1 − cylinderBalance)`
bar. Sano: aguja firme en 0,61–0,68 bar (18–20 inHg); una válvula quemada
(balance 0,75) la hace vibrar ±0,04 bar.

### 5.5. Bus de vacío en el vehículo

En el vehículo el nodo del múltiple es el **bus `vacuum`** (fluido `air`,
proveedor: la admisión). Se cuelgan de él la referencia del regulador del
combustible, la cápsula de avance por vacío (platinos) y el servo de frenos
(A20). Los `pressureSource` provisorios que hoy fijan esos nodos (el
`vacuumHose` del combustible, el stub de la cápsula) se sueltan, igual que
las baterías provisorias en A17. El puerto `ref` del `reliefRegulator` no
lleva caudal: se le agrega el param `refFluid` para que declare `air` y
pueda colgarse del bus sin violar §30. El `manifold` del combustible (donde
descargan los inyectores) **no** se cuelga del bus: sigue siendo un
`pressureSource` de fluido `fuel` que el controlador del combustible pone en
`intake.map` (un paso de retraso; la bencina que entra al aire no es un
cruce de fluidos de la red, se consume). Una fuga en cualquiera
de ellos es una fuga real del múltiple. `ignition.vacuumLeak` deja de
usarse: el diafragma roto pasa a ser un `gasOrifice` del circuito del
encendido sobre el bus.

### 5.6. Referencia (planificador, 800 rpm)

| caso | map | aire (kg/h) | `air.ratio` |
|---|---|---|---|
| ralentí sano | −0,65 | 16,5 | 1,00 |
| manguera de 4 mm suelta | −0,41 | ~27 | ~1,65 |
| a fondo 6000 rpm | ≈ −0,02 | ~360 | 1,00 |
| constante de tiempo del múltiple en ralentí | τ = C/(∂ṁ/∂p) ≈ 0,28 s | | |

## 6. Estado

`map` (bar), `mapAbs`, `massFlow`, `meteredAir`, `unmetered` (kg/h),
`airRatio`, `throttleArea`, `idleArea` (mm²), `dpFilter` (bar), `ve`,
`vacuumGauge` (bar, con la oscilación), `vacuumGaugeInHg`.

## 7. Lecturas

Presión del múltiple (bar relativos y absolutos, `history`), aire (kg/h,
`history`), aire no medido (kg/h), proporción de aire (%), caída en el
filtro, vacuómetro (inHg, con aguja), MAF (efi, g/s).

## 8. Vista (viewBox 1200×700)

Filtro a la izquierda (suciedad visible con `filterClog`), ducto al MAF
(efi) o directo al carburador (carb, sólo la boca y la mariposa), mariposa
que gira, paso de ralentí (tornillo o IAC con su émbolo), múltiple con los
4 ramales a los cilindros (un bloque que "aspira" con pulsos a la
frecuencia de encendido), mangueras de vacío a la derecha con sus usuarios
dibujados como tapones rotulados ("servo de frenos", "avance",
"regulador" — en el laboratorio son extremos cerrados), PCV desde el cárter.
Partículas `p-air` ∝ `massFlow` (velocidad) y las fugas como chorritos que
entran. El vacuómetro grande abajo a la derecha. Drawers nuevos en
`src/render/svg/drawers/intake/`: `airFilterBox`, `throttleBody`,
`iacValve`, `intakeManifold`, `vacuumGauge`, `pcv`, `maf`. El `manifold`
del combustible sigue existiendo aparte.

## 9. Narración

- ralentí → info: "Con la mariposa cerrada los pistones aspiran contra un
  paso chico: por eso hay vacío (−0,65 bar)."
- `air.ratio > 1,15` → warn: "Entra aire que no pasó por el medidor: la
  mezcla queda pobre y el ralentí inestable."
- `dpFilter > 0,1` a fondo → warn: "El filtro de aire está tapado: a fondo
  entra menos aire (menos fuerza)."
- vacuómetro oscilando → warn: "La aguja del vacuómetro vibra: un cilindro
  aspira distinto (válvula o compresión)."
- efi con `mafDirty` → warn: "El MAF sucio lee menos aire del que entra: la
  ECU inyecta de menos."

## 10. Presets

"Ralentí sano", "A fondo", "Manguera de vacío suelta", "Filtro de aire
tapado", "MAF sucio", "Válvula de ralentí pegada", "Vacuómetro: válvula
quemada" (`cylinderBalance` 0,75), "Escape tapado" (`backpressure` 0,8).

## 11. Tests (`tests/intake/*.test.ts`)

1. `gasOrifice` y `enginePump`: ley y jacobiano; `gasOrifice` estrangulado
   no depende de `p_b` (`pr < 0,5`) y es antisimétrico.
2. Ralentí sano: `map` en **[−0,69; −0,61]**, `massFlow` en **[15; 18]**,
   `air.ratio` en [0,99; 1,01]. `failures === 0`.
3. A fondo 6000: `map` en **[−0,06; 0]**, `massFlow` en **[330; 380]**.
4. `vacuumHoseOff` en ralentí: `map > −0,5`, `air.ratio` en **[1,4; 1,9]**.
5. `filterClog = 1`, a fondo 6000: `massFlow` baja ≥ 20 %; `air.ratio`
   (efi) en [0,99; 1,01].
6. `mafDirty = 0,5` (efi): `air.ratio` en [1,2; 1,3].
7. Pisotón 0 → 1 en 0,05 s a 3000 rpm: `map` llega al 90 % del final en
   **[0,05; 0,4] s**.
8. Vacuómetro: con `cylinderBalance = 0,75`, amplitud en [0,03; 0,05] bar.
9. Motor detenido: `map = 0 ± 0,005`, `massFlow = 0`.
10. Robustez y determinismo.

## 12. En el vehículo

- **Proveedor del bus `vacuum`** (§5.5).
- **Publica**: `intake.map`, `air.massFlow`, `air.ratio` (dejan de ser
  provisionales en `engineCore`).
- **Lee**: `engine.rpm`, `engine.state`, `engine.cylinderBalance`,
  `exhaust.backpressure`. `throttle` es param del vehículo.
- En `vehicle-70` es `intake-carb`: el carburador dibuja su propia boca y
  mariposa; la admisión dibuja el filtro y el múltiple y **presta** la
  mariposa (la física de la mariposa está acá; el drawer del carburador la
  anima con el mismo canal).
