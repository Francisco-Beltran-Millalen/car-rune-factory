# Módulo 4a — Refrigeración (spec de nivel de diseño)

> Extraído de `docs/plans/2026-09-22-plan-maestro.md`. Este archivo es el **vivo**: si cambia la spec, se cambia acá (y se anota en `AHORA.md`).

- **Piezas**: `engineBlock`, `waterPump`, `thermostat`, `radiator`, `fan`, `bypass`, `heaterCore`, `expansionTank`, `pressureCap`, `tempSensor`.
- **Física (modelo de nodos térmicos)**:
  - Calor generado: `Q = 2 kW + 38 kW·load·rpm/6000`.
  - Masas térmicas: bloque + refrigerante (8 kg·3.6 kJ/kgK) y radiador (3 kg).
  - Caudal de la bomba ∝ rpm: 150 L/min a 6000 rpm.
  - Termostato: apertura lineal entre 88 y 100 °C. Bypass cuando está cerrado.
  - Radiador: `Qrad = UA(airflow)·(Trad − Tamb)`, con `airflow` = velocidad del auto + ventilador.
  - Ventilador: histéresis 100/95 °C.
  - Tapa a 1.1 bar: el punto de ebullición sube a ~122 °C. Con baja presión o nivel bajo → ebullición/aire.
- **Params**: `rpm`, `load`, `vehicleSpeedKmh`, `ambientC`, `heaterOn`.
- **Fallas**: `thermostatStuck` ('ok'|'open'|'closed'), `pumpImpellerWear`, `radiatorClog`, `fanFail`, `coolantLeak` (el nivel baja), `capFail`.
- **Vista**: circuito con partículas `p-coolant` coloreadas por temperatura (interpolación azul → rojo), termostato animado y aspas del ventilador.
- **Tests**: calentamiento hasta ~90 °C estable; termostato abierto → no pasa de ~70 °C en tráfico frío; ventilador roto + detenido + carga → sobrecalentamiento; tapa fallada → hierve antes.
