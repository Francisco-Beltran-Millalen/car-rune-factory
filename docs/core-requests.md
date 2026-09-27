# Pedidos al core

Los agentes de módulo no tocan `src/core/` (§12). Si un contrato de
`CONTRATOS.md` se queda corto, se anota acá y lo resuelve una tarea de core.

Formato: `- [ ] AAAA-MM-DD · <módulo> · <qué falta> · <por qué / caso de uso>`

- [ ] 2026-09-27 · carburetor (A16) · `displacementPump` (`sim/elements/hydraulic.ts`)
  tiene un corte duro en `pMax`: para `Δp ≥ pMax`, `lim = 0` **y su derivada
  también** (rama plana, sin cola suave). Con `slip = 0` (lo que pedía el
  plan), cualquier combinación de carga que empuje el punto de operación
  cerca de `pMax` — una bomba de desplazamiento en serie con un `restrictor`
  o un `variableOrifice` bastante cerrado — hace que Newton se salga de la
  zona plana en la primera iteración y quede atrapado ahí (jacobiano nulo,
  sin gradiente para volver): el solver falla **todos** los pasos siguientes
  sin parar nunca (no da NaN, el estado simplemente se congela, así que un
  test que sólo mire NaN/Infinity no lo detecta). Reproducido aislado en
  `tests/sim/` con la bomba + un restrictor/`variableOrifice` fijo: converge
  para `open` grande, falla para `open` chico o para `clog` alto con `n`
  alto, con o sin warm-start (`CircuitDef.initial` no alcanza: el punto de
  equilibrio cae justo al borde de la rampa). Se resolvió en el módulo dando
  a la bomba mecánica `slip = 30` (una fuga interna que aporta una pendiente
  lineal suave incluso más allá de `pMax`), documentado en
  `modules/carburetor.md` §5.4/§14 y validado con un fuzz de 60 combinaciones
  × 500 pasos exigiendo `solver.stats.failures === 0`. El arreglo de fondo
  sería una cola suave en `lim` (o en `dlim`) más allá de `pMax` en vez del
  corte a cero, para que ningún módulo futuro con esta bomba tenga que
  calibrar un `slip` sólo para esquivar el problema.
