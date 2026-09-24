# Norte — qué estamos construyendo

**car-rune-factory** — un **juego de diagnóstico de autos en 2D**. Al estilo
de *¿Dónde está Carmen Sandiego?*: llega un caso ("el auto no parte en las
mañanas"), juntas pistas, descartas sospechosos y recién ahí acusas al
culpable. Aquí el culpable es una pieza, y el caso se resuelve **encontrando y
reparando** la falla, como en *Car Mechanic Simulator*, *Wrench* o *My Summer
Car*, pero en **diagramas 2D**, sin personaje, todo con el mouse y texto.

Para que el diagnóstico sea honesto, debajo hay un **simulador**: cada sistema
del auto es una simulación 2D esquemática. Se ve por dónde va el fluido (o la
corriente, o el calor), se tocan los controles, se provocan fallas y se leen
los números. Los sistemas **se entrelazan** (la bomba de bencina depende de la
batería; el motor necesita combustible, chispa, aire y compresión a la vez),
así que un síntoma puede venir de varios sistemas. Justamente ahí está el
juego. El mapa de qué sistema toca a cuál está en `SISTEMAS.md`.

Se llega por etapas: primero el laboratorio de cada sistema, luego jueguitos
cortos (nombrar piezas, diagnosticar dentro de un sistema, armar circuitos) y
al final **casos entre sistemas** sobre un auto completo.
(≤200 líneas; visión. Táctico en `AHORA.md`, reglas en `ARCHITECTURE.md`,
catálogo en `SISTEMAS.md`.)

Uso personal, en español. JavaScript puro + Vite, sin framework. Phaser es
el candidato para cuando llegue "armar circuitos" (ver `HORIZONTE_JUEGO.md`).

## Pilares

0. **Diagnosticar es el juego** — todo lo demás (simular, ver el flujo,
   romper cosas) existe para que encontrar la falla sea un razonamiento
   honesto con pistas reales, no adivinar.

1. **Aislar un sistema** — una simulación = un sistema del auto, con sólo las
   piezas necesarias para entenderlo. Ej.: estanque → bomba → filtro → riel →
   inyectores → regulador → retorno.
2. **Ver el flujo** — partículas que recorren las tuberías con velocidad
   proporcional al caudal; color según presión/temperatura; aire, fugas y
   goteos visibles.
3. **Tocar** — llave de contacto, RPM, acelerador, voltaje… cambian el
   comportamiento en vivo. Cámara lenta para ver lo rápido (inyectores,
   chispa, válvulas).
4. **Romper cosas** — fallas provocables (filtro tapado, bomba gastada,
   regulador pegado, fuga…) y ver el **síntoma**, no sólo la causa.
5. **Números reales** — bar, L/h, V, A, rpm, °C. Física aproximada pero
   coherente: las relaciones causa-efecto son correctas aunque no sea CFD.
6. **Que se explique solo** — cada pieza tiene ficha (qué es, para qué sirve,
   cómo falla) y una barra "¿Qué está pasando?" narra el estado actual.

## Módulos (orden de prioridad; el estado real está en `AHORA.md`)

1. **Sistema de combustible** (inyección con retorno) ⏳
2. **Ciclo de 4 tiempos** (pistón, válvulas, diagrama P-V) ⏳
3. **Encendido** (bobina por cilindro, sensor de cigüeñal, osciloscopio) ⏳
4. **Refrigeración** ⏳ y **lubricación** ⏳
5. **Motor completo** 💭 — los módulos conectados por señales (ver §11).
6. **Juegos** 💭 — nombrar piezas, diagnóstico dentro de un sistema, armar
   circuitos. Ver `plans/2026-09-23-arquitectura-juego.md`.
7. **Casos entre sistemas** 💭 — **el objetivo final**: un vehículo con varios
   sistemas acoplados y casos al estilo Carmen Sandiego (expediente, pistas,
   sospechosos, orden de trabajo). Ver la sección 14 del mismo plan.

## Qué NO estamos construyendo

- Un juego de manejo ni un simulador de conducción.
- Un personaje que camina por un taller: todo es mouse + diagramas.
- 3D, **por ahora**. Todo es 2D esquemático con layout fijo. El horizonte de
  juego (piezas movibles, armar el circuito, 3D) está en `HORIZONTE_JUEGO.md`.
- Exactitud de ingeniería (CFD, termodinámica completa). Coherente > exacto.
- Multiusuario, cuentas, backend.
