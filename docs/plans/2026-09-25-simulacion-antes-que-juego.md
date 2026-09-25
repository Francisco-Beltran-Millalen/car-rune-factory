# Plan: simulación antes que juego (nuevo orden de tareas)

Fecha: 2026-09-25. Lo decidió el usuario el mismo día. **Reordena** las
tareas de `plans/2026-09-23-arquitectura-juego.md` (§9) y
`plans/2026-09-24-motor-y-juice.md` (§2). Esos planes no se editan: el
**qué** de cada tarea sigue ahí, y este plan cambia **cuándo** se hace y
cómo se conectan las tareas. La tabla viva está en `AHORA.md`.

## 1. La decisión

Palabras del usuario:

> "La vista de laboratorio es para ver el flujo completo del sistema e
> incluso […] cómo se relacionan los sistemas entre sí. Lo otro es el
> juego […] hay que esconder el flujo de información y solamente usar
> herramientas para diagnosticar. […] Lo primero es hacer la vista de
> laboratorio en donde no se oculta nada, y cuando veamos que las
> simulaciones estén funcionando correctamente, empezamos a desarrollar ya
> la jugabilidad."
>
> "Si no engancha como juego está bien, porque igual esta herramienta sirve
> mucho para aprender […] mecánica. […] Vale la pena hacer los sistemas
> antes de hacer la jugabilidad."

En consecuencia:

1. **Hay dos vistas.** El **laboratorio** no oculta nada y es la
   herramienta para aprender. El **juego** oculta el estado interno y se
   diagnostica con herramientas (vista de taller, enmienda
   `2026-09-25-a3-revision.md`).
2. **El laboratorio va primero, y se vale por sí solo.** Se hacen el
   solver, los sistemas y el laboratorio del vehículo (sistemas
   relacionados) antes de cualquier jugabilidad nueva.
3. El quiz (E1, A2) ya existe y **se conserva**: cada tarea mantiene
   jugables sus dos etapas.
4. El motivo del plan motor-y-juice para hacer A3 primero ("validar temprano
   que el juego engancha") deja de ser prioridad: si no engancha, el
   laboratorio igual cumple su propósito.

Evidencia a favor, de la revisión de hoy: el diagnóstico sobre la física
actual habría salido con fallas que no producen su síntoma (colador tapado,
relé intermitente, bomba al 80 %). Con la simulación primero, el juego se
construye sobre síntomas confiables.

## 2. Orden nuevo

```
Bloque S — simulación y laboratorio
  A4  Solver nodal + linalg
  A5  Elementos + circuito (compile/validate) + controladores base
  A6  Combustible sobre el solver (+ fuel/faults.ts mínimo, ver §3.1)
  A6b Síntomas del combustible: calibrar fallas débiles
  A7  Presenter + renderer SVG genérico del laboratorio (se desbloquea, §3.2)
  A10 Plan del vehículo y del laboratorio del vehículo (sin código)
  A11 Ciclo de 4 tiempos
  A12 Encendido
  A13 Refrigeración
  A14 Lubricación
  A15 Laboratorio del vehículo (sistemas relacionados)

Bloque G — juego (cuando el usuario diga que la simulación está bien)
  A3  Diagnóstico E2 (enmienda 2026-09-25-a3-revision.md; volver a medir)
  G1  Checkpoint de juego
  A8  Prueba de juice → D-motor (decisión del usuario)
  A9  Armar circuitos (E4)
  Casos entre sistemas (plan propio, sección 14 del plan 2026-09-23)
```

Entre los dos bloques hay una **puerta**: el bloque G empieza sólo cuando el
usuario lo escriba en `AHORA.md`. Ningún agente lo decide por su cuenta.

Hay un solo agente a la vez, todo en `main` y en orden. A11–A14 pueden
reordenarse si el usuario lo pide; el orden por defecto es el de `NORTE.md`.

## 3. Qué cambia en cada tarea

### 3.1 A6 ya no depende de A3

El plan 2026-09-23 hacía depender A6 de A3 porque el compilador traduce las
claves planas (`filterClog`) a ids §26 (`filter.clog`) con `fuel/faults.ts`,
y ese archivo lo creaba A3. Ahora **A6 crea `src/modules/fuel/faults.ts`**
con los campos que la física necesita:

```ts
{ id: 'filter.clog', modelKey: 'filterClog', part: 'filter', kind: 'severity', healthy: 0 }
```

La tabla de ids y modelKeys es la de la §4.6 del plan 2026-09-23 (8
fallas). `visibility`, `repair` y `symptoms` son datos del juego y los
agrega A3 después, sin cambiar los ids. `faultCatalog` entra al descriptor
del módulo en A6, y el `FaultCatalogEntry` en `core/types.ts` con esos
campos opcionales.

### 3.2 A7 se desbloquea: el laboratorio es SVG

El plan motor-y-juice dejaba A7 esperando a D-motor, que a su vez esperaba
G1 y A3. Con el juego al final, esa espera bloquearía todos los sistemas
nuevos. **Decisión: el renderer del laboratorio es SVG** (lo pide el
propósito: diagramas claros, clickeables, tema oscuro; §10, D6). A7 se hace
como decía el plan 2026-09-23 §8.5:

- `src/presenter/**`: `VisualState` desde el modelo compilado (contrato 6.5).
- `src/render/svg/**`: `createSvgRenderer` con drawers por tipo (§23).
- Coordenadas de `fuel/view.ts` → `fuel/circuit.ts` (layout como dato).
- `legacyRenderer` y `fuel/view.ts` se borran al alcanzar la paridad.
- Además de la paridad del laboratorio, el renderer nuevo tiene que cumplir
  lo que hoy usa el quiz: `applyUi` (ocultar `.part-label`, tooltips),
  `highlight(partIds, style)` con los 4 estilos, y `selectPart`/`hoverPart`
  por clic y hover. Las 2 etapas del quiz siguen jugables (checklist).
- **Canales pensados para la vista de taller futura**: cada animación que
  delata estado (aguja, flujos, rotor, diafragma, spray, suciedad) sale de
  un canal con nombre del presenter. No se implementa `ModeUi.instruments`
  (eso es de A3), pero el presenter queda listo para filtrar por canal.

**D-motor queda acotada al juego.** Si más adelante se elige Phaser para
el juego o el armado, el laboratorio sigue en SVG y ese costo (dos
catálogos de drawers) se evalúa en A8 con la pregunta 7. Es una excepción
aceptada al punto 6 de motor-y-juice §1.

### 3.3 A6b — síntomas del combustible (tarea nueva, sólo física)

Después de la paridad de A6. Se calibra con el **modelo compilado** y se
replica en la referencia, o se deja la referencia congelada y se documenta
la divergencia (lo decide el agente con la cuenta en `fuel.md`, §14):

- `strainer.clog`: a 1,0 no produce síntoma (a fondo, pRail 3,02 y
  `running`). Tiene que producir al menos falta de fuerza a fondo. En el
  circuito del solver, el colador va en la **aspiración** (entre `tank` y
  `pump.in`).
- `relay.state = 'intermittent'`: en 30 s en marcha no sale de `running`
  (pRail mínimo 2,34). Un corte tiene que notarse (tironeo o apagón breve).
- `pump.wear`: hoy sólo a 1,0 da `misfire` a fondo. Revisar si la curva es
  razonable (una bomba al 80 % en la realidad ya se nota en subida).

Aceptación: un test por falla que fija el síntoma (estado del motor y
lecturas en el escenario "contacto → arranque → ralentí → fondo"). Las
cifras de hoy están en la tabla de la sección 1 de
`2026-09-25-a3-revision.md`.

### 3.4 A10 incluye el laboratorio del vehículo

A10 sigue siendo **sólo plan** (plan 2026-09-23 §14.4, con revisión
adversaria). Además de `VehicleDef`, buses, señales y `compileVehicle`,
tiene que diseñar la **vista del laboratorio del vehículo**, que es lo que
el usuario pidió explícitamente ("ver cómo se relacionan los sistemas entre
sí"):

- varios sistemas a la vez, con sus flujos visibles;
- las señales compartidas a la vista (`engine.rpm`, `engine.state`,
  tensión del bus de 12 V…) y quién es dueño de cada una (§28);
- una falla en un sistema muestra su efecto en otro, por ejemplo: batería
  débil → la bomba de bencina y las bobinas se resienten a la vez;
- los stubs ideales (§29) se ven como stubs cuando un sistema está solo.

A10 va **antes** de A11–A14 para que cada sistema nazca con sus señales,
buses y stubs definidos.

### 3.5 A11–A14 — sistemas (reemplazan T7–T10 del plan maestro)

Para cada sistema, en este orden:

1. **Spec** en `docs/modules/<id>.md` al nivel de `fuel.md`: piezas,
   params, fallas con ids §26, física con unidades, estado, lecturas,
   narración, presets y tests con rangos. Hoy los `.md` de 4 tiempos,
   encendido, refrigeración y lubricación son de nivel de diseño.
2. **Plan** en `docs/plans/AAAA-MM-DD-<id>.md`, con los elementos nuevos
   del solver que haga falta y sus tests analíticos.
3. Código: elementos o controladores nuevos, `circuit.ts`, contenido,
   descriptor y tests. Laboratorio con el renderer SVG genérico (A7).
4. Checklist de Firefox en `AHORA.md`: el usuario mira el laboratorio del
   sistema.

Preguntas que cada plan responde (no se deciden aquí):

- **A11 4 tiempos** es un mecanismo, no una red: no usa el solver (D4).
  Necesita su propia vista (corte del cilindro + diagrama P-V), fuera del
  catálogo de drawers de redes. Publica `engine.compression` (§28).
- **A12 encendido** es eléctrico (solver), con bobina (inductancia),
  transistor y sensor de cigüeñal. Hay que ver si el paso de 1 ms alcanza
  para el pulso de la bobina, o si hace falta un subpaso o un modelo
  promediado.
- **A13 refrigeración** necesita calor y temperatura. Decidir si se agrega
  un dominio térmico al solver (temperatura como potencial, calor como
  flujo: encaja en el mismo esquema nodal) o si se usa un modelo aparte.
  §30: fluido `coolant`.
- **A14 lubricación** es hidráulica (solver) con fluido `oil` y viscosidad
  dependiente de la temperatura (señal `engine.coolantTemp` o `oilTemp`).

### 3.6 A15 — laboratorio del vehículo

Implementa lo que A10 diseñó (`compileVehicle`, `engineCore` con entradas
reales, la vista del vehículo). Es el cierre del bloque S y el punto donde
el usuario decide si se abre la puerta del bloque G.

## 4. Lo que no cambia

- Las leyes §1–§33 y los contratos. `npm run check` en verde para cerrar
  cualquier tarea (§32).
- La física del combustible no cambia en A4–A7: A6 exige paridad con el
  modelo de referencia. Los cambios de física van en A6b, documentados.
- `plans/2026-09-25-a3-revision.md` sigue vigente para A3, con la nota de
  volver a medir.
- motor-y-juice §3 (G1), §4 (A8) y §6 (cues) siguen vigentes, ahora dentro
  del bloque G.
- TS 7: al empezar cada tarea, correr
  `npm view typescript-eslint peerDependencies`.

## 5. Checkpoints del usuario (§13) en el bloque S

| Después de | Qué mira el usuario en Firefox |
|---|---|
| A6 | El laboratorio del combustible se ve y se comporta igual, ahora sobre el solver (checklist del combustible + quiz 1/2) |
| A6b | Cada falla del combustible produce su síntoma (checklist por falla) |
| A7 | Paridad visual con el laboratorio actual, tema oscuro, quiz 1/2 |
| A11–A14 | El laboratorio de cada sistema |
| A15 | El laboratorio del vehículo: una falla de un sistema se ve en otro |
