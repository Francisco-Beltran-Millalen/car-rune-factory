# Plan: motor de juego, juice y hasta dónde llega el prototipo

> **Aviso (2026-09-25).** Su orden (§2) ya no rige: lo reemplaza `2026-09-25-simulacion-antes-que-juego.md`. A7 ya **no** espera a D-motor (el laboratorio es SVG). §3, §4 y §6 siguen vigentes sólo para el bloque G (juego).

Fecha: 2026-09-24. Acordado con el usuario el mismo día. **No elige motor**:
fija *cuándo* y *cómo* se decide, y qué se hace mientras tanto. Enmienda el
orden de A7–A9 del plan `2026-09-23-arquitectura-juego.md` (que no se
edita: lo vivo es `AHORA.md`).

## 1. Qué se acordó

1. **El juice importa.** Esto es un juego, no una página: SFX, VFX, tweens y
   una UI práctica es lo que separa un juego bueno de uno malo. A medida que
   el proyecto madure se van a necesitar herramientas de motor de juego. Se
   asume que **probablemente habrá motor**; la pregunta es cuándo.
2. **El juice amplifica un loop que funciona; no lo arregla.** El pilar 0
   (NORTE: "diagnosticar es el juego") se valida con texto y diagramas. El
   prototipo (SVG + DOM) llega hasta que el **diagnóstico (E2, A3)** se pueda
   jugar en el navegador y el usuario confirme que el loop engancha.
3. **La decisión de motor la toma el usuario después del checkpoint G1**
   (sección 3), con la idea validada en el navegador. No antes.
4. **Motor web en TS por defecto.** Con un motor web (Phaser 4; PixiJS si
   sólo falta dibujo) se conservan sim, solver, modos, intents, contenido,
   guardado y tests: sólo cambia `render/`. Un motor externo (Godot, Unity,
   Bevy) obliga a reescribir todo en otro lenguaje. Sólo se considera si
   cambia el objetivo (nativo, consolas, 3D pesado), cosa que hoy NORTE
   descarta.
5. **La UI sigue en DOM**, también con motor: HUD en HTML/CSS sobre el canvas,
   con su propio juice (transiciones, animaciones CSS). La UI dentro del
   canvas es el punto débil de Phaser (no tiene un sistema de layout).
6. **Un solo renderer para el diagrama.** Mezclar SVG (laboratorio) y Phaser
   (armado) obliga a mantener dos catálogos de dibujos por tipo de pieza
   (§23) a medida que crecen los sistemas. Sólo se acepta mezclar si se
   justifica con números (p. ej. el armado usa pocos tipos).

## 2. Orden nuevo

```
TS0–TS5 (plan 2026-09-24-typescript-estricto)
  → A3  Diagnóstico E2, todavía en SVG (prototipo)
  → G1  Checkpoint de juego en el navegador (el usuario)      ← se decide si seguir
  → A8  Prueba de juice (motor candidato vs. SVG)              ← en paralelo con A4–A6
  → D-motor  Decisión del usuario (docs/decisiones/0001-motor.md)
  → A7  Presenter + renderer del motor elegido                 ← cambia según la decisión
  → A9  Armar circuitos (E4)
A4 → A5 → A6 no dependen del motor: siguen como están (solver y física).
```

Qué cambia respecto del plan 2026-09-23:
- **A8 va antes de A7**, no después. Antes, A7 construía el renderer SVG
  genérico con todos sus dibujos y recién después se probaba Phaser. Si la
  prueba elegía Phaser, A7 se tiraba.
- **A8 deja de ser "prueba con Phaser" y pasa a ser "prueba de juice"**
  (sección 4): mide lo que el usuario quiere del motor, contra la misma
  cosa hecha en SVG.
- **A7 queda condicionada a D-motor** (sección 5).

## 3. G1 — Checkpoint de juego (después de A3)

Lo hace el usuario en Firefox (§13). El agente que cierra A3 deja en
`AHORA.md` la checklist de A3 **y además** estas preguntas, para que el
usuario las responda por escrito en `AHORA.md`:

1. ¿Las 3 etapas de diagnóstico se juegan de principio a fin sin ayuda
   externa?
2. ¿Encontrar la falla se siente como **razonar con pistas** (leer el
   manómetro, descartar sospechosos) o como adivinar?
3. ¿Da ganas de jugar la siguiente etapa? ¿Por qué sí o por qué no?
4. ¿Qué momentos piden juice a gritos? (Ej.: "al conectar el manómetro
   debería sonar algo", "cuando revienta la fuga quiero verlo".) Esta lista
   es la entrada de A8.
5. ¿Qué parte de la UI estorba o es lenta de usar?

Resultado:
- **Loop validado** → se hace A8.
- **Loop no validado** → se itera sobre A3 (reglas, pistas, herramientas)
  antes de pensar en motor. El juice no se agrega para tapar un loop débil.

## 4. A8 — Prueba de juice

En `main`, como todo (no se crean ramas). **Desechable**: el código de la prueba
vive en `src/render/phaser/spike/` y `src/render/svg-spike/`, y después de
D-motor lo que no se use se borra en un commit propio (la historia queda
en git). Lo que queda es la decisión y sus números. Puede correr en paralelo con A4–A6:
sólo necesita el contrato de `VisualState` (plan 2026-09-23, §4.5) y un
`VisualState` armado a mano con el circuito del combustible (no espera a
que A6 compile el circuito real).

Candidato principal: `phaser` (verificar versión con `npm view phaser
version` antes; el 2026-09-23 era 4.2.1 y trae tipos en `types/phaser.d.ts`).
Comparación: **la misma escena en SVG + DOM** con pointer events, Web Audio
y Web Animations. Sin la versión SVG, "se siente mejor" no tiene contra qué
compararse.

Cada pregunta se responde con una medición o con la opinión del usuario
en el navegador, y se anota en `docs/decisiones/0001-motor.md`:

| # | Pregunta | Cómo se mide |
|---|---|---|
| 1 | **SFX**: un sonido por evento (acierto, error, herramienta conectada, pieza reemplazada), con volumen global y sin retraso perceptible | usuario en Firefox |
| 2 | **Tweens**: pieza correcta/incorrecta con rebote o sacudida; aparición de una lectura | usuario |
| 3 | **VFX**: chorro de una fuga, burbujas de aire en el riel, flujo con ~300 partículas | usuario + FPS |
| 4 | **Arrastrar y encajar**: pieza con snap a grilla de 10, puerto compatible resaltado (radio 16), conexión puerto a puerto y borrarla | usuario: ¿cuál se siente mejor? |
| 5 | **HUD DOM sobre el canvas**: paneles actuales encima o al lado, con redimensionado de ventana y tema claro/oscuro (colores desde variables CSS) | usuario |
| 6 | **Escala del vehículo** (A10): 4 sistemas a la vez (~80 piezas, ~1500 partículas), zoom y paneo | FPS en la máquina del usuario, las dos versiones |
| 7 | **Costo por tipo de pieza**: cuántas líneas cuesta dibujar y animar un tipo (p. ej. `electricPump`) en cada una | contar |
| 8 | **Reloj**: la sesión impulsada desde el `update` de la escena con `session.tick(delta/1000)` (D9) | test/manual |
| 9 | **Bundle**: tamaño antes y después de `vite build`, con Phaser cargado con `import()` dinámico (§17) | número |
| 10 | **Leyes**: las escenas de Phaser son `class` (excepción de §18 ya prevista en el lint, plan TS §5.4); ¿algo más choca con §1–§33? | lista |

La entrada de las preguntas 1–3 es la lista de G1.4: se prueban los
momentos que el usuario pidió, no ejemplos genéricos.

## 5. D-motor — la decisión (del usuario)

Con `docs/decisiones/0001-motor.md` escrito, el usuario elige una de:

| Opción | Cuándo | Qué pasa con A7 |
|---|---|---|
| **Phaser (o el candidato) para todo el diagrama** | gana en juice y en escala, y el costo por tipo es razonable | A7 = presenter + `phaserRenderer` + dibujos por tipo en Phaser. El laboratorio SVG (legacy) sigue hasta que Phaser lo iguale y después se borra |
| **SVG para todo, juice con Web Audio/Animations** | el SVG alcanza en escala y el juice se logra sin motor | A7 = presenter + `svgRenderer` genérico, como decía el plan 2026-09-23. La pregunta se reabre si aparece un techo (G1.4 o escala) |
| **Mezcla** (SVG en lab, motor en armado) | sólo si la pregunta 7 muestra que el armado usa pocos tipos | se documenta el costo de mantener dos catálogos |
| **Seguir iterando el prototipo** | la prueba no convence ni para uno ni para otro | A7 espera; se sigue con A4–A6 |

`ARCHITECTURE.md` §17 ("salvo Phaser una vez aprobado en A8") se actualiza
según lo que se elija.

## 6. Gancho de juice desde ya (A3 en adelante)

Para que el juice se enchufe después **sin tocar la simulación ni los
modos**, los modos emiten eventos ricos desde ahora:

- Todo `ModeEvent` que se refiere a una pieza lleva `data.partIds`.
- **Propuesta para A3** (la decide y documenta el agente de A3 en
  `CONTRATOS.md` §6.3): un campo opcional `data.cue: string`, un id semántico
  estable del momento (`'diag.faultFound'`, `'tool.attach'`,
  `'quiz.correct'`, `'part.replaced'`, `'budget.low'`…). Hoy nadie lo lee.
  Mañana, una capa de FX (`src/fx/`: tabla `cue → sonido/VFX/tween`) lo
  consume desde el shell/renderer. El modo sigue puro (§21): anuncia *qué
  pasó*, no *cómo se ve ni cómo suena*.
- Los cues se nombran como API estable, igual que los ids de fallas (§26):
  la tabla de FX y los tests dependen de ellos.

Costo: unas líneas por evento en A3. No agrega dependencias ni toca el
render.

## 7. Qué no cambia

- TS0–TS5 van primero y no dependen de esto (y abaratan cualquier motor web).
- A4–A6 (solver, elementos, combustible sobre el solver) no dependen del
  motor.
- Los paneles siguen en DOM con cualquier motor (D6 del plan 2026-09-23).
- La verificación visual sigue siendo manual en Firefox (§13): no se agregan
  herramientas de automatización de navegador para medir FPS; lo mira el
  usuario con el contador del motor o el de las herramientas de Firefox.
