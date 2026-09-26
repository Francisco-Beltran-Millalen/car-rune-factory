# Plan: sistemas genéricos (arquetipos) y carrocería a futuro

Enmienda del mismo día a `2026-09-26-alcance-auto-completo.md`. Reemplaza
su §4 punto 1 (configuración del vehículo) y el alcance de restauración de
su §1 y §3. Lo demás de ese plan sigue vigente.

## 1. Por sistema, no por auto (decisión del usuario)

No se modelan autos concretos (marca, modelo o año). Cada sistema se modela
como el **arquetipo más popular** y encapsula los conceptos que comparten sus
variantes. Las variantes antiguas entran como **piezas intercambiables del
mismo sistema** cuando comparten la física, y como **sistema aparte** sólo
cuando la física es otra.

Esto ya está en la física, no es sólo una preferencia:

- **Encendido.** La bobina se comporta igual con platinos y con COP
  (primario RL, `½·L·i²`, ruptura en la bujía). Cambian dos piezas: quién
  corta el primario (platinos + condensador, o un transistor) y quién
  reparte la alta tensión (distribuidor con rotor, o una bobina por
  cilindro). Y quién decide el avance: contrapesos y cápsula de vacío, o la
  ECU. Es un mismo sistema con tres piezas intercambiables.
- **Alimentación.** El concepto común es dosificar la bencina según el aire.
  El carburador lo hace con depresión en un venturi y la inyección con
  presión en el riel y el tiempo de apertura. Las piezas y la física son
  distintas: probablemente sea un sistema hermano con la misma salida
  (`fuel.mixture`, §28).
- **Distribución.** Cadena, correa o engranajes, y OHV, SOHC o DOHC, son
  parámetros de `four-stroke`: la relación 2:1 y el desfase se calculan
  igual.

Con el solver esto sale natural: un `CircuitDef` es datos, así que una
variante es otra definición con los mismos elementos.

**Para A10**: definir el criterio (misma física → pieza intercambiable;
física distinta → sistema hermano con las mismas señales) y la lista de
arquetipos por sistema. Un vehículo del laboratorio es una combinación
genérica de arquetipos, no un modelo real.

## 2. Carrocería y chasis: inspección visual, soldadura muy a futuro

- **Por ahora nada.** Cuando llegue, lo primero es **inspección visual**
  (óxido, perforación, deformación) como pistas del diagnóstico.
- **Muy a futuro**, un minijuego de **soldadura**, con una precisión
  abstracta al estilo de los juegos de cirugía de Wii (tipo *Trauma
  Center*): seguir la unión, mantener la distancia y la velocidad, no
  perforar. Va a `HORIZONTE_JUEGO.md`, no al bloque S ni al G.
- Enderezado del chasis y pintura quedan como ideas sin fecha.

## 3. La falla del usuario, corregida

Lo que el usuario vio no es la chaveta sino el **chavetero** (la ranura
donde va la chaveta), **ovalado** hacia un lado. La **chaveta** es la cuña
que va metida en esa ranura y amarra el piñón o la polea al cigüeñal. Un
chavetero ovalado suele venir de un **perno del cigüeñal flojo**: el piñón o
la polea se mueven un poco en cada giro y van comiéndose la ranura. Por eso
el catálogo de `four-stroke.md` suma (ids provisionales, A11 los fija):

- `crankBolt.loose`: la causa raíz. Juego del piñón o la polea sobre el
  cigüeñal.
- `crankKey.keywayWorn`: el chavetero ovalado, un desfase de pocos grados
  que varía con la carga y un golpeteo. Si sigue, termina en
  `crankKey.sheared`.

## 4. Cambios en docs vivos (este commit)

`NORTE.md` (alcance), `SISTEMAS.md` (arquetipos, carrocería),
`modules/four-stroke.md` (fallas), `HORIZONTE_JUEGO.md` (soldadura),
`AHORA.md` (fila de A10), y el aviso al inicio del plan anterior.
