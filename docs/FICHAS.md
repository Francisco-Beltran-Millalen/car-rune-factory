# Fichas de tarea — lo que lee el agente

Doc vivo. Hay **una ficha por tarea pendiente**, en orden de ejecución.
Reemplaza a las fichas de `plans/2026-09-25-simulacion-antes-que-juego.md`
§6 y a los agregados de `plans/2026-09-26-sistemas-genericos.md` §5.

## Cómo se lee

1. `AGENTS.md`, `ARCHITECTURE.md`, `AHORA.md` y `CONTRATOS.md` (siempre).
2. La sección **Contexto común** de este archivo.
3. **Tu ficha**. Cada ficha nombra **dos documentos**, en este orden: la
   **spec** del sistema (`docs/modules/<id>.md`: la física, las fallas, la
   vista y los tests con rangos) y el **plan** de implementación
   (`docs/plans/2026-09-26-<id>.md`: archivos, pasos, decisiones y la
   checklist de Firefox). Los dos los escribió el agente planificador y ya
   están revisados. **No se lee nada más** salvo el código que nombre el
   plan.

**Reparto de trabajo** (2026-09-26, pedido del usuario): el agente
planificador escribe todos los planes y specs; **el agente que implementa
no diseña ni escribe planes**. Si algo del plan falta, no cuadra con el
código o un rango de test es imposible con la física de la spec, se
pregunta al usuario o se anota en el CERRADO con la cuenta; no se
improvisa. Ajustar una constante para que un rango cuadre sí está
permitido (ARCHITECTURE §14): se documenta en la spec.

Si una ficha choca con un plan viejo, **manda la ficha**. En los planes
viejos, las rutas `.js` se leen como `.ts`.

Abreviaturas: **P23** = `plans/2026-09-23-arquitectura-juego.md`.

**No leer en ninguna tarea**: el plan maestro, la hoja de ruta,
`2026-09-24-motor-y-juice.md`, `2026-09-25-a3-revision.md`,
`2026-09-25-simulacion-antes-que-juego.md`,
`2026-09-26-alcance-auto-completo.md`, `2026-09-26-sistemas-genericos.md`
y P23 (salvo la sección exacta que nombre un plan). Lo vigente de todos
ellos ya está en las specs, los planes nuevos y aquí.

---

## Contexto común (decisiones vigentes del usuario)

1. **Laboratorio antes que juego** (2026-09-25). El laboratorio no oculta
   nada y vale por sí solo, como herramienta para aprender mecánica. El
   juego (se oculta el estado y se diagnostica con herramientas) empieza
   sólo cuando el usuario lo escriba en `AHORA.md`. El quiz (etapas 1 y 2
   del combustible) ya existe y **tiene que seguir jugable** en cada tarea.
2. **El auto completo, de 1970 a 2010, sólo combustión interna**
   (2026-09-26). Importan sobre todo los antiguos.
3. **Por sistema, no por auto** (2026-09-26). No se modelan autos reales.
   Cada sistema es un **arquetipo** que encapsula los conceptos de sus
   variantes de época:
   - si la física es la misma, la variante es una **pieza
     intercambiable** del mismo sistema (platinos o transistor cortando la
     misma bobina);
   - si la física es otra, es un **sistema hermano** que publica las mismas
     señales (el carburador y la inyección publican `fuel.mixture`).
   Cada variante implementada es **su propio descriptor y su propia ruta**
   (`ignition-points`, `ignition-cop`), generados por el mismo código; la
   ruta vieja sin sufijo redirige a la moderna.
4. Cada spec tiene su sección **Arquetipo y variantes**: qué se implementa
   (por defecto la más antigua y la más común) y qué queda registrado.
5. **Carrocería y chasis**: sólo inspección visual (A25). La soldadura es
   un minijuego muy a futuro (`HORIZONTE_JUEGO.md`).
6. **Un agente a la vez, en orden, en una sola línea de trabajo** (`main` en local; la rama de la sesión en la nube, ver `AGENTS.md` regla 8). Cada tarea cierra con
   `npm run check` en verde, un bloque CERRADO en `AHORA.md` (con la
   checklist de Firefox del plan) y un commit.
7. Al empezar cada tarea: `npm view typescript-eslint peerDependencies`. Si
   acepta TS 7, se avisa en `AHORA.md` (la migración es una tarea aparte).

### Convenciones de todos los sistemas (las fija el plan del vehículo)

- **Señal de una tarea posterior**: se usa su stub de
  `plans/2026-09-26-vehiculo.md` §5.3 hasta que llega el dueño (p. ej. A20
  lee `wheel.speed*` de A21; A22 lee `steering.angle` de A23; A23 lee
  `wheel.pressure*` de A24). No se inventan stubs.
- **Señales §28**: la tabla de dueños está en
  `plans/2026-09-26-vehiculo.md` §6 (y desde A15 en `CONTRATOS.md` §4.11).
  Cada spec dice en su §12 qué publica y qué lee.
- **Bus de laboratorio**: cada laboratorio lee lo que no produce desde
  `createLabBus` (`src/sim/signals/`, lo crea A11) con stubs ideales y
  dinámicos (§29).
- **Mecanismos** (4 tiempos, tren motriz, suspensión, ruedas): un
  `ControllerDef` con integrador propio, compilado con `compileCircuit`
  sobre un `CircuitDef` sin elementos de red (sólo piezas `visual`).
- **Elementos nuevos** van a `src/sim/elements/`, con test de ley y
  jacobiano en `tests/sim/elements.test.ts` y su fila en `solver.md` §6.
  Los crea la primera tarea que los necesita (lo dice su plan) y los
  siguientes los reusan.
- **Drawers** nuevos en `src/render/svg/drawers/<sistema>/`; geometría una
  vez, `update` sólo muta atributos (§9); colores por variables CSS.
- **Conexiones visuales (plan V1, 2026-09-26; contrato en `CONTRATOS.md`
  §6.4)**. Vale para toda tarea con vista, aunque su plan no lo diga:
  1. Cada drawer nuevo exporta, en su mismo archivo, su `GeometryFn`: la
     caja del cuerpo (lo que dibuja, sin etiquetas), los **puertos sobre el
     borde** con los nombres de los puertos del elemento, y las
     `subparts` que dibuja adentro (con sus puertos si llevan cable o tubo).
     Se registra en `DRAWERS` como `{ geometry, draw }`.
  2. En el `CircuitDef`, un enlace que se ve lleva `visual` (con su
     `pipeClass`); los codos van en `via`; **las puntas nunca se escriben**
     (salen de la geometría). Todos los tramos son horizontales o
     verticales. Los enlaces sólo del modelo (referencias, térmicos) van sin
     `visual`.
  3. Una pieza de red que no tenga cuerpo propio se dibuja igual: como
     sub-pieza de otro drawer, como `hosePoint` (un tramo de manguera con
     nombre) o se une con `joinedBy`. Un nudo con un solo tubo dibujado es
     un error.
  4. Las etiquetas del drawer no van donde entra un tubo (el chequeo no las
     ve): a un costado del puerto.
  5. Masa: si el retorno es por la carrocería o el bloque, el enlace a
     `battery.-` va sin `visual` y el drawer dibuja `.ground-mark`.
- **Aceptación de toda tarea con vista** (además de la de su ficha):
  `tests/render/layout.test.ts` sin errores (corre en `npm run check` y
  cubre solo al laboratorio nuevo por estar en el registro) y la hoja de
  `npm run layout` (`layout-sheets/<id>.svg`) revisada por el agente antes
  de dejar la checklist de Firefox. La checklist incluye "ninguna manguera
  ni cable termina en el aire ni cruza el cuerpo de otra pieza".
- **Límite del solver**: ±1 bar (o 1 V, 1 °C) por iteración y 25
  iteraciones: una entrada que salte mucho en un paso se limita en su
  controlador (frenos lo hacen explícito).

---

## A15 — Laboratorio del vehículo

- **Plan**: `docs/plans/2026-09-26-vehiculo.md` (v3), secciones §3–§10 y
  §12. Las specs de A11–A14 y A16 (§12 de cada una) dicen qué publica y qué
  lee cada sistema.
- **Qué es**: `compileVehicle`, el bus del vehículo con dueños validados,
  `engineCore` con entradas reales (§4.8), los dos vehículos genéricos
  (`vehicle-70` y `vehicle-2000`, §8), el panel de señales, el elemento
  `breach` y el benchmark commiteado.
- **Aceptación**: la del plan §15 + la checklist en Firefox (una falla de
  un sistema se ve en otro, en los dos vehículos) + conexiones visuales
  (Contexto común): `translateCircuit` desplaza `x/y` **y los `via`** (ya no
  hay `route`), prefija también `joinedBy`, y `checkLayout` corre sobre el
  vehículo compuesto: dos sistemas no pueden pisarse ni cruzarse los tubos
  de uno por el cuerpo del otro.
- **Al cerrar**: preguntar al usuario el orden del bloque S2 (A17–A25) y si
  abre la puerta del bloque G.

---

## Bloque L — legibilidad y foco (antes del bloque S2)

Nace de la revisión en Firefox del 2026-09-29. Se hace en dos checkpoints:

- **C1 — los 10 laboratorios sueltos se entienden y están revisados**:
  R0 → U1 → H1 → H2 → R1. Plan: `docs/plans/2026-10-05-checkpoint-c1.md`
  (lectura lineal; para H1 y H2 reemplaza al plan del 09-29).
- **C2 — el vehículo se entiende**: V2 → V3. Plan:
  `docs/plans/2026-09-29-legibilidad-y-foco.md`, con los ajustes de §4 del
  plan de C1 (D-C1: el `realDt` del renderer entra en V2).

**L0** (realDt hasta el modo) quedó cerrado el 2026-10-05 (`AHORA.md`).

## R0 — Revisión del usuario en Firefox (sin código)

- **Plan**: C1 §5 "R0". El agente sólo anota lo que diga el usuario en
  `AHORA.md`. Un bug de física o de dibujo que salga se arregla antes de U1,
  como FIX aparte con su test.

## U1 — Tests de UI en DOM y `shell.ts` partido

- **Plan**: C1 §4 (D-C2, D-C3, D-C4) y §5 "U1". **Necesita**: R0.
  `happy-dom` ya está instalado; patrón en `tests/render/parts-dom.test.ts`.
- **Qué es**: tests que arman los paneles y el shell en un DOM de test (los
  de los paneles se escriben primero, contra el código de hoy);
  el resaltado por capas (la de juego se comporta como hoy, `affected` aparte);
  `core/shell.ts` partido en
  `shell.ts`, `mount.ts` y `ui/sidePanels.ts` sin cambio de conducta.
- **Aceptación**: los tests nuevos fallan si se quita el `container.append(fs)`
  de `createControlsPanel`; `shell.ts` ≤ ~300 líneas; un laboratorio y el quiz
  se ven igual en Firefox.

## H1 — `affects` y resaltado de controles y de fallas

- **Plan**: C1 §4 (D-C2, D-C8, D-C9) y §5 "H1". **Necesita**: U1.
- **Qué es**: cada control declara las piezas que toca (`affects`), y el
  panel las resalta mientras se lo usa (y 1,5 s después); lo mismo para las
  fallas (pieza dueña + síntomas; aro fijo mientras estén activas y visibles;
  pulso al activarse; el renderer por fin consume `faultCues`). Datos en los
  10 laboratorios y prefijados en el vehículo. Cada `affects` se decide
  leyendo el controlador, no el nombre, y sólo con piezas dibujadas (D-C8:
  se valida en DOM).
- **Aceptación**: el test de `affects` recorre todo el registro; en cada
  laboratorio, al arrastrar un slider se ilumina la pieza correcta y se apaga
  ~1,5 s tras soltarlo; tocar un control no borra la selección ni el `target`
  del quiz; en el quiz no aparece ningún aro de falla.

## H2 — Controles con efecto lento, condicional o pisado

- **Plan**: C1 §4 (D-C5, D-C7) y §5 "H2". **Necesita**: H1.
- **Qué es**: `hint` en los controles de efecto lento o condicional
  (`vehicleSpeedKmh`, `ambientC`, `humidity`, `lateralG`: **sí** tienen
  efecto, ver D-C7); `VehicleDef.overridden` con la tabla medida de D-C5 y un
  test de paridad que la mantiene honesta. No se cambia física sin un test
  con rango (§14).

## R1 — Revisión de cierre de C1 (usuario)

- **Plan**: C1 §5 "R1" y §6. Al cerrar, preguntar al usuario: ¿C2 o S2?

## V2 — Regiones, cámara y atenuado del vehículo

- **Plan**: plan del 09-29 §2 (D3, D4, D4b) y §3 "V2", más C1 §4 D-C1:
  `renderer.update(visual, simDt, realDt)`; la cámara usa `realDt`, las
  partículas siguen con `simDt`. **Necesita**: C1 cerrado.
- **Aceptación**: en `vehicle-70` y `vehicle-2000`, tocar un control lleva la
  cámara al sistema, el texto se lee sin acercar el navegador, y `Esc`
  vuelve al conjunto.

## V3 — Chasis y vista de conjunto

- **Plan**: §2 (D5) y §3 "V3". **Necesita**: V2.
- **Aceptación**: se reconoce un auto, distinto el de 1970 del de 2000, con
  indicadores en vivo por sistema.
- **No empezar** hasta que el usuario responda las preguntas de §6 del plan.

---

## Bloque S2 — resto del auto (después de A15; el orden lo elige el usuario)

**Desde C1** (plan de C1, D-C6): todo sistema nuevo declara `affects` en
sus controles y en su catálogo de fallas, y `hint`/`disabledReason` donde
corresponda; el test de `affects` recorre el registro, así que sin eso
`npm run check` no pasa.

Orden sugerido por dependencias: A17 → A18 → A19 → A20 → A21 → A22 → A23 →
A24 → A25. Cada ficha dice qué necesita antes.

## A17 — Eléctrico: batería, arranque y carga

- **Spec**: `docs/modules/electrical.md` · **Plan**:
  `docs/plans/2026-09-26-electrical.md`.
- **Necesita**: A15. Pasa a ser el proveedor del bus `12v` en los dos
  vehículos.

## A18 — Admisión

- **Spec**: `docs/modules/intake.md` · **Plan**:
  `docs/plans/2026-09-26-intake.md`.
- **Necesita**: A15. Crea el bus `vacuum` y retira lo provisional de
  `engineCore`.

## A19 — Escape

- **Spec**: `docs/modules/exhaust.md` · **Plan**:
  `docs/plans/2026-09-26-exhaust.md`.
- **Necesita**: A15 y A18. Agrega el fluido `exhaust` y el lazo cerrado de
  la ECU en el vehículo moderno.

## A20 — Frenos

- **Spec**: `docs/modules/brakes.md` · **Plan**:
  `docs/plans/2026-09-26-brakes.md`.
- **Necesita**: A15 y **A18** (usa `gasOrifice` y el servo cuelga del bus
  de vacío).

## A21 — Tren motriz

- **Spec**: `docs/modules/drivetrain.md` · **Plan**:
  `docs/plans/2026-09-26-drivetrain.md`.
- **Necesita**: A15. Cambia `engineCore` (rpm dinámicas, torque).

## A22 — Suspensión

- **Spec**: `docs/modules/suspension.md` · **Plan**:
  `docs/plans/2026-09-26-suspension.md`.
- **Necesita**: A15 (mejor después de A21).

## A23 — Dirección

- **Spec**: `docs/modules/steering.md` · **Plan**:
  `docs/plans/2026-09-26-steering.md`.
- **Necesita**: A15 (mejor después de A22).

## A24 — Ruedas y neumáticos

- **Spec**: `docs/modules/wheels.md` · **Plan**:
  `docs/plans/2026-09-26-wheels.md`.
- **Necesita**: A15 (mejor después de A22 y A23).

## A25 — Carrocería y chasis: inspección

- **Spec**: `docs/modules/body.md` · **Plan**:
  `docs/plans/2026-09-26-body.md`.
- **Necesita**: A15.

---

## Sin ficha todavía

- **Turbo y diésel** (💭 en `SISTEMAS.md`): sin plan hasta que el usuario
  diga si entran en el alcance (son combustión interna de la época, pero no
  estaban en lo conversado).
- **Bloque G — juego** (A3, G1, A8, D-motor, A9): en espera de la puerta.
  Sus fichas y planes los escribe el planificador cuando el usuario abra la
  puerta.
