# Plan: alcance del auto completo y variantes por época

Decisión del usuario del 2026-09-26. Este plan registra el alcance nuevo y lo
lleva a los docs vivos (`NORTE.md`, `SISTEMAS.md`, `modules/four-stroke.md`,
`modules/ignition.md`, `AHORA.md`). **No cambia el orden del bloque S**: sólo
agrega trabajo al catálogo y le suma a A10 una obligación de diseño (§4).

## 1. La decisión

- **El auto completo.** El objetivo es simular y abstraer el auto entero, lo
  más cerca que se pueda, y no sólo el motor: tren motriz, frenos, eléctrico,
  suspensión, dirección, **ruedas y neumáticos**, **chasis y carrocería**.
- **Restauración de carrocería.** El óxido existe, y hay que poder **cortar,
  soldar, enderezar el chasis y pintar**. Esto amplía el juego: además de
  diagnosticar y reparar (reemplazar piezas), se restaura.
- **Épocas: 1970–2010, sólo combustión interna.** Distintas generaciones
  funcionan de forma distinta: carburador frente a inyección, tracción
  trasera frente a delantera, platinos frente a encendido electrónico.
  Importa sobre todo lo antiguo.
- Se mantiene de `NORTE.md`: nada de manejo ni personaje, 2D esquemático y
  "coherente > exacto".

Origen: el usuario se topó con una pieza rota de la distribución (donde el
cigüeñal se une con la cadena) y la quiere como falla del juego (§5).

## 2. Observaciones (qué cambia respecto de lo ya especificado)

1. **Las specs actuales son de una sola época.** `fuel` es inyección
   multipunto con retorno (≈1990–2005). `ignition` es COP con ECU y rueda
   60-2 (≈2000 en adelante). En 1970–1985 lo normal era carburador y
   distribuidor con platinos y condensador. Si A11–A14 nacen atados a una
   época, agregar las otras después obliga a reescribirlos. Por eso las
   variantes se diseñan en A10 (§4), antes de escribir código.
2. **La carrocería no es una red.** Óxido, soldadura, enderezado y pintura
   no son nodos con presión o corriente. Son el **estado de un panel o
   elemento estructural** (espesor sano, óxido superficial, perforado,
   soldado, desalineado mm, capas de pintura) más **procesos** que lo
   cambian (lijar, cortar, soldar parche, tirar en bancada, masillar,
   aparejo, pintar). Ese tipo de modelo el solver no lo cubre y necesita su
   propio plan. Esto no viola ninguna ley: sigue siendo modelo puro (§1),
   determinista (§3) y con estados en unión de strings (§7).
3. **Suspensión y ruedas sin manejo.** Se diagnostican en el taller por
   síntoma: ruido, juego al mover la rueda, rebote, desgaste disparejo,
   vibración al balancear o cotas de alineación fuera de rango. No hace
   falta simular la conducción: basta un modelo cuasiestático (carga, juego,
   geometría, desgaste).
4. **El orden no cambia.** Primero el laboratorio del motor (A6b–A15), donde
   ya están las leyes y el solver. Lo nuevo entra como 💭 en el catálogo y
   recibe tareas cuando A10 lo ordene o el usuario lo pida.

## 3. Catálogo nuevo (va a `SISTEMAS.md`)

- **Distribución** (dentro de 4 tiempos): piñón del cigüeñal, chaveta,
  cadena, correa o engranajes, tensor (hidráulico o de resorte), guías y
  patines, piñón del árbol de levas. Configuraciones OHV (varillas),
  SOHC y DOHC.
- **Alimentación por época**: carburador (cuba, flotador, surtidores,
  estrangulador, bomba de aceleración, bomba mecánica), inyección monopunto
  (TBI), multipunto con retorno (hoy `fuel`) y sin retorno.
- **Encendido por época**: platinos + condensador + distribuidor con avance
  centrífugo y de vacío; electrónico con distribuidor (Hall o inductivo);
  DIS (bobina doble chispa); COP (hoy `ignition`).
- **Tren motriz**: embrague, caja manual o automática, disposición
  (delantero-trasera con cardán y puente rígido, tracción delantera con
  semiejes y homocinéticas, 4x4 con caja de transferencia), diferencial.
- **Frenos**: tambor y disco, bomba, servo de vacío, líneas, cálipers y
  cilindros de rueda, freno de mano, ABS (años 90 en adelante).
- **Suspensión**: eje rígido con ballestas, McPherson, doble horquilla,
  barra de torsión; amortiguadores, espirales, rótulas, bujes, bandejas.
- **Dirección**: caja de bolas recirculantes, cremallera, hidráulica,
  terminales, alineación (convergencia, caída, avance).
- **Ruedas y neumáticos**: llanta, neumático (presión, desgaste por zona,
  fecha), rodamientos de rueda, balanceo, pernos.
- **Chasis y carrocería**: chasis de largueros (body-on-frame) o monocasco,
  paneles, óxido por capas, soldadura, enderezado en bancada con cotas,
  masilla, aparejo, pintura.
- **Eléctrico**: carga (dínamo en los más viejos, alternador con regulador
  externo o interno), arranque, fusibles y relés, luces.

## 4. Obligación nueva para A10: variantes por época

El plan del vehículo de A10 tiene que definir, además de lo que ya pide su
ficha (plan 2026-09-25 §6):

1. **Configuración del vehículo** como datos: época (año), alimentación,
   encendido, distribución, tracción, tipo de chasis y caja. Cada campo es
   una unión de strings (§7). Un auto concreto es una combinación válida
   (no toda combinación existe: no hay COP con platinos).
2. **Variante = módulo o parámetro.** Decidir, con criterio escrito, cuándo
   una variante es otro módulo (carburador ≠ inyección: piezas y física
   distintas) y cuándo es un parámetro del mismo módulo (correa, cadena o
   engranajes en `four-stroke`). Propuesta de partida: si cambian las
   piezas (`parts`) o el tipo de simulación, es otro módulo.
3. **Señales estables entre variantes**: `fuel.mixture` y `ignition.spark`
   los publica cualquier variante (§28), para que `engineCore` y los demás
   sistemas no sepan cuál está montada.
4. **Dónde encaja la carrocería**: un modelo por elementos estructurales,
   fuera del solver (§2 punto 2). A10 sólo lo ubica. El detalle va en su
   propio plan.

## 5. La falla del usuario

Va a `modules/four-stroke.md`. Piezas nuevas: `crankSprocket`,
`crankKey` (chaveta), `timingChain` (o correa según la variante),
`tensioner`, `chainGuide`. Fallas (ids §26 provisionales, se fijan en A11):

- `crankKey.sheared`: la chaveta se corta, el piñón resbala sobre el eje, la
  distribución se desfasa de golpe (y puede haber choque de válvulas), y el
  sensor de cigüeñal ve otra fase que el árbol de levas.
- `tensioner.weak`: tensor débil o sin presión de aceite, la cadena golpetea
  al partir en frío y se estira hasta saltar dientes. Es un caso entre
  sistemas con la lubricación.
- `chainGuide.broken`: ruido metálico, restos plásticos en el cárter (pista
  en el aceite) y cadena floja.
- `timingChain.stretched`: desfase gradual de unos pocos grados, con pérdida
  de potencia (y código de correlación cigüeñal/leva en los autos con ECU).

`camTimingOffset` pasa a ser el **síntoma** (el desfase) y estas fallas son
las **causas**.

## 6. Cambios en docs vivos (este mismo commit)

- `NORTE.md`: decisión, épocas, restauración de carrocería, y "Qué NO".
- `SISTEMAS.md`: catálogo de §3 y tabla de variantes por época.
- `modules/four-stroke.md`: distribución (§5) y variantes.
- `modules/ignition.md`: aviso de que es la variante COP.
- `AHORA.md`: la fila de A10 suma §4 de este plan.
