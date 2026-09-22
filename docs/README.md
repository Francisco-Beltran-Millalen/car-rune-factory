# Docs — cómo está organizado esto

**Vivo, autoridad para este proyecto:**

- `NORTE.md` — visión: qué es, pilares, qué no es (≤200 líneas).
- `ARCHITECTURE.md` — leyes §1-§18 + pipeline (≤200 líneas). El código las
  cita por `§n`.
- `AHORA.md` — bitácora de trabajo (≤500 líneas). Lo cerrado se recorta; la
  historia queda en git.
- `SISTEMAS.md` — catálogo de sistemas del auto → módulo → estado.
- `CONTRATOS.md` — interfaces exactas del core (descriptor, modelo, vista,
  specs de UI, loop, partículas, shell).
- `modules/<id>.md` — spec de cada módulo: piezas, params, fallas, física,
  estado, vista, narración y tests.
- `core-requests.md` — pedidos de los módulos al core, pendientes.

**Registro histórico:** `plans/` — cada plan tal como se aprobó, con fecha.
No se edita después de aprobado.

Si algo en los docs vivos se contradice con un plan, manda lo vivo. Si dos
docs vivos se contradicen, es un bug de docs: se arregla en el mismo cambio.
