# Módulo 2 — Ciclo de 4 tiempos (spec de nivel de diseño; el agente la completa al nivel de la sección 6 antes de programar)

> Extraído de `docs/plans/2026-09-22-plan-maestro.md`. Este archivo es el **vivo**: si cambia la spec, se cambia acá (y se anota en `AHORA.md`).

- **Piezas**: `piston`, `rod`, `crank`, `cylinder`, `head`, `intakeValve`, `exhaustValve`, `camshaft`, `sparkPlug`, `intakePort`, `exhaustPort`, y la distribución: `crankSprocket` (piñón del cigüeñal), `crankKey` (chaveta), `timingChain` (o correa, según la variante), `tensioner`, `chainGuide`, `camSprocket`.
- **Variantes** (params de este módulo; criterio en `FICHAS.md` → Contexto común, 3): accionamiento por cadena, correa o engranajes; OHV (con varillas y balancines), SOHC, DOHC. El tensor puede ser hidráulico (usa la presión de aceite, señal de `lubrication`) o de resorte.
- **Geometría**: diámetro 86 mm, carrera 86 mm, biela 143 mm, relación de compresión 10:1. Posición del pistón por biela-manivela: `x = r·cosθ + √(l² − r²·sin²θ)`.
- **Distribución** (grados de cigüeñal): admisión abre 10° APMS y cierra 40° DPMI; escape abre 40° APMI y cierra 10° DPMS. Leva con perfil suave (seno²). La leva gira a la mitad de las rpm y se muestra una correa con relación 2:1.
- **Presión en el cilindro**:
  - Admisión ≈ `pMan` absoluto.
  - Compresión politrópica, n = 1.3.
  - Combustión: función de Wiebe (a = 5, m = 2), que parte en el avance de chispa y dura 50°. Energía ∝ throttle.
  - Expansión, n = 1.3. Escape ≈ 1.1 bar abs.
  - Con las válvulas abiertas la presión se relaja hacia la del puerto (τ corto).
- **Vista**: corte del cilindro. El gas cambia de color según la fase (`--mixture` → `--burn` → `--exhaust`). El nombre del tiempo va en grande. A la derecha, **diagrama P-V en vivo** con el punto actual y la traza del ciclo. Se puede **arrastrar el cigüeñal con el mouse** en modo manual.
- **Params**: `mode` ('auto'|'manual'), `rpm` 60–6000, `throttle`, `sparkAdvance` 0–40°, `showOverlap`.
- **Fallas de la distribución** (causas; el desfase es su síntoma; ids provisionales, se fijan en A11):
  - `crankBolt.loose`: perno del cigüeñal flojo, el piñón o la polea tienen juego sobre el eje. Es la causa raíz típica de la siguiente.
  - `crankKey.keywayWorn`: chavetero (la ranura de la chaveta) ovalado hacia un lado. Desfase de pocos grados que varía con la carga, y golpeteo. Si sigue, termina en `sheared`. (La falla real que vio el usuario.)
  - `crankKey.sheared`: el piñón resbala sobre el cigüeñal, el desfase aparece de golpe (y puede haber choque de válvulas) y el sensor de cigüeñal y el de leva dejan de coincidir.
  - `tensioner.weak`: golpeteo de cadena al partir en frío; la cadena se estira hasta saltar dientes. Con tensor hidráulico empeora con poca presión de aceite (caso entre sistemas).
  - `chainGuide.broken`: ruido metálico, restos plásticos en el cárter (pista en el aceite), cadena floja.
  - `timingChain.stretched`: desfase gradual de pocos grados, pérdida de potencia.
- **Fallas**: `ringWear` (blow-by: fuga ∝ presión), `burntExhaustValve` (fuga en compresión/expansión), `camTimingOffset` (±3 dientes = ±15°/diente... las válvulas se desfasan y pueden chocar con el pistón → alerta), `noSpark`.
- **Lecturas**: ángulo, tiempo actual, presión, volumen, torque instantáneo, presión máxima de compresión (prueba de compresión), trabajo por ciclo.
- **Tests**: PMS/PMI en 0/180°; compresión pura sin chispa ≈ `p1·10^1.3` ≈ 20 bar con p1 = 1; `ringWear` baja la compresión máxima; trabajo neto > 0 con chispa y ≈ ≤ 0 sin chispa; `timingOffset` grande → evento de choque.
