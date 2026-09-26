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
6. **Un agente a la vez, en orden, todo en `main`.** Cada tarea cierra con
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
- **Límite del solver**: ±1 bar (o 1 V, 1 °C) por iteración y 25
  iteraciones: una entrada que salte mucho en un paso se limita en su
  controlador (frenos lo hacen explícito).

---

## A12 — Encendido (platinos y COP)

- **Spec**: `docs/modules/ignition.md`.
- **Plan**: `docs/plans/2026-09-26-ignition.md`.
- **Estrena**: el elemento `currentLoad`. **No** agrega capacitor ni
  inductancia (la spec §1 explica por qué).
- **Aceptación**: tests de la spec §11 y checklist del plan §5, con las
  dos variantes.

## A13 — Refrigeración

- **Spec**: `docs/modules/cooling.md`.
- **Plan**: `docs/plans/2026-09-26-cooling.md`.
- **Estrena**: el dominio `thermal` del solver, `heatSource`,
  `thermalConductance`, `advection`, `heatCapacity`, `centrifugalPump`,
  `variableOrifice`, `CircuitDef.initial` y `solver.setPotential`.
- **Aceptación**: tests de la spec §11 y checklist del plan §6.

## A14 — Lubricación

- **Spec**: `docs/modules/lubrication.md`.
- **Plan**: `docs/plans/2026-09-26-lubrication.md`.
- **Estrena**: `displacementPump`, `linearRestrictor` y el control `drain`
  del `tank`.
- **Aceptación**: tests de la spec §11 y checklist del plan §6.

## A16 — Carburador

- **Spec**: `docs/modules/carburetor.md`.
- **Plan**: `docs/plans/2026-09-26-carburetor.md`.
- **Estrena**: `flowSource`.
- **Aceptación**: tests de la spec §11 y checklist del plan §5.

## A15 — Laboratorio del vehículo

- **Plan**: `docs/plans/2026-09-26-vehiculo.md` (v3), secciones §3–§10 y
  §12. Las specs de A11–A14 y A16 (§12 de cada una) dicen qué publica y qué
  lee cada sistema.
- **Qué es**: `compileVehicle`, el bus del vehículo con dueños validados,
  `engineCore` con entradas reales (§4.8), los dos vehículos genéricos
  (`vehicle-70` y `vehicle-2000`, §8), el panel de señales, el elemento
  `breach` y el benchmark commiteado.
- **Aceptación**: la del plan §15 + la checklist en Firefox (una falla de
  un sistema se ve en otro, en los dos vehículos).
- **Al cerrar**: preguntar al usuario el orden del bloque S2 (A17–A25) y si
  abre la puerta del bloque G.

---

## Bloque S2 — resto del auto (después de A15; el orden lo elige el usuario)

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
