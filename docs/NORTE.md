# Norte — qué estamos construyendo

**car-rune-factory** — laboratorio web didáctico para entender cómo funciona el
motor de un auto **sistema por sistema**. Cada sistema se aísla en una
simulación 2D esquemática: se ve por dónde va el fluido (o la corriente, o el
calor), se tocan los controles, se provocan fallas y se leen los números.
(≤200 líneas; visión. Táctico en `AHORA.md`, reglas en `ARCHITECTURE.md`,
catálogo en `SISTEMAS.md`.)

Uso personal, en español. JavaScript puro + Vite, sin framework.

## Pilares

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
6. **Modo juego** 💭 — mover piezas y luego armar circuitos; quizá 3D.
   Ver `HORIZONTE_JUEGO.md`.

## Qué NO estamos construyendo

- Un juego de manejo ni un simulador de conducción.
- 3D, **por ahora**. Todo es 2D esquemático con layout fijo. El horizonte de
  juego (piezas movibles, armar el circuito, 3D) está en `HORIZONTE_JUEGO.md`.
- Exactitud de ingeniería (CFD, termodinámica completa). Coherente > exacto.
- Multiusuario, cuentas, backend.
