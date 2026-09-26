# Plan A11 — Ciclo de 4 tiempos y distribución (`four-stroke`)

Fecha: 2026-09-26. Autor: agente planificador. **El agente que implementa no
diseña**: todo lo que necesita está en la spec y en este plan. Si algo falta
o no cuadra, lo anota en el CERRADO (o pregunta al usuario) en vez de
inventar.

**Orden de lectura** (y nada más):
1. `docs/modules/four-stroke.md` completo (la spec: física, fallas, vista,
   tests con rangos).
2. Este plan.
3. Código de referencia: `src/modules/fuel/{circuit,controllers,present,faults,specs,index}.ts`
   (cómo se arma un módulo), `src/sim/controllers/{base,engineCore,stubs}.ts`,
   `src/sim/circuit/{compile,types}.ts`, `src/render/svg/{index,types}.ts` y
   un drawer (`src/render/svg/drawers/hydraulic.ts`).

## 1. Qué se entrega

- El módulo `four-stroke` con dos descriptores (`four-stroke-ohv`,
  `four-stroke-dohc`) y la ruta vieja `#/lab/four-stroke` redirigida.
- La infraestructura que estrena este módulo y que usan los que siguen:
  - **Bus de señales de laboratorio** (`src/sim/signals/`).
  - **Mecanismos compilados sin red**: `compileCircuit` con un `CircuitDef`
    que no tiene elementos de solver.
- Tres drawers nuevos (`cylinderSection`, `timingDrive`, `pvDiagram`) y
  uno chico (`compressionBars`).

## 2. Infraestructura común (se hace primero, con tests propios)

### 2.1. Bus de señales — `src/sim/signals/bus.ts`

Contrato (el mismo que el plan del vehículo §5; A15 hará la versión que
valida dueños):

```ts
export interface SignalBus {
  get(id: string): number;
  set(owner: string, id: string, value: number): void;
  commit(): void;
  snapshot(): Readonly<Record<string, number>>;
}

/** Bus de laboratorio: las señales que no publica el sistema salen de stubs. */
export function createLabBus(options: {
  owner: string;                                   // el sistema del laboratorio
  publishes: readonly string[];                     // señales que escribe
  stubs: Readonly<Record<string, (params: Readonly<ParamRecord>) => number>>;
  sameStep?: readonly string[];                     // p. ej. engine.crankAngle
}): SignalBus & { bindParams(params: Readonly<ParamRecord>): void };
```

- `get` de una señal publicada devuelve el valor del paso anterior (o del
  mismo paso si está en `sameStep`); `get` de una señal con stub evalúa el
  stub con los params del modelo (stubs **dinámicos**: p. ej. `intake.map`
  sale de `throttle`). Una señal desconocida devuelve 0 y, en tests, lanza.
- `set` con un owner distinto de `options.owner` lanza (§28).
- La tabla de stubs ideales vive en `src/sim/signals/stubs.ts` y **extiende**
  (no reemplaza) `sim/controllers/stubs.ts`: `ignition.spark = 1`,
  `ignition.advance = 10`, `intake.map = −0,65 + 0,65·throttle`,
  `air.ratio = 1`, `air.massFlow` (fórmula de la spec del carburador §5.1),
  `engine.rpm = rpm`, `engine.load = throttle`, `engine.compression = 1`,
  `engine.cylinderBalance = 1`, `lubrication.pressure = 3`,
  `engine.coolantTemp = 90`, `electrical.crankVoltage = 12,6`,
  `fuel.mixture = 1`, `exhaust.backpressure = 0`, `vehicle.speed = 0`, y
  el resto de la tabla de stubs del plan del vehículo §5.3 (ruedas,
  dirección, suspensión, correa).
  Cada módulo puede pisar un stub con uno propio atado a su param (p. ej.
  four-stroke: `lubrication.pressure = params.oilPressure`).
- **Stub de fase** (`createPhaseStub()` en `stubs.ts`): un stub con estado
  que el bus avanza en cada paso (`step(dt, params)`) integrando
  `engine.crankAngle` desde `params.rpm` y publicando
  `engine.camAngle = crankAngle − params.camOffset` (0 si no existe). Lo usan
  los laboratorios que leen la fase y no la producen (encendido,
  combustible en A15). Por eso un stub es `(params) => number` **o**
  `{ step(dt, params): void; get(): number }`. four-stroke no lo usa: él es
  el dueño de la fase.
- En el laboratorio, el bus lo avanza un controlador `labBus` que el módulo
  pone **primero** en su lista (así `compileCircuit` no cambia). En cada paso
  hace `commit()` (lo escrito en el paso anterior pasa a ser lo que se lee)
  y después `step(dt)` (avanza los stubs con estado). Las señales same-step
  se ven apenas se escriben.
- Tests (`tests/sim/signals.test.ts`): latencia de un paso, same-step, stub
  dinámico, stub de fase (a 600 rpm avanza 3,6° por paso), owner equivocado
  lanza, `snapshot` estable.

El combustible **no** se migra a este bus (sigue con su `FuelSignals`); A15
lo adapta.

### 2.2. Mecanismo sin red

Un mecanismo es un `ControllerDef` (contrato de `sim/controllers/base.ts`)
con su estado y su integrador propio. Para el laboratorio se compila con
`compileCircuit` igual que un circuito:

- `CircuitDef` con `parts` sólo de tipo `visual` (el `VISUAL_TYPE` de
  `fuel/circuit.ts` se mueve a `src/sim/elements/visual.ts` y se exporta en
  `ELEMENT_TYPES` como `visual`; `fuel/circuit.ts` lo importa de ahí),
  `links: []` y `controllers: [{ id: 'fourStroke', type: 'fourStroke' }]`.
- `compileCircuit` con 0 nodos: la revisión del plan comprobó que
  `createSolver` con `nodeCount = 0` ya converge (1 iteración); igual
  **verificar primero** que `createSolver`
  con `nodeCount = 0` hace `step` sin fallar (`solveDense` con `n = 0`). Si
  falla, arreglarlo en `src/sim/solver/nodal.ts` con un test
  (`tests/sim/nodal.test.ts`: "red vacía converge en 0 iteraciones") y
  anotarlo en el CERRADO como cambio de core.
- El controlador recibe el bus en su fábrica (como `createEngineCore`
  recibe `signals`): `createFourStroke(id, params, { bus, variant })`.

## 3. Archivos

Crear:

```
src/sim/signals/bus.ts            createLabBus + tipo SignalBus
src/sim/signals/stubs.ts          SIGNAL_STUBS (tabla §2.1)
src/sim/elements/visual.ts        VISUAL_TYPE (movido desde fuel)
src/sim/engine/geometry.ts        s(θ), V(θ), dV/dθ, alzada(θ, eventos, lash), presión
                                  de compresión estimada (la usa también el encendido,
                                  A12: los módulos no se importan entre sí, §11)
src/modules/four-stroke/
  constants.ts     K de la spec §5 (+ VARIANTS: ohv, dohc)
  gas.ts           subpaso del gas de un cilindro (spec §5.4), puro
  timing.ts        camOffset, holgura, chavetero, daño, choque (spec §5.2, §5.6, §5.7)
  mechanism.ts     createFourStroke(): ControllerDef (integra todo, publica señales)
  circuit.ts       FOUR_STROKE_DEF(variant) (layout visual) + createFourStrokeModel(variant)
  faults.ts        catálogo §26 (spec §4), por variante
  specs.ts         controls, faults, readouts, presets (spec §3, §7, §10)
  content.ts       PartInfo de cada pieza (qué es / para qué / cómo / fallas)
  narrate.ts       reglas de la spec §9
  present.ts       esquema de canales (spec §8)
  index.ts         dos descriptores: fourStrokeOhv, fourStrokeDohc
  four-stroke.css  estilos de los drawers (sólo variables CSS)
src/render/svg/drawers/engine/
  cylinder.ts      cylinderSection
  timing.ts        timingDrive (con el inset del chavetero)
  pv.ts            pvDiagram
  bars.ts          compressionBars
tests/sim/signals.test.ts
tests/four-stroke/{geometry,gas,timing,model,faults,content}.test.ts
```

Tocar:

- `src/sim/elements/index.ts` (registrar `visual`), `src/modules/fuel/circuit.ts`
  (importar `VISUAL_TYPE` de su nuevo lugar; sin otro cambio).
- `src/render/svg/drawers/index.ts` (registrar los 4 drawers).
- `src/modules/registry.ts` (los dos descriptores) y `src/core/router.ts`
  (redirección `four-stroke` → `four-stroke-dohc`; si el router no tiene
  alias, se agrega un mapa de alias con test en `tests/game/router.test.ts`).
- `docs/CONTRATOS.md`: §4.10 agrega `visual` a la lista de elementos y una
  §4.11 corta "Bus de señales de laboratorio" (la firma de §2.1).
- `docs/modules/solver.md` §6: fila `visual`.

## 4. Pasos (un commit al final; se puede commitear por paso si el check está verde)

1. `npm view typescript-eslint peerDependencies` (Contexto común 7).
2. §2.1 bus + stubs con sus tests.
3. §2.2 `VISUAL_TYPE` movido; verificar el solver con 0 nodos.
4. `sim/engine/geometry.ts` + `gas.ts` con los tests 1, 2, 5, 6, 7 y 15 de la spec
   §11. `gas.ts` es una función pura `stepGas(cyl, θ0, θ1, entradas) →
   cyl'` con subpasos de ≤ 1°; así los tests no necesitan el modelo.
5. `timing.ts` con los tests 8–11.
6. `mechanism.ts`: integra ángulo, fase, los 4 cilindros (desfases 0, 540,
   180, 360), torque, prueba de compresión y señales. Tests 3, 4, 12, 13 y
   14.
7. `circuit.ts` + `index.ts` + specs/content/faults/narrate/present. Tests de
   contenido como `tests/fuel/content.test.ts` (toda pieza del diagrama
   tiene `PartInfo`, todo id §26 existe en `parts`, todo preset usa claves
   válidas).
8. Drawers + CSS. Los drawers dibujan la geometría una vez y en `update`
   sólo mutan atributos (§9); colores por variables CSS.
9. Checklist de Firefox en `AHORA.md` (abajo) y `npm run check`.

## 5. Decisiones ya tomadas (no se reabren)

- **Sin arrastre del cigüeñal con el mouse**: el modo manual usa el slider
  `crankDeg`. Los drawers no emiten intents (CONTRATOS 6.4); si el usuario
  lo pide, es una tarea aparte.
- **Los 4 cilindros se simulan siempre**; se dibuja uno.
- **Subpasos internos de ≤ 1°** en el gas: el paso de la simulación sigue
  siendo 1 ms (§4); lo fija el test 15.
- **Daño acelerado ×1000** del perno flojo: es un laboratorio, se dice en la
  narración.
- **Fallas por cilindro** con partId `cylN` (§26), no una falla con selector.
- La chispa del laboratorio es un control (`spark`), no una falla.

## 6. Checklist de Firefox (va a `AHORA.md` al cerrar)

`#/lab/four-stroke-dohc`:
1. A 120 rpm (preset "Cámara lenta") se ven los 4 tiempos en orden, el
   nombre cambia en PMS/PMI, las válvulas abren y cierran donde dice la
   spec §5 y el cruce se resalta con `showOverlap`.
2. El P-V dibuja el lazo: con chispa, un lazo con área; sin chispa, casi una
   línea (ida y vuelta).
3. "Prueba de compresión" llena las 4 barras entre 12,5 y 14 bar; con
   anillos gastados en el 3 la barra 3 queda baja.
4. "Chavetero ovalado": en el inset se ve el piñón con juego sobre el eje;
   al subir la carga, la marca de la leva se separa de la referencia y se
   escucha/ve el golpeteo.
5. "Perno flojo": el chavetero se abre solo hasta que la chaveta se corta;
   la marca de la leva se va quedando atrás.
6. "Saltaron dos dientes": aparece el aviso de choque y la compresión de un
   cilindro cae.
7. Tensor hidráulico con presión 0,2: la cadena se comba y hay ruido; con 3
   bar se tensa.
8. `#/lab/four-stroke-ohv` dibuja varillas y balancines; `rocker.lash`
   baja la alzada y hace tic-tic.
9. `#/lab/four-stroke` redirige a la versión DOHC. El combustible y el quiz
   siguen funcionando.

## 7. Qué NO hace A11

Nada del vehículo (`compileVehicle`, bus con dueños validados, inset en el
diagrama del vehículo): eso es A15. No toca `engineCore`.
