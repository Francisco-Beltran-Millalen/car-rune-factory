# Plan A22 — Suspensión (`suspension-classic` y `suspension-modern`)

Fecha: 2026-09-26. Autor: agente planificador. Bloque S2, **después de
A15** (idealmente después de A21, que publica `vehicle.speed` y
`vehicle.accel`; si no está, usa stubs). El agente que implementa no
diseña: si algo falta o no cuadra, lo anota en el CERRADO o pregunta.

**Orden de lectura**:
1. `docs/modules/suspension.md` completo (spec).
2. Este plan.
3. Código: un mecanismo ya hecho (`src/modules/four-stroke/mechanism.ts` o
   `src/modules/drivetrain/mechanism.ts`), el bus de laboratorio
   (`src/sim/signals/`) y el drawer `noiseWave` de A21.

## 1. Qué se entrega

El módulo (mecanismo, sin solver) con dos descriptores: 4 cuartos de auto,
camino con semilla, geometría, ruidos, prueba de rebote y señales.

## 2. Archivos

```
src/modules/suspension/
  constants.ts   tabla de la spec §5.1 + VARIANTS (classic, modern)
  quarterCar.ts  puro: paso semi-implícito de una esquina (§5.1)
  road.ts        puro: perfiles con rng por distancia (§5.2)
  geometry.ts    puro: altura, caída, convergencia, tirón (§5.3)
  noises.ts      puro: detección de golpes/traqueteo (§5.4)
  mechanism.ts   createSuspension(): ControllerDef
  circuit.ts faults.ts specs.ts content.ts narrate.ts present.ts index.ts
  suspension.css
src/render/svg/drawers/suspension/
  cornerFront.ts cornerRear.ts leafSpring.ts carSideSuspension.ts roadStrip.ts
tests/suspension/{quarterCar,road,geometry,model,faults,content}.test.ts
```

Tocar: `CONTRATOS.md` §4.11 (filas de la spec §12), los `VehicleDef`
(`classic` en `vehicle-70`, `modern` en `vehicle-2000`), `registry.ts`,
`drawers/index.ts`, alias.

## 3. Pasos

1. `npm view typescript-eslint peerDependencies`.
2. `quarterCar.ts` con los tests 1, 3 y 9 (puros).
3. `road.ts`, `geometry.ts`, `noises.ts` con sus tests.
4. `mechanism.ts` + modelo: tests 2, 4–8.
5. Contenido, narración, presenter, presets, drawers.
6. Checklist y `npm run check`.

## 4. Decisiones ya tomadas

- Sin dinámica lateral ni manejo (SISTEMAS: "modelo cuasiestático, sin
  manejo"); el cuarto de auto sí es dinámico porque la prueba de rebote y
  el agarre en el ripio lo necesitan.
- El camino se genera por **distancia** recorrida con el rng del modelo
  (§3): la trasera ve lo mismo que la delantera, con retraso.
- Los ruidos son eventos visuales (sin audio).

## 5. Checklist de Firefox (va a `AHORA.md`)

`#/lab/suspension-modern`:
1. "Prueba de rebote" en una esquina sana: sube y queda; con el
   amortiguador gastado, rebota varias veces.
2. "Camino de ripio con amortiguadores gastados": la rueda salta y la carga
   del neumático oscila mucho.
3. "Espiral cortado": esa esquina queda ~30 mm más baja y cambia su caída.
4. "Rótula con juego": golpes en los baches.
5. "Tira al frenar": con `braking` la rueda abre y aparece el tirón.

`#/lab/suspension-classic`: la ballesta con sus hojas; "Ballesta rota": el
eje se corre y el auto tira aunque no frene.
