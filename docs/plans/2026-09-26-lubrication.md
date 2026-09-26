# Plan A14 — Lubricación (`lubrication-gauge` y `lubrication-lamp`)

Fecha: 2026-09-26. Autor: agente planificador. El agente que implementa no
diseña: si algo falta o no cuadra, lo anota en el CERRADO o pregunta.

**Orden de lectura**:
1. `docs/modules/lubrication.md` completo (spec).
2. Este plan.
3. Código: `src/modules/fuel/circuit.ts` (módulo compilado con red
   hidráulica + eléctrica), `src/sim/elements/{hydraulic,passive}.ts`, lo que
   dejaron A11–A13 en `src/sim/signals/` y `src/sim/elements/`
   (`variableOrifice`, `centrifugalPump`, `currentLoad`).

## 1. Qué se entrega

- Elementos nuevos: `displacementPump` (lo reusan el carburador —bomba
  mecánica, con `pMax`— y la dirección asistida) y `linearRestrictor`.
- Control nuevo `drain` en el `tank` (litros por hora que se pierden sin
  pasar por la red; lo usa el goteo del cárter).
- El módulo con dos descriptores y sus drawers.

## 2. Elementos (primero, con tests en `tests/sim/elements.test.ts`)

- `displacementPump` (in, out, `hydraulic`): params `disp` (L/rev), `slip`
  (L/h/bar), `pMax` (bar; `0` = sin límite), `wearQ` (default 0,5; el
  carburador usa 0,8). Control `n` (rpm), `air`,
  `wear` (0..1), `slipFactor` (escala la fuga interna; la usa la
  viscosidad). Ley: `q = disp·n·60·(1 − wearQ·wear)·(1 − air)·lim −
  slip·slipFactor·(1 + 4·wear)·Δp`, con `lim = pMax > 0 ? √⁺(1 − Δp/pMax)`
  suave : 1` y `Δp = p_out − p_in`. Jacobiano analítico.
- `linearRestrictor` (a, b): `q = g·(Pa − Pb)`, control `g`.
- `tank.control.drain`: en `commit`, `level −= drain/3600·dt·(fast?100:1)`.
- Filas en `docs/modules/solver.md` §6 y la lista de `CONTRATOS.md` §4.10.

## 3. Archivos del módulo

```
src/modules/lubrication/
  constants.ts   tabla de la spec §5 + grados + VARIANTS (gauge, lamp)
  circuit.ts     LUBRICATION_DEF(variant) (red oil + eléctrica del testigo)
                 + createLubricationModel(variant)
  controllers.ts lubeCore: viscosidad → g de cojinetes y slipFactor (publica
                 también `lubrication.viscosity`, spec §12); aire
                 (nivel, curvas, cavitación, antirretorno); daño y
                 agarrotamiento; testigo y manómetro; señales
  faults.ts specs.ts content.ts narrate.ts present.ts index.ts lubrication.css
src/render/svg/drawers/lubrication/
  sump.ts gearPump.ts reliefValve.ts oilFilter.ts gallery.ts bearing.ts
  warningLamp.ts oilGauge.ts
tests/lubrication/{model,faults,content}.test.ts
```

Tocar: `src/sim/elements/{hydraulic,passive,index}.ts`,
`src/render/svg/drawers/index.ts`, `src/modules/registry.ts`, alias
`lubrication → lubrication-lamp`.

El circuito del testigo: `battery.+ → key → warningLamp (resistor 60 Ω) →
pressureSwitch (switch) → masa`. La batería del laboratorio es un stub
(13,8 V con el motor en marcha, 12,6 detenido).

## 4. Pasos

1. `npm view typescript-eslint peerDependencies`.
2. §2 con tests.
3. Red hidráulica con viscosidad fija (100 °C, 10W-40): test 2 de la spec.
   Calibrar sólo si un valor sale del rango, y anotarlo en la spec §5.7.
4. `lubeCore` completo: tests 3–13.
5. Variantes, catálogo, contenido, narración, presenter, presets.
6. Drawers.
7. Test 14, checklist, `npm run check`.

## 5. Decisiones ya tomadas

- El aire por nivel lo calcula el controlador (spec §5.4), no el
  `pickupAir` del `tank` (que es lineal y no deja agarrotar con 1 L).
- El daño de cojinetes es **estado**, no falla (§2: el modelo no escribe
  fallas). La falla `bearingWear` y el daño se combinan con `max`.
- Daño acelerado ×1000 (laboratorio), dicho en la narración.
- `changeOil()` sólo toca estado (nivel, suciedad visible); no limpia
  fallas.

## 6. Checklist de Firefox (va a `AHORA.md`)

`#/lab/lubrication-lamp`:
1. Llave en `on`: testigo prendido; al arrancar se apaga en < 1 s.
2. "Arranque en frío": presión al tope y la válvula de alivio abierta;
   al calentar (subir `oilTempC`) baja la presión en ralentí.
3. "Cojinetes gastados": en ralentí caliente se prende el testigo; al
   acelerar se apaga.
4. "Poco aceite en las curvas": al subir `lateralG` aparecen burbujas y
   parpadea el testigo.
5. "Filtro tapado": la chapaleta de bypass se abre.
6. "Motor sin aceite": el daño sube hasta que se agarrota (narración).
7. `antiDrainbackFailed`: tras 60 s detenido, al arrancar hay unos segundos
   sin presión.

`#/lab/lubrication-gauge`: el manómetro sigue la presión y se ve el filtro
de cartucho. Los demás laboratorios y el quiz siguen funcionando.
