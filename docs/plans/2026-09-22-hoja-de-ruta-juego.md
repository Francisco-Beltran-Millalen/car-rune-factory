# Plan: hoja de ruta hacia el "mechanic simulator" con diagramas

> **Registro histórico (2026-09-25).** No se usa para implementar. Lo vivo: `AHORA.md` y `2026-09-25-simulacion-antes-que-juego.md` §6.

Fecha: 2026-09-22. **Reemplazado en orden y detalle por `2026-09-23-arquitectura-juego.md`.** Estado: **propuesta aceptada en líneas generales**; el
usuario la va a repensar (sesión del 2026-09-23) antes de diseñar en detalle.

## Contexto

Con la Fase 1 (combustible) funcionando, el usuario lo probó ("me gustó
mucho") y definió el norte: aprender con **videojuegos**. Algo en la línea de
*Car Mechanic Simulator*, *Wrench* o *My Summer Car*, pero mucho más sencillo:
todo en **diagramas**, con el **mouse** y texto, **sin personaje movible**.
Varios jueguitos cortos (nombrar partes, diagnosticar fallas, armar
circuitos) y etapas que se agregan a medida que mejoran las simulaciones.
Se inclina por **Phaser** con **armar circuitos**.

## Decisiones y opiniones registradas

- **Lo que ya existe sirve directamente.** `content.js` + `data-part` →
  juego de nombrar partes. Fallas con síntomas medidos → juego de
  diagnóstico.
- **Modo diagnóstico:** falla escondida y herramientas en vez de ver todo:
  - manómetro;
  - amperímetro de la bomba;
  - escuchar la bomba;
  - acelerar;
  - reemplazar una pieza, con costo o tiempo.

  La narración "¿Qué está pasando?" se apaga o se convierte en pistas (hoy
  dice la respuesta).
- **Phaser: sí, pero cuando llegue "armar circuitos"** (arrastrar, encajar en
  puertos, animaciones, sonido). Para nombrar partes y diagnosticar, el SVG
  actual alcanza; migrar antes obligaría a reescribir vistas sin ganar nada.
  Antes de adoptarlo, prueba corta y verificar la versión actual en su
  documentación. §1 garantiza que la física no se toca al cambiar de
  renderer.
- **Solver de redes antes que los módulos 2 a 4.** Combustible,
  refrigeración y lubricación son la misma red hidráulica (presión/caudal).
  El encendido y la carga son una red eléctrica, con la misma matemática.
  El ciclo de 4 tiempos es un mecanismo y queda aparte. Hacer refrigeración
  y lubricación con ecuaciones fijas obligaría a rehacerlas para poder
  armarlas. Los 13 tests del combustible son la red de seguridad: el
  combustible sobre el solver debe dar los mismos números.

## Etapas propuestas

| Etapa | Qué | Stack | Reusa |
|---|---|---|---|
| E1 | **Nombrar piezas** sobre el diagrama del combustible (clic en "¿dónde está el regulador?", puntaje) | SVG actual | content.js, data-part, shell |
| E2 | **Diagnóstico**: falla escondida al azar (rng con semilla), herramientas, reemplazar piezas, puntaje por costo/tiempo | SVG actual | model.js, faults, readouts |
| E3 | **Solver de redes hidráulicas** genérico + combustible portado al solver | JS puro | tests del combustible como regresión |
| E4 | **Armar el circuito** de combustible (arrastrar piezas, conectar puertos, errores posibles) | prueba con Phaser | solver E3 |
| E5+ | Refrigeración y lubricación sobre el solver; encendido con un solver eléctrico; 4 tiempos aparte; jueguitos por módulo | según E4 | todo lo anterior |

## Preguntas abiertas para la próxima sesión

- ¿Cómo se encadenan los jueguitos: campaña con etapas, menú libre, o las
  dos?
- ¿Hay progresión (dinero, herramientas que se desbloquean, autos o sistemas
  nuevos)?
- ¿Cuánto se "castiga" en el diagnóstico (costo de piezas cambiadas sin
  necesidad, tiempo)?
- ¿Los simuladores libres (lo de hoy) quedan como "modo laboratorio" junto a
  los juegos?
- ¿Cuándo se hace la prueba con Phaser: antes de E3 (para diseñar el solver
  pensando en el editor) o después?
