# Módulo — Carrocería y chasis: inspección (`body`) — **especificación completa**

> Spec viva, escrita por el agente planificador el 2026-09-26 (plan
> `plans/2026-09-26-body.md`). Tarea A25, bloque S2 (después de A15).
> Decisión del usuario (2026-09-26): por ahora **inspección visual**
> (óxido, perforación, deformación). La soldadura es un minijuego muy a
> futuro (`HORIZONTE_JUEGO.md`); enderezado y pintura, ideas sin fecha.

## 1. Arquetipo y variantes

No es una red ni un mecanismo con dinámica rápida: es un **modelo por
zonas** (datos + una evolución lenta del óxido) y un conjunto de
**herramientas de inspección**. Fuera del solver (plan del vehículo §11).

| Estructura | Época | Se implementa |
|---|---|---|
| Chasis de largueros + carrocería atornillada | común en los 70 (camionetas, sedanes grandes) | sí |
| Monocasco | se generaliza desde los 70–80 | sí |

Descriptores: `body-frame` ("Chasis y carrocería, años 70") y
`body-unibody` ("Monocasco, años 2000"). `#/lab/body` redirige a
`body-unibody`.

## 2. Zonas (`partId`)

Comunes: `sillL`, `sillR` (zócalos), `floorFront`, `floorRear`,
`wheelArchFL`…`RR` (tapabarros), `doorBottomL/R`, `trunkFloor`,
`jackPointFL`…`RR`, `windscreenFrame`, `batteryTray`.
Largueros: `frameRailL`, `frameRailR`, `crossmember`, `bodyMounts`.
Monocasco: `strutTowerL`, `strutTowerR`, `frontRailL`, `frontRailR`,
`rearRailL`, `rearRailR`.

Cada zona tiene `structural: boolean` (largueros, torres, zócalos, piso,
puntos de gata: sí; tapabarros y puertas: no).

## 3. Parámetros

| key | rango | default | significado |
|---|---|---|---|
| `climate` | `'dry' \| 'humid' \| 'coastal' \| 'saltedRoads'` | `'humid'` | velocidad del óxido |
| `tool` | `'eyes' \| 'magnet' \| 'paintGauge' \| 'hammer' \| 'screwdriver'` | `'eyes'` | herramienta elegida (el clic en una zona la usa) |

Acciones: `age(años)` (avanza el óxido), `inspect(zona)` (aplica la
herramienta; en el laboratorio se ve todo igual).

## 4. Fallas (por zona; ids §26 `<zona>.<falla>`)

| falla | tipo | significado |
|---|---|---|
| `<zona>.rust` | enum `0…4` | 0 sano · 1 superficial · 2 ampollas bajo la pintura · 3 costra y escamas · 4 perforado |
| `<zona>.filler` | 0–1 | masilla escondida bajo la pintura (`0–6 mm`): una reparación mal hecha |
| `<zona>.dent` | 0–1 | deformación `0–40 mm` (choque) |
| `<zona>.repaint` | toggle | repintada (más capas) |
| `drainHoles.blocked` | toggle | desagües tapados: el óxido avanza ×3 en pisos y zócalos |
| `paint.chipped` | 0–1 | pintura saltada (piedras): el óxido arranca en tapabarros y zócalos |

**La falla `rust` es la semilla del estado**: cambiarla (o "Reparar todo",
que la vuelve a 0) re-siembra el progreso `r` de esa zona con ese valor; el
`age()` sólo mueve el estado. Así en el laboratorio reparar deja la zona
sana, y en el juego el estado inicial lo fija el caso. `filler`, `dent` y
`repaint` no evolucionan: se leen tal cual.

El catálogo trae `rust`, `filler` y `dent` para todas las zonas y
`repaint` para las visibles; en el panel de fallas se agrupan por zona.

## 5. Modelo

### 5.1. Avance del óxido (`age`)

Cada zona tiene un progreso continuo `r ∈ [0, 4]` (el enum de la falla es
el valor inicial; el estado avanza): `dr/dt[años] = base·clima·(1 +
2·chipped_zona)·(3 si desagües tapados y la zona es piso/zócalo)·(r > 0,5 ?
1 : 0,1)`, con `base = 0,15`/año y `clima` = 0,3 seco · 1 húmedo · 2
costero · 2,5 sal. Una zona sin óxido y con pintura sana casi no arranca (0,015/año hasta
0,5); con la pintura saltada en la costa llega a 3 en ~8 años.

### 5.2. Integridad estructural

`integridad_zona = 1 − [0, 0,05, 0,15, 0,4, 0,85][round(r)] − 0,3·dent`;
índice del auto = mínimo de las zonas estructurales. **Revisión técnica**:
reprueba si alguna zona estructural está en 4, o si la integridad mínima
< 0,55; con chasis de largueros, un larguero perforado reprueba siempre.

### 5.3. Herramientas (lo que devuelve `inspect`)

| herramienta | devuelve |
|---|---|
| vista | 0–1: burbujas o costra visibles (`r ≥ 2`), perforación (`r = 4`), abolladura, diferencia de tono si `repaint` |
| imán | pega / no pega: no pega sobre masilla > 2 mm |
| medidor de pintura | µm: fábrica 110 ± 15, repintada 250 ± 40, masilla `+1000 µm/mm` |
| martillo (golpecito) | sonido `sólido` / `sordo` (óxido `r ≥ 2` bajo la pintura o masilla) |
| destornillador (pinchar) | atraviesa si `r ≥ 3` en una zona estructural (la prueba del inspector) |

Los valores con dispersión usan el rng con semilla (§3).

### 5.4. Efectos en el resto del auto (en el vehículo)

- Torre de amortiguador (`strutTowerX`) en 3–4 → la caída de esa rueda
  cambia `+0,5°` (publica `body.camberShiftFL/FR`, la suma la
  suspensión).
- Larguero / punto de montaje en 4 → golpe (`clunk`) en baches.
- Bandeja de batería (`batteryTray`) en 3–4 → la masa del chasis empeora
  (`+0,02 Ω`, publica `body.groundResistance`, la suma el eléctrico).

## 6. Estado

Por zona: `rust` (0..4 continuo), `stage` (entero), `integrity`, `visible`
(lo que vería el ojo). Global: `integrity`, `passesInspection` (bool),
`lastInspection` (`{zona, herramienta, resultado}`).

## 7. Lecturas

Integridad mínima (%, verde > 70), revisión técnica (pasa/reprueba), zona
más débil, última medición de herramienta.

## 8. Vista (viewBox 1300×760)

Vista lateral del auto y vista de abajo (el piso con largueros o el
monocasco con sus rieles), cada zona un área clickeable con textura
según el estado (manchas naranjas, burbujas, escamas, agujero), la
abolladura como deformación del contorno y, con `repaint`, un tono
levemente distinto. La herramienta elegida aparece junto al cursor en la
zona pinchada con su lectura. Drawers en `src/render/svg/drawers/body/`:
`bodySide`, `underbody`, `rustZone`, `toolReadout`.

## 9. Narración

- zona estructural en 3 → warn: "El {zona} tiene óxido en costra: ya le
  quita resistencia."
- en 4 → bad: "El {zona} está perforado: el auto no pasa la revisión."
- imán que no pega → warn: "El imán no pega: hay masilla debajo (una
  reparación escondida)."
- martillo sordo → info: "Suena sordo: hay óxido debajo de la pintura."
- desagües tapados → info: "Los desagües tapados dejan el agua adentro: el
  piso se oxida desde adentro."

## 10. Presets

"Auto sano", "Zócalos podridos" (70), "Masilla escondida en el
tapabarros", "Torre de amortiguador oxidada" (monocasco), "Auto de la
costa, 15 años" (`coastal` + `age(15)`), "Desagües tapados".

## 11. Tests (`tests/body/*.test.ts`)

1. `age(10)` en `humid` con pintura sana: ninguna zona pasa de 1.
2. `paint.chipped = 1` en `coastal`: tapabarros llega a 3 en ≤ 10 años.
3. `drainHoles.blocked`: el piso avanza ≥ 2,5× más rápido que sin la falla.
4. Revisión: zona estructural en 4 → reprueba; tapabarros en 4 y el resto
   sano → pasa.
5. Imán: no pega con `filler ≥ 0,4` (2,4 mm); pega con 0,2.
6. Medidor de pintura: fábrica en [80; 140] µm; repintada en [170; 330];
   masilla 0,5 → > 2500.
7. Destornillador atraviesa en 3 y 4, no en 2.
8. Determinismo (misma semilla → mismas lecturas).

## 12. En el vehículo

- Una región del diagrama del vehículo con la vista lateral chica.
- **Publica**: `body.camberShiftFL`/`FR` (°), `body.groundResistance` (Ω),
  `body.integrity`.
- No lee señales (el tiempo es por acciones).
