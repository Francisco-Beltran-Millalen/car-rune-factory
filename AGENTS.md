# AGENTS.md

Reglas para cualquier agente/asistente que trabaje en este repo.

1. **Lee `docs/ARCHITECTURE.md` primero**, siempre, antes de tocar código —
   es la autoridad viva del proyecto (leyes §1-§18 + pipeline). Después
   `docs/AHORA.md` (qué está en curso), `docs/CONTRATOS.md` (interfaces
   exactas) y el `docs/modules/<id>.md` de tu tarea.
2. **No asumas qué hace el código por su nombre.** Lee la lógica real antes
   de describir o depender de un comportamiento.
3. **El usuario se puede equivocar.** No le des la razón por default —
   corrígelo con evidencia. Vale también para la física: si una constante
   o un rango de test no cuadra, se dice y se muestra la cuenta.
4. **El checkpoint se mira funcionando** (§13): tests en verde no prueban
   que la simulación se entienda. Antes de cerrar algo, abre la página en el
   navegador y mírala.
5. **Los planes se guardan.** Todo plan nuevo va a
   `docs/plans/AAAA-MM-DD-<tema>.md` antes de implementarlo. Los planes son
   registro histórico; lo vivo son los docs de `docs/`.
6. **Toca sólo los archivos de tu tarea** (§12). Lo que el core no te da se
   pide en `docs/core-requests.md`, no se parcha desde un módulo.
7. **Al cerrar una tarea**, agrega un bloque `CERRADO AAAA-MM-DD — …` en
   `docs/AHORA.md` con lo verificado (tests + qué se miró en el navegador).
