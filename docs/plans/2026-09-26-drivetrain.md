# Plan A21 — Tren motriz (`drivetrain-rwd` y `drivetrain-fwd`)

Fecha: 2026-09-26. Autor: agente planificador. Bloque S2, **después de
A15**. Cambia `engineCore` (rpm dinámicas): es la tarea más delicada del
bloque. El agente que implementa no diseña: si algo falta o no cuadra, lo
anota en el CERRADO o pregunta.

**Orden de lectura**:
1. `docs/modules/drivetrain.md` completo (spec).
2. Este plan.
3. Código: lo que dejó A11 (`src/modules/four-stroke/mechanism.ts`: cómo
   se arma un mecanismo sin solver sobre `compileCircuit`, y el bus de
   laboratorio), `src/sim/controllers/engineCore.ts` y lo que dejó A15
   (`compileVehicle`, bus del vehículo).

## 1. Qué se entrega

- El módulo (mecanismo) con dos descriptores.
- `engineCore` con `engine.torque`, `engine.load` por torque, rpm
  dinámicas y regulador de ralentí **sólo cuando el vehículo tiene tren
  motriz** (spec §12).
- `vehicle.speed` real en los dos vehículos (la refrigeración ya la lee).

## 2. Archivos

```
src/modules/drivetrain/
  constants.ts   tabla de la spec §5.1 + VARIANTS (rwd, fwd)
  engineStub.ts  puro: Tmax, Tf, regulador de ralentí (§5.2)
  clutch.ts      puro: Karnopp con traba (§5.3)
  gearbox.ts     puro: sincronización, raspado, salida de marcha (§5.4)
  vehicle.ts     puro: fuerzas y dinámica longitudinal (§5.5)
  noises.ts      puro: eventos y vibración (§5.7)
  mechanism.ts   createDrivetrain(): ControllerDef
  circuit.ts     layout visual + createDrivetrainModel(variant)
  faults.ts specs.ts content.ts narrate.ts present.ts index.ts drivetrain.css
src/render/svg/drawers/drivetrain/
  clutchSection.ts gearbox.ts driveshaft.ts halfShafts.ts differential.ts
  carSide.ts tachometer.ts noiseWave.ts
tests/drivetrain/{clutch,gearbox,vehicle,noises,model,faults,content}.test.ts
tests/sim/engineCore-dynamic.test.ts
```

Tocar: `src/sim/controllers/engineCore.ts` (modo dinámico opcional:
`EngineCoreOptions.dynamics?: { readClutch(): …; readInertia(): … }`; sin
la opción, idéntico a hoy), `src/sim/signals/stubs.ts` si falta algún
stub, `CONTRATOS.md` §4.11 (filas nuevas), los `VehicleDef` (sistema
`drivetrain`: `rwd` en `vehicle-70`, `fwd` en `vehicle-2000`),
`registry.ts`, `drawers/index.ts`, alias.

## 3. Pasos

1. `npm view typescript-eslint peerDependencies`.
2. Módulos puros con sus tests (embrague con traba: la parte más
   delicada; probar que trabado/destrabado no tiembla — test 11).
3. `mechanism.ts` + modelo del laboratorio: tests 1–10.
4. `engineCore` dinámico: test de que **sin** la opción, todas las suites
   existentes dan igual (combustible, vehículo); con la opción, el motor
   sostiene el ralentí y sigue a la caja.
5. Vehículos con tren motriz: las rpm ya no son un control del panel
   (el panel del vehículo pasa a acelerador, embrague, marcha y freno).
   El test de equivalencia de A15 se corre **sin** tren motriz (tal como
   estaba) y se agrega uno nuevo: en 5.ª a 100 km/h el vehículo moderno
   queda estable (±50 rpm).
6. Contenido, narración, presenter, presets, drawers.
7. Test 12, checklist, `npm run check`.

## 4. Decisiones ya tomadas

- Mecanismo con integrador propio (no el solver): no hay una red útil y el
  embrague con traba es discreto.
- Ruidos como eventos visuales + texto (sin audio: el audio llega con el
  "juice", bloque G).
- Automática y 4x4 registradas, no se hacen.
- El acople motor–tren trabado se integra con la inercia total en
  `engineCore` (spec §5.6), no con un retraso de 1 ms entre dos inercias.

## 5. Checklist de Firefox (va a `AHORA.md`)

`#/lab/drivetrain-fwd`:
1. "Salir en 1.ª": al soltar el embrague las dos curvas de rpm (motor y
   caja) se juntan y el auto avanza.
2. "Aceleración 0–100": cambia a 5500 rpm y marca ~11–12 s.
3. "Embrague gastado en subida": el motor sube de vueltas sin que suba la
   velocidad; el embrague se calienta.
4. "No desembraga: raspa": al meter 1.ª detenido, aparece el raspado.
5. "Clac en las curvas": sólo con la dirección girada y acelerando.
6. Soltar el embrague en 3.ª desde parado: el motor se para.

`#/lab/drivetrain-rwd`: el cardán gira; "Golpe de cruceta" al soltar el
acelerador; "Aullido del diferencial" sube con la velocidad.
Vehículos: se maneja con acelerador, embrague y marchas; la temperatura
del motor responde al aire de marcha.
