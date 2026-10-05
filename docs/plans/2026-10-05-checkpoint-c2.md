# Plan — Checkpoint C2: el vehículo se entiende

Fecha: 2026-10-05. Autor: agente planificador. Se lee de arriba abajo; **todo
lo que hace falta para V2, V3 y R2 está acá**. Reemplaza a las secciones V2 y
V3 (y a D3–D6) de `plans/2026-09-29-legibilidad-y-foco.md`. Se implementa
**después de cerrar C1** (`plans/2026-10-05-checkpoint-c1.md`).

**Cómo se revisó**: igual que C1 v2, cada afirmación sobre el código se
comprobó leyendo el código o con una prueba desechable (borrada). Lo medido
va marcado **[medido]**. §8 lista lo que este plan corrige del de 09-29.

## 1. Qué se quiere

El usuario abrió `#/lab/vehicle-70` el 2026-09-29: "todo se ve muy pequeño y
no se entiende nada" y "no se entiende que es un auto de los 70". Pidió:

- agrandar el sistema que se usa y achicar o transparentar los demás;
- un chasis con los diagramas adentro, para que se vea un auto.

Silueta decidida (2026-10-05): **sedán** para `vehicle-70` y **compacto**
para `vehicle-2000`, vistos desde arriba.

## 2. Dónde está el código hoy (lo que este plan da por hecho)

- **Escala**: el `viewBox` del vehículo es 2840×2440 (`modules/vehicle/defs.ts`,
  grilla de 2 columnas × 3 filas con celdas de 1400×800); el SVG usa
  `preserveAspectRatio: meet`. En el área central de un monitor 1920×1080
  (~1380×990) la escala es ~0,41 contra ~1,06 de un laboratorio suelto.
- **Cómo se dibuja el vehículo** (`modules/vehicle/index.ts`,
  `mergedCircuitOf`): la unión de cada sistema **tal como dibuja su propio
  laboratorio**, desplazado a su celda con `translateCircuit`. **No hay
  tubos ni cables que crucen de una celda a otra** [medido en el código]:
  cada sistema conserva su batería dibujada aunque en la física esté fundida.
  El motor de 4 tiempos es una caja de 420×260 (`mechanismInset`,
  `render/svg/drawers/vehicle.ts`) con `data-part="four-stroke"`.
- **Cada pieza del vehículo ya trae su sistema**: `translateCircuit` anota
  `scope` (= id del sistema) en cada pieza (`bdadc5f`), y el renderer prefija
  con él las sub-piezas que dibuja cada drawer. Los enlaces **no** tienen
  `scope` todavía.
- **Capas del renderer** (`render/svg/index.ts`): `pipes`, `behind`,
  `particles`, `parts`, `fx`, globales para todo el SVG. Un drawer puede
  dibujar en varias capas.
- **`resolveLayout`** (`render/svg/layout.ts:100-101`) deduce el sistema de
  una sub-pieza **cortando el id en el `:`**: eso contradice §23 ("ninguna
  lógica depende de un nombre"). Con `scope` se puede corregir.
- **`checkLayout`** corre sobre el vehículo compuesto en
  `tests/render/layout.test.ts` y da 0 problemas. Una pieza con
  `geo.container: true` puede contener tubos y piezas sin dar
  `piezas-solapadas` ni `tubo-cruza-pieza` (`layout.ts:245` y `:291`).
- **Tensión de batería**: la única del estado es
  `signal.electrical.crankVoltage`, un **stub fijo de 12,6 V** [medido]. La
  tensión real del bus de 12 V sólo aparece en lo que cuelga de él
  (`ignition:coilV` 12,56 V en `vehicle-70`; `fuel:pumpV` y `ignition:coilV`
  14,0 V en `vehicle-2000`, con el alternador).
- **Teclado**: sólo el timebar escucha `keydown` (espacio).
- **H1 (C1) ya existe** cuando empieza C2: `affects` en los controles,
  `onFocus` en los paneles, la capa `affected` del resaltado, y
  `renderer.update` recibe `simDt`.

## 3. Decisiones

**E1 — Cámara sobre el `viewBox`, no escala por sistema.** Escalar cada
sistema por separado exigiría un grupo SVG por sistema, pero el renderer
dibuja en capas globales y un drawer usa varias. Animar el `viewBox` hace lo
mismo: el sistema enfocado llena el área (escala ~1,0) y los demás quedan en
los bordes, atenuados (E3). Es un atributo, como pide §9.

**E2 — La región de cada cosa sale de `scope`, no del id.**
- Piezas: `scope` (ya existe). La caja del mecanismo recibe
  `scope: sys.id` en `mergedCircuitOf`.
- Enlaces: `translateLink` anota `scope` igual que `translatePart`
  (`CircuitLinkDef.scope?: string`).
- Rectángulo de cada región: `CircuitDef.regions?: readonly { id: string;
  rect: Rect }[]`, que arma `mergedCircuitOf`: `{ x: at[0], y: at[1], w, h }`
  con `w, h` del `viewBox` del laboratorio del sistema (para el mecanismo,
  su celda completa, para que la caja quede centrada al enfocarla).
- `layout.ts:100-101` pasa a usar `part.scope` en vez de cortar el id (§23).

**E3 — Atenuado: `data-region` sólo en el primer nivel de cada capa.**
`opacity` se multiplica de padre a hijo: si se marcan un grupo y sus hijos,
`.dim` (0,25) daría 0,0625. El renderer marca con `data-region` sólo los
nodos **hijos directos de cada capa** que creó cada drawer (comparando los
hijos de cada capa antes y después de `draw`) y los grupos de tubo y de
partículas de cada enlace (por `link.scope`). `.dim { opacity: 0.25 }`.
`pointerenter` sobre un nodo atenuado lo muestra entero mientras el puntero
esté encima (CSS `:hover`).

**E4 — Qué región se enfoca, y cuándo se mueve la cámara (corrige D4b).**
D4b decía "el sistema del control que se está tocando", pero H1 dispara
`onFocus` también al **pasar el mouse**: la cámara saltaría de sistema en
sistema mientras el usuario recorre el panel. Por eso:
- H1 entrega `onFocus(partIds, reason)` con `reason: 'hover' | 'use'`
  (`'use'` = `pointerdown`, `input`/`change` o foco por teclado). **Este
  cambio va en C1** (D-C9), para no cambiar la API dos veces.
- `'hover'` sólo resalta (como en C1). `'use'` además enfoca la región.
- La región de un conjunto de piezas: la región de cada `data-part` (el
  `data-region` de su ancestro en el DOM, no el prefijo del id). Si todas
  caen en una sola región, se enfoca; si son varias (control compartido:
  `ignitionKey`, `throttle`, `rpm`, `vehicleSpeedKmh`), vista de conjunto.
- Clic en una pieza: enfoca su región. Clic en el fondo (hoy ya emite
  `selectPart(null)`) o `Esc`: vista de conjunto. El `Esc` lo escucha el
  shell (en `core/mount.ts` después de U1) y se quita en `destroy()`.
- En un laboratorio suelto no hay regiones: `focus` no hace nada.

**E5 — Animaciones en tiempo real** (D-C1 de C1): `renderer.update(visual,
simDt, realDt)`. Cámara: interpolación exponencial del `viewBox` con
constante de ~0,15 s de `realDt` (llega en ~0,4 s); a 0,05× la cámara se
mueve igual. Las partículas siguen con `simDt`.

**E6 — Chasis en planta, con celdas de sistema (decisión del usuario
2026-10-05: sedán 70, compacto 2000).**
Un auto visto desde arriba es largo y angosto (~2,5:1); cinco diagramas de
1300×720 no caben "en su lugar físico" exacto (el del combustible va del
estanque, atrás, al riel, adelante). Se hace honesto así: el chasis tiene
**3 columnas × 2 filas** de celdas de 1400×800 (4200×1600, 2,6:1), y cada
sistema va en la zona donde vive casi todo su hardware:

| | Adelante | Centro | Atrás |
|---|---|---|---|
| **Arriba** | refrigeración (radiador al frente) | motor de 4 tiempos | alimentación (estanque atrás) |
| **Abajo** | encendido | lubricación (cárter bajo el motor) | libre (S2: escape, frenos…) |

La carrocería (`chassis`, drawer nuevo) rodea las 6 celdas con márgenes de
120 para ruedas y paragolpes: `viewBox` del vehículo ≈ 4440×1840. El drawer
dibuja contorno, cuatro ruedas, la línea del vano motor (entre "adelante" y
"centro") y, en el sedán, el maletero; dos versiones (`sedan70`,
`compact00`; ids en inglés, §18) que cambian proporciones y esquinas, no la
grilla. Es fondo: va en la capa `behind`, `geo.container: true` (así
`checkLayout` deja tubos y piezas adentro), y **no** lleva `data-part` (no
es clickeable; la inspección de carrocería es A25).

**E7 — Vista de conjunto con indicadores en vivo.**
Con la cámara en el conjunto, cada región muestra su nombre en grande y 1–2
indicadores; al entrar a una región se ven los diagramas. Indicadores (del
`VisualState`, §22; canales `global` del presenter del vehículo):

| Región | Indicador | De dónde sale |
|---|---|---|
| motor | rpm | `signal.engine.rpm` |
| refrigeración | °C del refrigerante | `signal.engine.coolantTemp` |
| lubricación | bar de aceite | `signal.lubrication.pressure` |
| encendido | V de batería | **sonda nueva** `bus12vVolts` = potencial del nodo de `${provider}:battery.+` (el `provider` del bus `12v` de la `VehicleDef`) **[medido: el nodo existe y sigue a la batería y al alternador]**. **No** `electrical.crankVoltage` (es un stub fijo de 12,6 V) |
| alimentación | mezcla (λ relativa) | `signal.fuel.mixture` |

Ojo al revisar: `vehicle-70` **no tiene alternador** (en marcha el bus queda
en 12,56 V [medido]); el único alternador es el del sistema de combustible
de `vehicle-2000` (14,0 V en marcha). No es un bug de V3: lo resuelve A17.

Fundido continuo entre conjunto y detalle, según el ancho del `viewBox`
actual frente al de la región: por encima de 1,5× la región, diagramas al
0,15 e indicadores visibles; por debajo de 1,1×, al revés; en medio,
interpolado. El nombre y los indicadores son un drawer más (`regionLabel`),
por región, que el renderer crea a partir de `regions`.

## 4. Tareas, en orden

`V2 → V3 → R2`. Un agente a la vez; cada tarea cierra con `npm run check`,
CERRADO en `AHORA.md` y commit.

### V2 — Regiones, cámara y atenuado

1. `sim/circuit/types.ts`: `CircuitLinkDef.scope?`, `CircuitDef.regions?`.
   `translateCircuit`: `scope` en los enlaces. `mergedCircuitOf`: `scope` de
   la caja del mecanismo y `regions` (E2).
2. `render/svg/layout.ts:100-101`: `part.scope` en vez de cortar el id.
3. `render/svg/index.ts`: `data-region` en el primer nivel de cada capa
   (E3); `renderer.focus(regionId | null)`; `update(visual, simDt, realDt)`
   con la cámara de E5; `.dim` sobre lo que no es la región enfocada.
4. `core/mount.ts`: `reason` de `onFocus` (E4) → `renderer.focus`; clic en
   pieza / fondo; `Esc`. `core/loop.ts` ya entrega `realDt` a `onFrame`.
5. `styles.css`: `.dim`, `.dim:hover`.
6. **Tests**:
   - `tests/sim/translate.test.ts`: los enlaces llevan `scope`.
   - `tests/render/layout.test.ts`: en los dos vehículos, cada región
     contiene todas las cajas de sus piezas y los puntos de sus enlaces;
     las regiones no se solapan; `checkLayout` sigue en 0.
   - DOM (patrón `tests/render/parts-dom.test.ts`): en `vehicle-70`, ningún
     nodo con `data-region` tiene un ancestro con `data-region` (E3); tras
     `focus('cooling')` y 1 s de `tick`, el `viewBox` está a <1 % del
     rectángulo de la región y los nodos de otras regiones tienen `.dim`;
     `focus(null)` vuelve al `viewBox` completo; un `input` en
     `cooling:ambientC` enfoca refrigeración y un `pointerenter` no mueve la
     cámara; `throttle` (compartido) no enfoca ninguna región.

**Firefox** (`vehicle-70` y `vehicle-2000`): al mover un slider de un
sistema, la cámara entra a ese sistema en menos de medio segundo y el texto
se lee sin acercar el navegador; pasar el mouse por el panel no mueve la
cámara; los otros sistemas se ven atenuados y se aclaran con el mouse
encima; `Esc` o clic en el fondo vuelve al conjunto; a 0,05× la cámara se
mueve a la misma velocidad.

### V3 — Chasis y vista de conjunto

1. `sim/vehicle/types.ts`: `VehicleDef.chassis: 'sedan70' | 'compact00'`.
   `defs.ts`: grilla 3×2 de E6 (cambian los `at` y el `viewBox`), `chassis`
   de cada vehículo.
2. Drawer `chassis` (`render/svg/drawers/vehicle.ts`), en la capa `behind`,
   `geo.container: true`, sin `data-part`, colores por variables CSS (§9),
   dos versiones. `mergedCircuitOf` agrega la pieza `chassis` (tipo
   `visual`) y la región libre no lleva nada.
3. Sonda `bus12vVolts` en `compileVehicle` (E7). Canales `global` en el
   presenter del vehículo (`modules/vehicle/present.ts`): `rpm`,
   `coolantC`, `oilBar`, `batteryV`, `mixture`.
4. Drawer `regionLabel` y fundido conjunto/detalle (E7) en el renderer.
5. **Tests**: `checkLayout` en 0 con el chasis; la sonda `bus12vVolts`
   sigue al bus (con `ignitionKey: 'run'` en `vehicle-2000` > 13,5 V por el
   alternador; con `ignition:batteryV = 11` en `vehicle-70` y la llave en
   "off", 11,0 V [medido]); DOM: en el conjunto se ven los nombres de las 5
   regiones; tras `focus('cooling')`, la etiqueta de refrigeración queda
   transparente y su diagrama opaco.

**Firefox**: al abrir cada vehículo se reconoce un auto visto desde arriba,
distinto el sedán de los 70 del compacto de 2000; los indicadores se mueven
al arrancar; al tocar un control o clicar una zona la cámara entra y aparece
el diagrama; tema claro y oscuro.

### R2 — Revisión de cierre de C2 (usuario)

Los dos vehículos con la checklist de V2 y V3. Lo que salga se anota en
`AHORA.md`. Después: S2 (A17 eléctrico primero, que le da dueño a la batería
y reemplaza el stub `electrical.crankVoltage`).

## 5. Fuera de alcance

- Un riel eléctrico compartido dibujado entre regiones (hoy cada sistema
  dibuja su batería; se resuelve en A17).
- El inset del 4 tiempos con su propia vista (sigue la caja).
- Botones de acción y presets del vehículo.
- Modelo 3D; arrastrar piezas (bloque G).

## 6. Riesgos

- **Rendimiento al animar el `viewBox`** con ~100 piezas: sólo se anima
  durante la transición. No se puede medir en la nube (sin navegador, regla
  4 de `AGENTS.md`): se mide en Firefox en R2; si baja de 60 fps se anota y
  se evalúa `will-change` o reducir partículas fuera de foco.
- **Pantallas chicas**: en 1366×768 enfocar una región de 1300×720 da ~0,63;
  legible, no cómodo. Se acepta y se anota en R2.
- **La celda libre** puede parecer un error: lleva un rótulo tenue
  ("Próximos sistemas").

## 7. Preguntas

Ninguna abierta.

## 8. Qué corrige este plan del de 09-29

1. **D4b → E4**: la cámara no sigue al mouse (`reason: 'hover' | 'use'`).
2. **D4**: `region` ya no es un dato nuevo en cada pieza: es `scope`, que
   existe; sólo faltan los enlaces y los rectángulos.
3. **Atenuado**: marcar todos los nodos componía la opacidad; ahora sólo
   el primer nivel de cada capa (E3).
4. **Riesgo "regiones que se pisan"**: no aplica; no hay tubos entre
   regiones hoy.
5. **Indicador de batería**: `electrical.crankVoltage` es un stub fijo; se
   mide el bus real (E7).
6. **Disposición del chasis**: el de 09-29 decía "cada diagrama en su zona"
   sin decir cómo caben cinco diagramas en una planta de auto; E6 da la
   grilla, los márgenes y el `viewBox`.
7. **§23 en `layout.ts`**: se agrega la corrección del corte por `:`.
