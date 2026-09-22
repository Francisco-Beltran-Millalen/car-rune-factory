# Módulo 4b — Lubricación (spec de nivel de diseño)

> Extraído de `docs/plans/2026-09-22-plan-maestro.md`. Este archivo es el **vivo**: si cambia la spec, se cambia acá (y se anota en `AHORA.md`).

- **Piezas**: `sump`, `pickup`, `oilPump` (engranajes), `reliefValve`, `oilFilter`, `filterBypass`, `mainGallery`, `mainBearings`, `rodBearings`, `camBearings`, `pressureSwitch`, `warningLamp`.
- **Física**:
  - Bomba de desplazamiento positivo: `Q = disp·rpm`, ~40 L/min a 6000 rpm.
  - Alivio a 4.5 bar. Bypass del filtro con ΔP > 1 bar.
  - Fuga en los cojinetes: `Q_leak = Σ k·clearance³·p / μ(T)`.
  - Viscosidad `μ(T)` exponencial (aceite frío ⇒ alta presión).
  - Temperatura del aceite como param.
  - Nivel bajo → aire en la aspiración.
  - Luz de advertencia < 0.5 bar.
- **Params**: `rpm`, `oilTempC`, `oilGrade` ('5W-30'|'10W-40'|'20W-50'), `oilLevel`.
- **Fallas**: `bearingWear` (holgura ↑), `filterClog` (bypass abre → aceite sucio), `reliefStuckOpen`, `pickupClog`, `lowOil`.
- **Tests**: presión ∝ rpm hasta el alivio; frío → presión más alta; `bearingWear` → la luz se enciende en ralentí caliente.
