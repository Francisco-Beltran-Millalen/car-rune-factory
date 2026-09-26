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
   - **Amortiguación por nodo** (A6): si el paso de un nodo cambia de signo
     respecto de la iteración anterior, ese nodo está oscilando (caso típico:
     dos nodos sin capacitancia unidos por un restrictor saturando, donde
     Newton da exactamente `−2·Δp` y vuelve al punto espejo). A ese nodo se
     le media el paso (mínimo `1/1024`) y el resto sigue a paso completo.
     Además el paso no cruza el 0 del nodo y se limita a `|Δx| ≤ 1` bar
     (o 1 V) por iteración, como pide §8.1.
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
| 1 | 22,1 | 45 200 |
| 2 | 24,6 | 40 700 |
| 3 | 24,8 | 40 400 |

Máquina: Intel i7-7700HQ, Node 26. Corriendo toda la suite en paralelo se
midieron 45–50 ms. El presupuesto de 4× tiempo real = 4000 pasos/s queda
holgado (>10×). No hay umbral en el test: imprime y listo; si un día baja del
presupuesto, se anota y se decide (bajar `maxScale` o optimizar, P23 §10).
La relajación por nodo (A6) costó ~10 % sobre el benchmark anterior.

## 6. Biblioteca de elementos — `src/sim/elements/`

Cada tipo es una fábrica `createX(params, fluid) → ElementDef` con `params`
numéricos y las entradas de `control` que los controladores/bindings escriben.
Registro en `ELEMENT_TYPES` (`index.ts`), que además marca `joint` (todos los
puertos son un nodo interno) y `multiple` (un puerto admite varias conexiones).

| tipo | puertos | ley y params | control | fallas |
|---|---|---|---|---|
| `restrictor` | a, b (hidr) | `q = Δp/√(k(|Δp|+ε))`, ε=1e-4; `k`, `clogFactor` | `clog` | `clog` |
| `checkValve` | in, out (hidr) | conductancia de `1e-6·g` a `g` en 0,02 bar; `g` | — | — |
| `leak` | a (hidr, a atm) | `q = k·s·√(p⁺)`; `k` | `severity` | `leak` |
| `volume` | a (hidr) | sólo `capacitance = c·3600`; `c` (L/bar) | — | — |
| `tee` | a, b, c (hidr) | nudo: sin flujos (`joint`, `multiple`) | — | — |
| `electricPump` | e+, e-, in, out | `q = Qm(V)(1−Δp/Pm)⁺(1−air)`, `I = (1.5+5.5·Δp⁺/(Pm+εP))·vf`; para `V ≤ 0` no bombea y la bobina es `R`; `qMax`, `pMax`, `vNominal`, `wearQ`, `wearP`, `epsP`, `windingR` | `air`, `wear` | `wear` |
| `reliefRegulator` | in, ret, ref | `q = k·softRelu(p_in−p_ref−set)`; `k`, `set`, `smooth` | `set`, `noReturn` | `state` |
| `orifice` | in, out (hidr) | abierto `k·√(Δp⁺)`, cerrado `leakCoeff·s·√(Δp⁺)`; `k`, `leakCoeff` | `open`, `leak` | `leak` |
| `tank` | out, ret (hidr) | nodo fijo 0 bar (`joint`); `commit` integra `level −= neto/3600·dt·(fast?100:1)`; `capacity`, `pickupLow` | `fast` | — |
| `pressureSource` | a (hidr) | nodo fijo (Dirichlet) con `control.p` | `p` | — |
| `battery` | +, - (eléc) | `V = control.v − R·I`; `r` | `v` | — |
| `resistor` | a, b (eléc) | `q = Δp/r` (el juguete de A5; no estaba en §8.2) | — | — |
| `switch` | a, b (eléc) | `R_on`/`R_off` según `control.closed`; `rOn`, `rOff` | `closed` | — |
| `currentLoad` | a, b (eléc) | carga de corriente media: `I = control.i·smoothstep(ΔV/1 V)` (C¹, sin escalones para Newton); `i` | `i` | — |
| `junction` | a..f (eléc) | nudo eléctrico: todos los puertos son el mismo nodo (`joint`, `multiple`), sin flujos (A12) | — | — |
| `visual` | — | pieza sólo dibujable: sin puertos, sin flujos (A7; vive en `visual.ts` desde A11) | — | — |

Las sondas de elemento (`probes`) llevan `pot` del elemento; pueden cerrar
sobre su `state` (p. ej. `tank.level`). ℹ︎ `q` en la tabla es flujo hacia
`out`; `flow[p]` del contrato sigue el signo de §3.

## 7. Circuito compilado — `src/sim/circuit/`

```ts
compileCircuit<S extends CircuitState>(options): CompiledCircuit<S>
validateCircuit(def, types, controllerTypes?): CircuitIssue[]
```

- **`CircuitDef`**: `parts` (`id`, `type`, `x`, `y`, `rot?`, `params?`,
  `fluid?`, `label?`), `links` (`id`, `from: 'part.port'`, `to`, `route?`),
  `controllers`, `probes` (`{ node }` o `{ element, probe }`), `params` y
  `faults` por defecto, `fixed` (`'part.port' → potencial`, atmósfera/chasis).
  El layout es parte del circuito (D5).
- **Union-find**: cada conexión une puertos; los elementos `joint` unen sus
  propios puertos (`tank`, `tee`). Los puertos sin conectar quedan con `gmin`.
  `portToNode`, `linkToNodes` y `nodes.ports` salen del compilado.
- **`CompileOptions`**: `types` (registro de elementos), `controllerTypes`,
  `bindings` (`{ source:'params'|'faults', key, part, input }`: copia un
  valor del modelo al `control` de una parte en cada paso), `init` (overrides
  para `ElementDef.init`, p. ej. `tankLevel`), `state` (el objeto del módulo;
  el compilador escribe sondas y estado de controladores), `params`, `faults`,
  `actions` y `seed`.
- **Pipeline de `step`**: bindings → controladores (leen sondas del paso
  anterior, §25) → `solver.step` → muestreo de sondas y publicación del estado
  de los controladores → `time += dt`. `reset()` restaura params/faults,
  re-inicializa elementos, recompila solver y controladores y vuelve `time` a 0.
- **`validateCircuit`** detecta: parte/controlador/conexión duplicados, tipo
  desconocido, puerto inexistente, self-link, dominio distinto, fluido distinto
  (§30), puerto con más de una conexión (salvo `multiple`), sonda inválida y
  fijo inválido. Puerto sin conectar es **aviso** (en el armado es didáctico).

## 8. Qué falta

- A6: el combustible sobre el solver (`fuel/circuit.ts` y controladores
  `ecuFuel`, `engineCore` en `sim/controllers/`, `stubs.ts`), con paridad
  contra el modelo de referencia y `failures === 0`.
- A7: presenter y drawer SVG por tipo; A10: `compileVehicle` y el laboratorio
  del vehículo.
- Los tests de A5 están en `tests/sim/elements.test.ts` (ley + jacobiano
  contra diferencias finitas, error < 1e-4) y `tests/sim/circuit.test.ts`
  (validate, juguetes analíticos, controladores y reset).
