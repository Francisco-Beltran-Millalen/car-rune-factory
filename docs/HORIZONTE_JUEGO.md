# Horizonte: del laboratorio al videojuego

Ideas registradas el 2026-09-22 para **más adelante**. Nada de esto es prioridad
hoy (ver `NORTE.md` y `AHORA.md`). Sirve para no cerrarnos puertas.

> **Actualización 2026-09-22:** el usuario se inclina por **Phaser +
> armar circuitos**, con jueguitos de nombrar partes y diagnóstico antes.
> Hoja de ruta E1–E5 en `plans/2026-09-22-hoja-de-ruta-juego.md`. El
> solver de redes (nivel 2 de abajo) va **antes** que los módulos 2 a 4.

> **Actualización 2026-09-24:** el juice (SFX, VFX, tweens, UI práctica) se
> considera central, y probablemente habrá motor. El motor **no está
> elegido**: se decide después de jugar el diagnóstico (checkpoint G1) y de
> una prueba de juice contra SVG. Por defecto, un motor web en TS. Ver
> `plans/2026-09-24-motor-y-juice.md`.

## La idea

Se aprende mejor jugando. Hoy cada simulación tiene un **layout fijo**: las
piezas siempre están en el mismo lugar, y así debe seguir en las primeras
etapas. Más adelante, el jugador tiene que poder **mover piezas** y, en una
etapa posterior, **armar el sistema él mismo**.

## Dos niveles de "mover"

1. **Mover piezas (sólo visual).** La topología no cambia (bomba → filtro →
   riel…); cambian las posiciones. Requisito: las coordenadas son **datos**
   (`layout.ts`: pieza → posición + puertos de conexión) y las tuberías se
   trazan entre puertos. Se puede hacer con el SVG actual (arrastrar), sin
   engine.
2. **Armar el circuito (cambia la física).** El jugador conecta las piezas y
   puede equivocarse (filtro al revés, sin retorno, bomba sin relé). Requiere
   un **solver de redes**: nodos con presión y conexiones con caudal (como un
   simulador de circuitos eléctricos), en vez de las ecuaciones fijas en serie
   de `fuel/model.ts`. Es un cambio del **modelo**, no del renderer.

## Seguro barato para ya

- Mantener §1 (modelo ⟂ vista): la física no sabe cómo se dibuja. Así el
  renderer se puede cambiar sin tocar los tests de física.
- En los módulos nuevos, separar las coordenadas en un `layout.ts` del
  módulo en vez de dejarlas repartidas por `view.ts`. (Pasar `fuel` a ese
  esquema cuando se retome).

## Engines candidatos (no decidido)

| Etapa | Opción | Nota |
|---|---|---|
| 2D con piezas arrastrables | SVG propio → **PixiJS** si falta rendimiento | SVG alcanza para decenas de piezas |
| 2D juego completo | **Phaser** | escenas, input, audio, JS puro |
| 3D MVP | **Three.js** | el más usado, encaja con vanilla JS |
| 3D con más resuelto | **Babylon.js** | física, inspector, GUI incluidos |
| Física de cuerpos 3D | **Rapier** (WASM) | sólo si hay colisiones; la física del motor sigue siendo propia |
| Alternativa | Bevy → WASM | el usuario ya lo domina (`uneven/`), pero obliga a reescribir los modelos en Rust |

Antes de elegir: verificar las versiones actuales y el estado de cada engine
contra su documentación. No decidir de memoria.

## Soldadura de carrocería (muy a futuro, 2026-09-26)

La carrocería y el chasis entran primero como **inspección visual** (óxido,
perforación, deformación) dentro del diagnóstico. Mucho más adelante, un
minijuego de **soldadura** con precisión abstracta, al estilo de los juegos
de cirugía de Wii (tipo *Trauma Center*): seguir la unión, mantener la
distancia y la velocidad, y no perforar la chapa. Ver
`plans/2026-09-26-sistemas-genericos.md` §2.
