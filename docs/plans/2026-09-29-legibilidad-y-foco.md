# Plan — legibilidad y foco (resaltado de controles, cámara, chasis)

> **Aviso (2026-10-05)**: L0 está cerrado; H1 y H2 los reemplaza
> `plans/2026-10-05-checkpoint-c1.md` (corrige D2 y D7). V2 y V3 siguen
> aquí, con el ajuste D-C1 de ese plan. Manda `FICHAS.md`.

Fecha: 2026-09-29. Autor: agente planificador. Origen: revisión del usuario en
Firefox (`AHORA.md`, sección "REVISIÓN EN FIREFOX 2026-09-29"). Este plan se
lee de arriba abajo; no manda a otros planes salvo donde se nombra un archivo
de código.

## 1. Qué se quiere y por qué

El usuario vio tres problemas al abrir `#/lab/vehicle-70`:

1. Los cinco sistemas caben a la vez y **se ven muy pequeños** (cuenta en
   `AHORA.md`: el `viewBox` del vehículo es 2840×2440 y el de un laboratorio
   suelto ~1300×720; con `meet`, la escala del vehículo es ~2,5× menor).
2. **Los sliders no dan feedback inmediato** en el diagrama. Es un problema de
   **todas** las rutas, también de los laboratorios viejos.
3. **No se entiende que es un auto**: son cinco diagramas sueltos.

Lo que pidió el usuario, y que este plan implementa:

- **Resaltar lo que cada control modifica** mientras se lo toca ("algo básico
  de UX").
- **Cambiar la escala**: agrandar el sistema que se está usando y volver más
  chicos y transparentes los que no.
- **Un chasis con todos los diagramas dentro**, para que la información se
  transmita de forma visual.

## 2. Decisiones (con su razón)

**D1 — Cada control declara qué toca: `ControlSpec.affects`.**
Lista de `partId` del circuito. Es un dato del módulo (§8), no lógica del
core. Mientras el usuario mueve el control (pointerdown, foco de teclado o
hover, y 1,5 s después del último cambio), esas piezas se resaltan con un
anillo pulsante. Un control sin efecto en el contexto (p. ej. `cooling:load`
en el vehículo) declara `affects: []` y `disabledWhen`, con el motivo escrito.
Razón: sin un mapa control → pieza no hay forma de resaltar; deducirlo del
modelo sería adivinar (AGENTS.md, regla 2). Un test comprueba que todo
`affects` apunta a piezas que existen (§10).

**D1b — Las fallas también resaltan todo lo involucrado (decisión del
usuario, 2026-09-29: "por ahora tiene que haber feedback inmediato… ya sea al
mover un slider, o al resaltar un problema").**
Tres momentos, con un mismo estilo (`affected` para lo que se toca ahora,
`fault-cue` para lo que está roto):
1. **Al tocar una falla en el panel** (hover, foco, o al activarla): se
   resalta la pieza dueña (`FaultCatalogEntry.part`, ya existe) **y** las
   piezas donde se ve el síntoma (`FaultCatalogEntry.affects`, campo nuevo,
   opcional; p. ej. `filter.clog` → filtro, riel y manómetro).
2. **Mientras la falla siga activa y visible**, la pieza dueña lleva un aro
   fijo `fault-cue` (sin pulso, para no cansar). "Visible" lo decide la
   política del modo (`visibleFaultSet`): en el laboratorio se ven todas; en el
   diagnóstico del juego sólo las reveladas, así que esto **no delata** una
   falla oculta.
3. **Cuando una falla se activa** (por el usuario o por un preset), un pulso
   corto (~1,5 s) sobre la dueña y los síntomas, para que se vea *dónde*
   pasó.

Estado actual que lo hace barato: el presenter ya calcula `faultCues` (ids §26
de las fallas visibles, `presenter/present.ts`), pero **ningún renderer lo
usa** (`grep faultCues src`: sólo el tipo y el presenter). El renderer lo
convierte en `part` con `module.faultCatalog` y pone la clase.

**D2 — El resaltado es estado de la vista, no un intent de juego.**
El panel de controles avisa al shell (`onFocus(key | null)`) y el shell llama a
`renderer.highlight(affects, 'affected')`. `renderer.highlight` ya existe y
soporta estilos (`selected`, `correct`, `wrong`, `target`); se agrega
`affected`. Razón: §20 exige intents para lo que escribe `params`/`faults`;
resaltar no escribe nada. (Si el usuario prefiere que sea intent, es un
cambio chico: `intents.focusControl`, ignorado por los modos.)

**D3 — Para escalar, se anima la cámara (el `viewBox`), no cada sistema.**
El usuario pidió "agrandar los que se usan y achicar los que no". Hacerlo
literal exige que cada sistema sea un grupo SVG con su propia transformación,
pero el renderer dibuja en **capas globales** (`pipes`, `behind`,
`particles`, `parts`, `fx`; `render/svg/index.ts`) y los tubos cruzan piezas
de varios sistemas por bus: habría que reescribir las capas. La cámara logra
lo mismo: al enfocar un sistema, su región pasa a llenar el área (escala
~1,0 en un monitor de 1920×1080 en vez de ~0,41: unas 2,6× más grande), y los
demás quedan fuera o pequeños en los bordes, atenuados. Costo: un atributo
(`viewBox`) animado, permitido por §9.

**D4 — Atenuar por región, con datos.**
`translateCircuit` (que ya prefija ids `sistema:pieza`) también anota
`region: '<sistema>'` en cada pieza y enlace, y `CircuitDef.regions` guarda el
rectángulo de cada una. El renderer marca cada elemento con `data-region` y
un CSS `.dim` baja su opacidad a ~0,25. Nada de deducir la región del prefijo
del id en el renderer (§23: ninguna lógica depende de un nombre).

**D4b — Qué región está en foco.**
Prioridad: (1) el sistema del control que se está tocando, (2) el sistema de
la pieza seleccionada, (3) ninguno = vista de conjunto. Un control compartido
(`ignitionKey`, `throttle`, `rpm`) no enfoca un sistema: resalta las piezas de
todos los que afecta, en vista de conjunto. Clic en el fondo o `Esc` vuelve al
conjunto.

**D5 — El chasis es la vista de conjunto.**
Vista **desde arriba** (planta): cuatro ruedas, compartimento del motor
adelante, estanque atrás, línea de transmisión. Cada diagrama de sistema se
coloca dentro de su zona en el chasis. Es un dibujo (§9: una sola vez, colores
por variables CSS) con dos versiones, sedán de los 70 y compacto de 2000, para
que se entienda la época. En la vista de conjunto los diagramas quedan
atenuados y cada zona muestra en grande el **nombre del sistema** y 1–2
**indicadores en vivo** (rpm, temperatura del refrigerante, presión de
aceite, tensión de batería). Los indicadores salen del `VisualState`
(§22), no del modelo: se agregan como canales en el presenter del vehículo.
Al enfocar una zona, la cámara entra y el diagrama aparece con todo su
detalle.

**D6 — Las animaciones de cámara y de pulso usan tiempo real, no simulado.**
`renderer.update(visual, dt)` recibe hoy el `simDt` (`realDt × timeScale`). A
0,05× la cámara se arrastraría igual que la simulación. Es el mismo defecto
que ya está anotado para el quiz (`AHORA.md`, "PENDIENTE — FIX 2026-09-25"):
se arregla **una vez**, antes de esta tarea (L0), pasando `realDt` al modo y
al renderer.

**D7 — Controles sin efecto: se deshabilitan, no se esconden.**
Un control desaparecido confunde ("¿dónde estaba?"). Se muestra atenuado con
el motivo ("lo calcula el motor"). Los que no hacen nada en **ninguna** ruta
(`vehicleSpeedKmh`, `ignition:humidity`) no son un problema de UI sino un
posible bug del modelo o del presenter: en H2 se lee la spec correspondiente y
se decide si falta el canal o si sobra el control.

## 3. Tareas y orden

`L0 → H1 → H2 → V2 → V3`. Cada una cierra con `npm run check` y su CERRADO.

### L0 — `realDt` hasta el modo y el renderer (core)
Cierra el FIX del quiz y habilita D6. Archivos: `core/loop.ts`,
`game/session.ts`, `game/types.ts`, `core/shell.ts`, `game/modes/quiz.ts`,
`render/svg/index.ts` (firma de `update`). Test: con `timeScale = 0,05`, el
feedback del quiz dura ~1 s reales. Aceptación en Firefox: el quiz a 0,05×
pasa a la siguiente pregunta en 1 s reales.

### H1 — `affects` y resaltado (core + un poco de datos por módulo)
1. `core/types.ts`: `ControlSpec.affects?: readonly string[]` y
   `disabledReason?: string`.
2. `core/ui/controls.ts`: `createControlsPanel(…, { onFocus })`. Dispara con
   `pointerenter`/`focusin` y `pointerleave`/`focusout`, y mantiene el
   resaltado 1,5 s tras el último `input`/`change`. Muestra `disabledReason`
   como `title` y texto bajo el control.
3. `core/shell.ts`: conecta `onFocus` → `renderer.highlight(affects,
   'affected')`.
4. `render/svg/index.ts`: `'affected'` en `HIGHLIGHT_STYLES`. `styles.css`:
   anillo pulsante con `var(--accent)`, visible también en tema oscuro y sin
   depender de `timeScale` (animación CSS).
5. Datos: `affects` en **todos** los controles de los 10 laboratorios
   sueltos. En el vehículo, `scopedControls` (`modules/vehicle/index.ts`)
   antepone el prefijo a cada `affects`; los controles compartidos listan las
   piezas de cada sistema afectado.
6. Fallas (D1b): `FaultCatalogEntry.affects?: readonly string[]` en
   `core/types.ts`; `core/ui/faults.ts` recibe el mismo `onFocus` y lo dispara
   con la pieza dueña y `affects`; `render/svg/index.ts` lee `visual.faultCues`
   y pone `.fault-cue` sobre la pieza dueña de cada cue; pulso de 1,5 s (clase
   `.affected`) cuando una clave de `faults` pasa de sana a activa. CSS:
   `.fault-cue` con `var(--bad)` (aro fijo) distinto del anillo `.affected`
   (`var(--accent)`, pulsante). El vehículo antepone el prefijo a `affects`
   igual que a `part` (`scopedFaultCatalog`).
7. Datos: `affects` de síntomas en el catálogo de cada módulo, sólo donde el
   síntoma se ve en piezas distintas de la dueña (el resto usa sólo `part`).
8. Tests: (a) `tests/core/controls-affects.test.ts`: para cada módulo, todo
   control slider/toggle/select tiene `affects` (`[]` sólo si además trae
   `disabledWhen` y `disabledReason`) y cada id existe en las piezas; (b) lo
   mismo para `FaultCatalogEntry.part` y `affects`; (c) con una política que
   oculta una falla, `faultCues` no la incluye (no se delata en el juego).

Firefox: en cada laboratorio, (a) al arrastrar un slider se ilumina la pieza
correcta y se apaga ~1,5 s después de soltar; (b) al pasar el mouse por una
falla del panel se iluminan su pieza y sus síntomas; (c) al activarla hay un
pulso y queda un aro rojo fijo en la pieza rota; al desactivarla desaparece;
(d) tema oscuro incluido.

### H2 — Controles sin efecto (módulos)
1. `vehicle-70`/`vehicle-2000`: deshabilitar con motivo los que pisa el
   vehículo o que dependen de una batería fundida: `cooling:load`,
   `ignition:batteryV` y `cooling:batteryV` en `vehicle-2000`,
   `ignition:compression`, `fuel:fastConsumption`. (Lista de `AHORA.md`; se
   confirma leyendo `paramsView` en `modules/vehicle/compile.ts`.)
2. `vehicleSpeedKmh` (refrigeración) e `ignition:humidity`: leer
   `modules/cooling.md` y `modules/ignition.md`. Si la spec dice que actúan
   (flujo de aire por el radiador; humedad sobre la chispa con fallas), falta
   un canal en el presenter o una condición; se arregla y se agrega un test
   con rango (§14). Si no actúan, se quita el control y se anota en la spec.
3. Anotar en el CERRADO qué se decidió con cada uno, con la cuenta.

### V2 — Regiones, cámara y atenuado (render + vehículo)
1. `sim/circuit/translate.ts`: anota `region` en piezas y enlaces;
   `CircuitDef.regions` (`{ id, rect }`) para cada sistema.
2. `render/svg/index.ts`: `data-region` en cada elemento; `renderer.focus(
   regionId | null)`; cámara con interpolación exponencial del `viewBox`
   (≈ 400 ms reales, D6), respetando `preserveAspectRatio`.
3. `.dim` (opacidad ~0,25) sobre las regiones que no son la enfocada; el
   hover sobre una región atenuada la revela.
4. `core/shell.ts`: foco por control tocado (D4b), por pieza seleccionada, y
   `Esc`/clic en fondo para el conjunto.
5. Test de layout: para cada región, su `rect` contiene todos sus elementos
   (`checkLayout` ya corre sobre el vehículo compuesto).

Firefox (`vehicle-70` y `vehicle-2000`): al tocar un control de un sistema, la
cámara entra a ese sistema, se lee todo el texto sin acercar el navegador, y
los otros se ven atenuados; `Esc` vuelve al conjunto.

### V3 — Chasis y vista de conjunto (vehículo)
1. Dibujo del chasis en planta, dos versiones (`sedán70`, `compacto00`),
   colores por variables CSS, drawer nuevo `chassis` en el catálogo (§23).
2. `VehicleDef`: posición de cada sistema **dentro** del chasis (regiones de
   V2 recolocadas) y `chassis: 'sedan70' | 'compacto00'`. El `checkLayout`
   sigue en 0 problemas.
3. Vista de conjunto: por región, nombre grande e indicadores en vivo. Nuevos
   canales del presenter del vehículo: `rpm`, `coolantC`, `oilBar`, `batteryV`
   (desde el estado, ya calculados por los sistemas).
4. Umbral de zoom: por debajo de él, el diagrama se dibuja al 0,15 de opacidad
   y aparecen los indicadores; por encima, al revés (fundido continuo, no
   salto).

Firefox: al abrir cualquiera de los dos vehículos se reconoce un auto (es
distinto el de 1970 del de 2000) con sus sistemas dentro; los indicadores se
mueven al arrancar; al tocar un control o clicar una zona, la cámara entra.

## 4. Fuera de alcance

- Arrastrar piezas o armar el circuito (bloque G, `HORIZONTE_JUEGO.md`).
- Modelo 3D del auto.
- Rehacer el layout interno de cada sistema (sólo se recoloca la celda).
- Un panel de señales del vehículo (plan del vehículo §9).

## 5. Riesgos y qué se mira

- **Legibilidad en pantallas chicas.** Con una laptop 1366×768 el área central
  mide ~826×630; enfocar una región de 1300×720 da escala ~0,63. Es legible
  pero no cómodo; se acepta y se mide en Firefox antes de cerrar V2.
- **Rendimiento.** Animar `viewBox` cada frame fuerza repintado del SVG
  completo. Si con `vehicle-2000` baja de 60 fps, se mueve el `viewBox` sólo
  mientras dura la transición (ya es lo previsto) y se mide.
- **Regiones que se pisan** (un bus que cruza dos sistemas): el atenuado se
  decide por pieza, y los tubos de bus quedan con la región del proveedor. Si
  se ve raro, se anota en el CERRADO; no se rediseña en V2.

## 6. Preguntas abiertas para el usuario

1. ~~¿Sólo durante la interacción o también con las fallas?~~ **Respondida
   2026-09-29**: por ahora feedback inmediato en todo, tanto al mover un slider
   como al resaltar un problema (D1b). Queda fuera, por ahora, marcar cada
   cambio de valor que no venga de un control ni de una falla (p. ej. una
   presión que baja sola por el calentamiento); si hace falta se agrega después
   con el mismo estilo `affected`.
2. ¿Sedán para los 70 y compacto para 2000 (D5), o prefieres otra silueta
   (pickup, coupé)?
3. ¿Se acepta que `vehicleSpeedKmh` e `ignition:humidity` se quiten si la spec
   no les da efecto (D7)?
