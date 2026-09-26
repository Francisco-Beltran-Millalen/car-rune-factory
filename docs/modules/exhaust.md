# Módulo — Escape (`exhaust`) — **especificación completa**

> Spec viva, escrita por el agente planificador el 2026-09-26 (plan
> `plans/2026-09-26-exhaust.md`). Tarea A19, bloque S2 (después de A15 y
> A18). Las fórmulas de emisiones (§5.5) son aproximaciones didácticas: dan
> las tendencias correctas (rico → CO, falla → HC, pobre → O₂), no valores
> de homologación.

## 1. Arquetipo y variantes

Múltiple de escape → tubo de bajada → (catalizador) → silenciador → cola.
Publica la contrapresión (le quita aire a la admisión) y, con sonda lambda,
cierra el lazo de la mezcla con la ECU del combustible.

| Pieza | Antigua | Moderna | Se implementa |
|---|---|---|---|
| Catalizador | no hay | de tres vías | los dos |
| Sonda lambda | no hay | antes del catalizador (lazo cerrado) + después (monitor del catalizador) | los dos |

Descriptores: `exhaust-simple` ("Escape años 70") y `exhaust-cat` ("Escape
años 2000"). `#/lab/exhaust` redirige a `exhaust-cat`. Registrado: sonda de
banda ancha, EGR, turbo.

## 2. Piezas (`partId`)

`exhaustManifold`, `manifoldGasket`, `downpipe`, `catalyst` (cat),
`o2Upstream`, `o2Downstream` (cat), `muffler`, `tailpipe`, `hangers`,
`gasAnalyzer` (herramienta del laboratorio).

## 3. Parámetros

| key | rango | default | significado |
|---|---|---|---|
| `rpm` | 0–6500 | 800 | stub |
| `throttle` | 0–1 | 0 | stub (aire con la fórmula de `carburetor.md` §5.1) |
| `mixture` | 0,5–2 | 1 | stub de la mezcla efectiva (`fuel.mixture / air.ratio`) |
| `spark` | 0–1 | 1 | stub de `ignition.spark` (fallas de encendido) |
| `closedLoop` | bool | true | cat: simula la ECU corrigiendo con la sonda (en el vehículo lo hace el combustible) |

## 4. Fallas (ids §26)

| id §26 | clave | tipo | efecto |
|---|---|---|---|
| `manifoldGasket.leak` | `gasketLeak` | 0–1 | fuga antes de la sonda: tic-tic, y en ralentí **entra** aire en los pulsos → la sonda ve pobre |
| `catalyst.clog` | `catClog` | 0–1 | `k·(1 + 25·s)` en el catalizador: contrapresión, falta de fuerza |
| `muffler.rusted` | `mufflerRusted` | 0–1 | agujero: ruido fuerte (`+20·s` dB), menos contrapresión |
| `hangers.broken` | `hangersBroken` | toggle | golpeteo contra el piso (canal `rattle`) |
| `tailpipe.blocked` | `tailpipeBlocked` | 0–1 | cola tapada (la papa): a 1 el motor no sostiene ralentí |
| `o2Upstream.lazy` | `o2Lazy` | 0–1 | respuesta τ = `0,1 + 1,5·s` s |
| `o2Upstream.dead` | `o2Dead` | toggle | 0,45 V fijos: la ECU vuelve a lazo abierto |

Estado que se daña solo: `catDamage` (§5.4).

## 5. Física

### 5.1. Red (solver, fluido nuevo `exhaust`, bar relativos y kg/h)

| pieza | elemento | valor |
|---|---|---|
| motor | `flowSource` (de A16) hacia el múltiple | `ṁ = air.massFlow·(1 + 1/14,5)` |
| múltiple + bajada | `restrictor` | `k = 2,6e-7` |
| catalizador | `restrictor` | `k = 5,2e-7`, `clogFactor = 25` (sin cat: tramo recto `k = 0,5e-7`) |
| silenciador | `restrictor` | `k = 5,2e-7` |
| cola | `variableOrifice` (de A13) | `gOpen = 3900` (0,01 bar a 390 kg/h), `gLeak = 0`, `open = 1 − 0,995·tailpipeBlocked` (tapada: ~0,85 bar con el aire del ralentí) |
| agujero del silenciador | `gasOrifice` (de A18), `T = 700 K` | área `200·s` mm² a la atmósfera |
| fuga de la junta | `gasOrifice`, `T = 900 K` | área `15·s` mm² a la atmósfera |
| volúmenes | `volume` | múltiple y silenciador, `c = 1e-4` kg/bar cada uno (sólo para convergencia) |

Contrapresión sana a fondo (≈ 390 kg/h): ~0,2 bar; en ralentí, casi 0.

### 5.2. Temperaturas (controlador, primer orden)

`EGT = 350 + 450·carga + 100·(1 − spark)` °C (sin chispa el gas sale sin
quemar y se quema después: más calor abajo). Catalizador:
`T_cat → EGT·0,9 + 1500·sinQuemar` con τ = 20 s, donde
`sinQuemar = (1 − spark) + max(0, mixture − 1,1)·0,5`.

### 5.3. Sonda lambda y lazo cerrado

`λ = 1/mixture`. Tensión `V = 0,45 + 0,4·tanh(20·(1 − λ_visto))`, rica
~0,85 V, pobre ~0,05 V, con retraso τ (0,1 s sana). `λ_visto` incluye el
aire que entra por la junta en ralentí: `λ_visto = λ·(1 + 0,15·gasketLeak·
(1 − carga))`.

Lazo (en el laboratorio si `closedLoop`; en el vehículo lo hace
`ecuFuel`): `trim += 0,5/s·(V < 0,45 ? +1 : −1)·dt`, limitado a ±0,25; la
mezcla que entrega la alimentación se multiplica por `(1 + trim)`. Con
`|trim| > 0,2` durante 5 s → código `P0171` (pobre) o `P0172` (rico). Así
se ve el caso clásico: una fuga de vacío hace trabajar la corrección, el
motor "anda bien" pero la ECU está al límite.

### 5.4. Catalizador

Eficiencia `η = 0,95·clamp((T_cat − 250)/150, 0, 1)·(1 − catDamage)`.
Con `T_cat > 950 °C`: `catDamage += 0,05/s` (acelerado, narrado) y el
catalizador se tapa por dentro: `catClog_ef = max(catClog, catDamage)`.
Sonda de atrás: `V_post = 0,45 + 0,4·tanh(20·(1 − λ))·(1 − η)` + 0,6·η
(con el catalizador sano la de atrás queda estable en ~0,6 V; gastado,
copia a la de adelante → código `P0420`).

### 5.5. Emisiones (analizador de 4 gases, a la salida)

Antes del catalizador:
- `CO % = 0,5 + 15·max(0, mixture − 1)` (rico → CO)
- `HC ppm = 150 + 4000·(1 − spark) + 800·max(0, mixture − 1,15)`
- `O₂ % = 0,5 + 18·max(0, 1 − 1/mixture) + 12·(1 − spark)` (la falla
  deja pasar aire)
- `CO₂ % = 14,7 − CO − O₂·0,5`
Después: `CO·(1 − η)`, `HC·(1 − η)`, `O₂·(1 − 0,6·η)`.

### 5.6. Ruido

`nivel dB = 72 + 10·carga + 20·mufflerRusted + 8·gasketLeak`; `rattle`
con `hangersBroken` y rpm cercanas a 1200 (resonancia).

## 6. Estado

`pManifold` (bar = contrapresión), `massFlow` (kg/h), `egt`, `catTemp`
(°C), `catEfficiency`, `catDamage`, `o2V`, `o2PostV` (V), `trim`, `codes`,
`co`, `hc`, `o2`, `co2` (a la salida), `noiseDb`, `rattle`.

## 7. Lecturas

Contrapresión (verde 0–0,3 a fondo, `history`), temperatura del
catalizador (`history`), eficiencia (%), sonda (V, `history` — se ve
oscilar en lazo cerrado), corrección de mezcla (%, verde −10..10), los 4
gases, ruido (dB).

## 8. Vista (viewBox 1300×600)

Motor a la izquierda (4 puertos), múltiple, junta (chorrito con la falla),
bajada, catalizador (panal que se pone rojo con `catTemp > 700` y se ve
derretido con `catDamage`), sondas con su cable y un mini-gráfico de
tensión, silenciador (agujero con óxido), cola (con la papa si
`tailpipeBlocked`). Partículas `p-exhaust` ∝ `massFlow`. El analizador de
gases como un aparato al final de la cola. Drawers en
`src/render/svg/drawers/exhaust/`: `exhaustManifold`, `catalyst`, `o2Sensor`,
`muffler`, `tailpipe`, `gasAnalyzer`.

## 9. Narración

- `trim > 0,15` → warn: "La ECU está agregando {x} % de bencina: ve la
  mezcla pobre (¿entra aire?)."
- `P0420` → warn: "La sonda de atrás copia a la de adelante: el catalizador
  ya no trabaja."
- `catTemp > 900` → bad: "¡El catalizador está al rojo! Una falla de
  encendido le está mandando bencina sin quemar."
- contrapresión > 0,5 a fondo → warn: "El escape está tapado: el motor no
  puede sacar los gases y pierde fuerza."
- sin catalizador y CO > 2 % → info: "Sin catalizador lo que sale es lo que
  sale del motor."

## 10. Presets

"Ralentí sano (lazo cerrado)", "Fuga de vacío: la ECU compensa" (mezcla
0,8 + `closedLoop`), "Falla de encendido: catalizador al rojo" (`spark`
0,75), "Catalizador tapado", "Sonda perezosa", "Junta del múltiple
soplada", "La papa en el escape", "Auto de los 70 rico" (`exhaust-simple`,
mezcla 1,15).

## 11. Tests (`tests/exhaust/*.test.ts`)

1. `Fluid` acepta `exhaust`; `validate` rechaza `exhaust` ↔ `air`.
2. A fondo 6000 sano: contrapresión en **[0,15; 0,3]** bar; ralentí < 0,02.
   `failures === 0`.
3. `catClog = 1` a fondo: > 0,8 bar.
4. `tailpipeBlocked = 1` en ralentí: contrapresión > 0,5.
5. Lazo cerrado con `mixture = 0,8` (stub): `trim` en [0,2; 0,25] y
   `P0171` a los 5 s; con 1,0 el trim oscila en ±0,05 y la sonda cruza
   0,45 V al menos 1 vez por segundo.
6. `o2Lazy = 1`: la sonda cruza 0,45 V menos de la mitad de veces que sana.
7. `spark = 0,75` sostenido: `catTemp > 950` y `catDamage > 0` antes de
   120 s; `hc` antes del cat > 800 ppm.
8. Cat sano caliente: `co` a la salida < 0,1 %; `exhaust-simple` con mezcla
   1,15: `co` > 2 %.
9. `P0420` con `catDamage` (estado) ≥ 0,7.
10. Robustez y determinismo.

## 12. En el vehículo

- **Publica**: `exhaust.backpressure` (la lee la admisión: `VE·(1 −
  0,3·p)`, y los 4 tiempos: presión de escape), `exhaust.o2Voltage` (cat).
- **Lee**: `air.massFlow`, `fuel.mixture`, `air.ratio`, `ignition.spark`,
  `engine.load`, `engine.state`.
- El combustible (`ecuFuel`) en `vehicle-2000` agrega el lazo cerrado de
  §5.3 leyendo `exhaust.o2Voltage` (en su laboratorio, sin la señal, queda
  en lazo abierto como hoy: la paridad no cambia).
