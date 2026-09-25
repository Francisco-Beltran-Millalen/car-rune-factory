# Solver nodal (A4) — **especificación del contrato**

> Ley §24 y plan `plans/2026-09-23-arquitectura-juego.md` §8.1 (solver) y §8.2
> (contrato de elemento). Este archivo es el **vivo**: si cambia el contrato,
> se cambia acá (y se anota en `AHORA.md`). Tipos exactos:
> `src/sim/solver/types.ts`.

## 1. Qué resuelve

Red genérica esfuerzo/flujo (D4): nodos con un potencial (bar o V) y elementos
multipuerto que declaran el flujo que sale por cada puerto y su jacobiano.
Hidráulico y eléctrico comparten el solver; el dominio sólo sirve para validar
conexiones (A5). El ciclo de 4 tiempos **no** usa el solver (es un mecanismo).

## 2. API — `src/sim/solver/`

```ts
createSolver({
  nodeCount,
  elements: SolverElement[],   // { def: ElementDef, nodes: number[] }
  ground?, gmin?, maxIterations?, maxDelta?, tolerance?,
}): Solver

solver.step(dt)  → { ok: boolean; iterations: number }
solver.potential(node) → number   // último paso convergido
solver.reaction(node)  → number   // flujo neto que SALE de un nodo fijo
solver.setFixed(node, value) / solver.free(node)
solver.stats → { failures, iterations }   // failures = pasos no convergidos
```

- `elements[i].nodes[p]` es el índice de nodo del puerto `p`; lo asigna el
  compilador del circuito (A5). El solver no valida dominios ni fluidos.
- `ground[node]`: potencial fijo (Dirichlet); `NaN` = nodo libre. Los nodos
  fijos típicos (`atm` 0 bar, `chassis` 0 V, `tank` 0 bar propio) se pasan
  acá. Un nodo también puede quedar fijo si un elemento lo declara (§4).
- `linalg.solveDense(A, b, n)`: eliminación gaussiana con pivoteo parcial en
  su lugar; la solución queda en `b`. Devuelve `false` si un pivote cae bajo
  `1e-14` (matriz singular o con `NaN`), y el solver cuenta el paso como fallo.

## 3. Contrato de elemento (P23 §8.2)

| campo | firma | significado |
|---|---|---|
| `ports` | `PortDef[]` | `{ id, domain, fluid? }`; `fluid` obligatorio si es hidráulico (§30) |
| `params` | `Record<string, number>` | datos de la instancia (constantes) |
| `control` | `Record<string, number\|boolean>` | entradas que escriben los controladores |
| `state` | `Record<string, number>` | estado interno, mutado sólo en `commit` |
| `capacitance?` | `Record<portId, number>` | aporte al nodo, **ya** en flujo/(potencial·s): hidráulico `C[L/bar]·3600`, eléctrico `C[F]` |
| `init?` | `(overrides) => void` | estado inicial (lo llama el compilador, A5) |
| `eval` | `(pot, out, dt) => void` | escribe `out.flow[p]` (flujo que **sale del elemento hacia** el puerto `p`) y `out.jac[p*k+q]` = `∂flow[p]/∂pot[q]` |
| `commit` | `(pot, dt, reaction) => void` | actualiza `state` tras converger; `reaction[p]` es la reacción del nodo del puerto `p` |
| `probes?` | `Record<name, (pot) => number>` | valores medibles (caudal, corriente…) |
| `faults?` | `Record<faultKey, ElementFault>` | ids públicos = `` `${instanceId}.${faultKey}` `` (§26) |
| `fixed?` | `(out) => void` | Dirichlet declarado por el elemento (p. ej. `pressureSource`): escribe en `out[p]` el potencial de su nodo o `NaN`. Se evalúa al inicio de cada paso |

`eval` puede escribir todos los flujos/jacobianos o sólo sumar: el solver
prellena `flow` y `jac` con ceros antes de cada llamada.

## 4. Paso (P23 §8.1)

1. **Dirichlet del paso**: se parte del `ground` base y se aplican los
   `fixed()` de los elementos (así una fuente sigue a su `control`).
2. Se parte del potencial del paso anterior (`xStart`).
3. Newton-Raphson, hasta 25 iteraciones:
   - **Residuo** `F_i = −Σ flow[p] + Ĉ_i·(x_i − x_i^prev)/dt` = flujos que
     **salen** del nodo hacia los elementos + término capacitivo. En los
     puertos de nodos fijos el flujo no es incógnita: alimenta
     `reaction(node)`.
   - **Jacobiano** `J_ij = Σ −∂flow[p]/∂x_j + δ_ij(Ĉ_i/dt + gmin)`.
   - Sólo los nodos libres son incógnitas. Se resuelve `J·Δx = −F`.
   - **Amortiguación**: `|Δx| ≤ 1` bar (o 1 V) por iteración.
   - **Converge** cuando `max|Δx| < 1e-7` y, por nodo,
     `|F_i| < 1e-6 + 1e-6·Σ|flujos del nodo|`.
4. Si no converge: se revierte a `xStart`, `stats.failures++` y `ok: false`.
   Si converge: `commit` de cada elemento (con la reacción de sus puertos) y
   el estado pasa a ser el nuevo `xStart`.

`gmin = 1e-9` en la diagonal hace que un nodo flotante (sin camino a tierra)
tenga solución única en vez de una matriz singular. Los pasos que fallan no
contaminan el estado: el modelo conserva el último estado bueno.

## 5. Benchmark (§8.1, medido el 2026-09-25)

Red de 20 nodos: cadena de 19 resistencias (1 Ω) entre una fuente de 10 V y
tierra, con un capacitor de 1 µF de cada nodo libre a tierra (18 incógnitas;
capacitancias activas). `tests/sim/nodal.test.ts`, con `dt = 1 ms`:

| corrida | ms / 1000 pasos | pasos/s |
|---|---|---|
| 1 | 18,2 | 54 900 |
| 2 | 22,5 | 44 400 |
| 3 | 19,6 | 51 000 |

Máquina: Intel i7-7700HQ, Node 26. Corriendo toda la suite en paralelo se
midieron 28 ms. El presupuesto de 4× tiempo real = 4000 pasos/s queda holgado
(>9×). No hay umbral en el test: imprime y listo; si un día baja del
presupuesto, se anota y se decide (bajar `maxScale` o optimizar, P23 §10).

## 6. Qué falta

- A5: elementos en `src/sim/elements/`, compilación/validación del circuito
  (`src/sim/circuit/`) y controladores base (`src/sim/controllers/`).
- A5 verifica cada jacobiano contra diferencias finitas (error relativo
  < 1e-4) y cada ley contra su fórmula cerrada.
- A6: el combustible sobre el solver, con paridad contra el modelo de
  referencia y `failures === 0`.
