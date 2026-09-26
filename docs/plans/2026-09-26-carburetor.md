# Plan A16 — Carburador (`carburetor`)

Fecha: 2026-09-26. Autor: agente planificador. El agente que implementa no
diseña: si algo falta o no cuadra, lo anota en el CERRADO o pregunta.

**Orden de lectura**:
1. `docs/modules/carburetor.md` completo (spec).
2. Este plan.
3. Código: `src/modules/fuel/{circuit,controllers,present}.ts` (el sistema
   hermano: mismo fluido, mismas convenciones), lo que dejaron A11–A14 en
   `src/sim/signals/` y `src/sim/elements/` (`displacementPump`,
   `variableOrifice`), y `src/render/svg/drawers/{hydraulic,injector}.ts`.

## 1. Qué se entrega

- Elemento nuevo `flowSource` (caudal impuesto de `a` a `b`; control `q`
  en L/h; jacobiano cero). Test de ley en `tests/sim/elements.test.ts`.
- El módulo `carburetor` (un descriptor) con su red de bencina, el
  controlador `carbCore` y los drawers.

## 2. Archivos

```
src/modules/carburetor/
  constants.ts   tabla de la spec §5
  venturi.ts     puro: Δpv, h, φ, proporción de régimen, choke,
                 vaporización (spec §5.2); tests sin modelo
  transient.ts   puro: retraso de la bencina y bomba de aceleración (§5.3)
  circuit.ts     CARB_DEF (red de §5.4 + layout) + createCarburetorModel()
  controllers.ts carbCore: lee aire/map/rpm/temperatura del bus, nivel de
                 la cuba (sonda), escribe `needleValve.open`,
                 `mechPump.n`, `jets.q` y la señal `fuel.mixture`
  faults.ts specs.ts content.ts narrate.ts present.ts index.ts carburetor.css
src/render/svg/drawers/carburetor/
  carbBody.ts floatBowl.ts mechPump.ts choke.ts
tests/carburetor/{venturi,transient,model,faults,content}.test.ts
```

Tocar: `src/sim/elements/{hydraulic,index}.ts` (`flowSource`),
`docs/modules/solver.md` §6 y `CONTRATOS.md` §4.10 (la fila),
`src/render/svg/drawers/index.ts`, `src/modules/registry.ts`.

`air.massFlow` sale del stub del bus de laboratorio (A11 lo dejó en
`src/sim/signals/stubs.ts` con la fórmula de la spec §5.1; si no está, se
agrega ahí con su test). La bomba mecánica usa `displacementPump` con
`slip = 0`.

## 3. Pasos

1. `npm view typescript-eslint peerDependencies`.
2. `flowSource` con su test.
3. `venturi.ts` + `transient.ts` con los tests 3, 4 (parte pura) y 7.
4. Red + `carbCore`: tests 2, 5, 6, 8–11. Calibrar sólo constantes; anotar
   en la spec §5.5 cualquier cambio con la cuenta.
5. Catálogo, contenido, narración, presenter, presets.
6. Drawers.
7. Test 12, checklist, `npm run check`.

## 4. Decisiones ya tomadas

- La mezcla se calcula como proporción sobre el aire medido (spec §1); la
  red del solver es sólo la bencina.
- Por construcción el carburador sano da 1,00 en régimen; las fallas y el
  tornillo lo sacan de 1 en su zona. No se modela el enriquecimiento de
  potencia (válvula de potencia) ni el doble cuerpo.
- Choke manual (param); el automático queda registrado.
- La fuga del diafragma de la bomba mecánica es una fuga a la atmósfera en
  el laboratorio (spec §12).
- `fuel.mixture` se publica como fracción (1 = la calibrada), igual que la
  inyección.

## 5. Checklist de Firefox (va a `AHORA.md`)

`#/lab/carburetor`:
1. En ralentí sale bencina por el orificio bajo la mariposa; al subir rpm y
   mariposa empieza a pulverizar el surtidor del venturi y el de ralentí se
   apaga.
2. La cuba: el flotador sube, la aguja cierra, y la bomba mecánica late con
   la excéntrica.
3. "Partida en frío con choke": sin choke la mezcla queda en ~50 %; con
   choke tirado, ~100 %. "Se olvidó el choke": rica.
4. "Tironea al pisar": al mover la mariposa de golpe la mezcla cae un
   momento; con la bomba sana se ve el chorro y no cae.
5. "Se ahoga": la cuba rebalsa y la mezcla se dispara.
6. "Se para en la subida": a fondo la cuba baja hasta vaciarse.
7. Combustible, 4 tiempos, encendido, refrigeración, lubricación y quiz
   siguen funcionando.
