# Módulo 3 — Encendido (spec de nivel de diseño)

> Extraído de `docs/plans/2026-09-22-plan-maestro.md`. Este archivo es el **vivo**: si cambia la spec, se cambia acá (y se anota en `AHORA.md`).

- **Variante**: esta spec es la de ~1995–2010 (COP). Platinos + condensador + distribuidor, electrónico con distribuidor y DIS son variantes por época (`SISTEMAS.md`, plan 2026-09-26 §4); A10 decide cómo se modelan antes de A12.
- **Tipo**: bobina por cilindro (COP) comandada por la ECU. Sensor de cigüeñal con rueda 60-2.
- **Piezas**: `battery`, `key`, `ecu`, `crankSensor`, `toothWheel`, `igniter` (transistor), `coilPrimary`, `coilSecondary`, `sparkPlug`, `cylinder`.
- **Física**:
  - Primario RL: `i = V/R·(1 − e^{−t/τ})`, con R = 0.5 Ω, L = 3 mH.
  - Tiempo de carga (dwell) configurable, 3 ms por defecto.
  - Al cortar, la energía `½·L·i²` pasa al secundario (relación 1:100). El voltaje disponible es `Vavail ∝ i_corte`, con un máximo de ~35 kV.
  - Voltaje de ruptura: `Vreq = 3 kV + 9 kV·gap_mm·(pCil_bar/10)`.
  - Chispa si `Vavail ≥ Vreq`. Si no → falla de encendido.
  - La presión del cilindro sale de una curva simple de compresión según el ángulo.
- **Vista**: circuito con partículas `p-electric` en el primario, rueda dentada girando con la señal del sensor y un **osciloscopio** de dos canales (corriente del primario y voltaje del secundario) que se congela con cámara lenta.
- **Params**: `rpm`, `dwellMs`, `advanceDeg`, `batteryV`, `plugGapMm` (0.6–1.6), `load`.
- **Fallas**: `plugWear` (aumenta la separación efectiva), `fouledPlug` (deriva: parte de la energía se pierde), `weakCoil` (L y relación menores), `openHTLead`, `crankSensorFail` (sin señal → sin chispa y sin pulsos).
- **Tests**: la corriente llega al 63 % a τ = 6 ms; hay chispa en condiciones sanas; batería de 10 V + dwell 1.5 ms + gap 1.6 + carga alta → falla; sin sensor → cero chispas.
