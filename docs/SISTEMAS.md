# Sistemas — catálogo del auto, mapeado a módulos

Catálogo de a dónde apuntar, no compromiso de orden. La prioridad real vive en
`NORTE.md` → Módulos y en `AHORA.md`. Estado: ✅ hecho · ⏳ planificado ·
💭 idea.

## Motor

- **Alimentación de combustible** ⏳ `fuel` — estanque, bomba eléctrica,
  colador, válvula check, filtro, riel, 4 inyectores, regulador con
  referencia de vacío, retorno. Spec completa en `modules/fuel.md`.
- **Ciclo de 4 tiempos** ⏳ `four-stroke` — pistón, biela, cigüeñal,
  válvulas, árbol de levas, correa de distribución 2:1, diagrama P-V.
  `modules/four-stroke.md`.
- **Encendido** ⏳ `ignition` — batería, ECU, sensor de cigüeñal 60-2,
  transistor, bobina COP, bujía, osciloscopio. `modules/ignition.md`.
- **Refrigeración** ⏳ `cooling` — bomba de agua, termostato, radiador,
  ventilador, calefactor, depósito de expansión, tapa a presión.
  `modules/cooling.md`.
- **Lubricación** ⏳ `lubrication` — cárter, bomba de engranajes, válvula de
  alivio, filtro con bypass, galerías, cojinetes, luz de presión.
  `modules/lubrication.md`.
- **Admisión / mariposa / MAP** 💭 — hoy se representa sólo como `pMan` en
  combustible y como presión de admisión en 4 tiempos.
- **Escape / catalizador / sonda lambda** 💭 — cerraría el lazo de mezcla con
  el módulo de combustible.
- **Turbo** 💭
- **Diésel common-rail** 💭 — contraste con la inyección de bencina.

## Eléctrico

- **Carga (alternador + regulador)** 💭 — hoy es `+1.4 V` fijo con el motor
  en marcha.
- **Arranque (motor de partida)** 💭

## Tren motriz y chasis

- **Embrague / caja de cambios** 💭
- **Frenos hidráulicos** 💭 — bomba de freno, servo de vacío, cálipers, ABS.
- **Dirección hidráulica** 💭

## Integración

- **Motor completo** 💭 `engine` — orquestador que conecta módulos copiando
  señales de un `state` al `params` de otro (§11). Ver sección 11 del plan
  maestro.

## Juegos (ver `plans/2026-09-22-hoja-de-ruta-juego.md`)

- **Nombrar piezas** 💭 E1 — sobre cualquier diagrama con `parts`.
- **Diagnóstico** 💭 E2 — falla escondida + herramientas + reemplazar piezas.
- **Solver de redes hidráulicas** 💭 E3 — base común para combustible,
  refrigeración y lubricación armables. Luego un solver eléctrico para
  encendido y carga.
- **Armar circuitos** 💭 E4 — arrastrar y conectar; prueba con Phaser.
