# Plan A17 — Eléctrico (`electrical-dynamo` y `electrical-alternator`)

Fecha: 2026-09-26. Autor: agente planificador. Bloque S2: se hace
**después de A15** (usa `engineCore` con las reglas del plan del vehículo
§4.8 y el bus `12v` del vehículo). El agente que implementa no diseña: si
algo falta o no cuadra, lo anota en el CERRADO o pregunta.

**Orden de lectura**:
1. `docs/modules/electrical.md` completo (spec).
2. Este plan.
3. Código: `src/sim/elements/electric.ts`, `src/modules/fuel/circuit.ts`
   (parte eléctrica), lo que dejó A15 (`compileVehicle`, bus del vehículo,
   proveedores de bus) y `src/sim/controllers/engineCore.ts`.

## 1. Qué se entrega

- Elementos nuevos en `src/sim/elements/electric.ts`: `variableResistor`,
  `dcMotor`, `generator`, `fuse` (spec §5.1), con tests de ley y jacobiano.
- El módulo con dos descriptores, `starterCore` y `chargingCore`.
- **El cambio de proveedor del bus en los dos vehículos**: el eléctrico pasa
  a ser el proveedor de `12v`; combustible y encendido sueltan su fuente
  (en el vehículo; sus laboratorios no cambian).

## 2. Archivos

```
src/modules/electrical/
  constants.ts    tabla de la spec §5 + VARIANTS (dynamo, alternator)
  battery.ts      puro: OCV(SOC), R(SOC, sulfatación, frío), park(h)
  circuit.ts      ELECTRICAL_DEF(variant) + createElectricalModel(variant)
  starter.ts      starterCore (spec §5.2)
  charging.ts     chargingCore: alternador/dínamo, regulador, disyuntor,
                  testigo, sobrecarga (§5.3, §5.6)
  faults.ts specs.ts content.ts narrate.ts present.ts index.ts electrical.css
src/render/svg/drawers/electrical2/
  batteryCells.ts starterMotor.ts generator.ts regulatorBox.ts fuse.ts
  lamp.ts ammeter.ts
tests/electrical/{battery,starter,charging,model,faults,content}.test.ts
```

Tocar: `src/sim/elements/{electric,index}.ts`, `docs/modules/solver.md` §6,
`CONTRATOS.md` §4.10 y §4.11 (filas de `starter.rpm`, `belt.slip`,
`charging.lamp`, `lubrication.viscosity`; `electrical.crankVoltage` deja de
ser provisional), los `VehicleDef` de `vehicle-70` y `vehicle-2000`
(sistema `electrical` + proveedor del bus), `src/modules/registry.ts`,
`src/render/svg/drawers/index.ts`, alias de ruta. (`lubrication.viscosity` ya
la publica la lubricación desde A14; A17 no toca ese módulo, §12.)

## 3. Pasos

1. `npm view typescript-eslint peerDependencies`.
2. Elementos con tests (incluye el fusible: test 1 de la spec).
3. `battery.ts` puro con sus tests (OCV, R, `park`).
4. Circuito + `starterCore` con `engineCore` de vehículo y stubs: tests 2 y
   3. Si el arranque no converge al cerrar el solenoide (escalón de
   ~150 A), usar la conmutación suave de conductancia del plan del
   vehículo §8 y anotarlo.
5. `chargingCore`: tests 4–9 y 11.
6. `park` y test 10. Test 12.
7. Vehículos: el eléctrico como proveedor del bus; test de A15 de "un solo
   proveedor" en verde; el test de equivalencia del vehículo moderno con el
   laboratorio del combustible se re-mide (la batería ahora tiene
   resistencia real) y se documenta la diferencia en `fuel.md` §9c si la
   hay.
8. Descriptores, contenido, narración, presenter, presets, drawers.
9. Checklist y `npm run check`.

## 4. Decisiones ya tomadas

- El arranque es un `dcMotor` en el solver + un integrador mecánico en el
  controlador (τ ≈ 0,1 s ≫ 1 ms).
- El generador es una fuente de corriente regulada, no un modelo trifásico;
  el rizado del diodo abierto es un canal visual.
- La carga del motor al girar depende de la viscosidad (señal nueva
  `lubrication.viscosity`).
- La correa de accesorios es una sola pieza; su dueño es este sistema y la
  refrigeración la lee por señal.

## 5. Checklist de Firefox (va a `AHORA.md`)

`#/lab/electrical-alternator`:
1. Llave en `start`: el piñón engrana, la corriente sale de la batería
   (partículas hacia el partidor), la tensión baja a ~11 V y el motor parte.
2. En marcha el testigo se apaga y las partículas vuelven hacia la batería
   (carga); al prender faros + soplador + desempañador en ralentí, la
   corriente se equilibra.
3. "Masa del motor corroída": la batería marca bien, el partidor gira lento
   y la lectura "caída en la masa" delata el problema.
4. "Batería a medias en invierno" y "Escobillas gastadas": no parte.
5. "Regulador pasado": sube la tensión, burbujas en la batería, se queman
   los faros.
6. "Corto en los faros": se funde el fusible; `replaceFuse` lo repone.
7. "Se descarga estacionado": `park(72)` y no parte.

`#/lab/electrical-dynamo`: en ralentí casi no carga; a 2500 rpm sí; el
amperímetro lo muestra; "Disyuntor pegado" descarga la batería detenido.

`#/lab/vehicle-70` y `#/lab/vehicle-2000`: el bus lo provee el eléctrico y
una batería débil se nota a la vez en el arranque, la bomba y el encendido.
