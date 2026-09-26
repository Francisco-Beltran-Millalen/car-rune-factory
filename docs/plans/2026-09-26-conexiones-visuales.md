# Plan V1 — Conexiones visuales (mangueras que llegan a sus piezas)

> Escrito por el agente planificador el 2026-09-26, a pedido del usuario:
> "hay varias mangueras y diagramas que no tienen conexión unas con otras".
> Es una tarea de core (render + contrato) y se implementa en la misma
> sesión. Lo vivo queda en `CONTRATOS.md` §6.4 y en `FICHAS.md` (Contexto
> común); este archivo es el registro.

## 1. Diagnóstico (lo que se encontró en el código)

1. **Las puntas de una manguera eran coordenadas a mano.** Si un enlace
   traía `route`, el renderer dibujaba esos puntos tal cual: nada ligaba la
   primera y la última coordenada al puerto de la pieza. Los drawers de
   combustible y encendido declaraban `ports`, pero sólo se usaban cuando el
   enlace **no** traía ruta; los de refrigeración y lubricación ni los
   declaraban.
2. **Un enlace con `route` y sin `visual` se dibujaba igual**, con la clase
   por defecto `fluid-fuel`: tubos color combustible en refrigeración y
   lubricación, y tubos que sólo existen en el modelo (la referencia `ref` de
   una válvula de alivio) dibujados como mangueras que no van a ningún lado.
3. **Piezas dibujadas dentro de otro drawer** (el fusible, el relé y el motor
   del electroventilador dentro del ventilador; la llave del calefactor
   dentro del calefactor; la rejilla dentro del cárter) tenían sus cables y
   tubos apuntando a su `x/y` de la definición, que no es donde se dibujan.
4. **Nada lo detectaba.** Los tests revisaban la física y que cada pieza
   tuviera drawer; no que una manguera tocara su pieza, que no cruzara el
   cuerpo de otra, ni que un nudo no quedara colgando.

## 2. Qué se entrega

### 2.1. Geometría pura por tipo visual

Cada entrada del catálogo `DRAWERS` pasa a ser `{ geometry, draw }`:

```ts
interface Rect { x: number; y: number; w: number; h: number }
interface PartGeometry {
  /** El cuerpo de la pieza (sin etiquetas): nada lo cruza. */
  box: Rect;
  /** Puertos del elemento, en coordenadas absolutas, sobre el borde del box. */
  ports?: Readonly<Record<string, Point>>;
  /** Piezas que este drawer dibuja adentro (por id de pieza): su caja y sus puertos. */
  subparts?: Readonly<Record<string, { box: Rect; ports?: Readonly<Record<string, Point>> }>>;
}
type GeometryFn = (part: CircuitPartDef, def: CircuitDef) => PartGeometry;
```

La geometría es **pura** (sin DOM): la usan el renderer, el chequeo y la
hoja de layout. `Drawer.ports` desaparece (lo reemplaza `geometry.ports`) y
el drawer recibe `geo` en su contexto. La caja declarada es el cuerpo que el
drawer dibuja: si se cambia uno, se cambia el otro (mismo archivo).

### 2.2. `CircuitLinkDef.via` reemplaza a `route`

- `via?: readonly Point[]`: **sólo los codos intermedios**. El renderer
  dibuja `[puerto de from, ...via, puerto de to]`: las puntas salen de la
  geometría, nunca del autor.
- **Se dibuja sólo si trae `visual`** (con su `pipeClass`). Un enlace sin
  `visual` es sólo del modelo (referencias, térmicos, nudos internos).
- Todos los tramos son horizontales o verticales.
- Punta en un **nudo** (`hydroNode`, `junction`, `tee`, `thermalNode`): su
  `x/y`. Con 3 o más enlaces dibujados, el renderer pone un punto de unión.
- Punta en una **sub-pieza**: el puerto que declara el drawer que la dibuja.

### 2.3. `CircuitPartDef.joinedBy` (opcional)

Para una pieza cuya conexión la dibuja el drawer de otra (los inyectores
colgando del tubo del riel): `joinedBy: 'rail'`. El chequeo exige que las
cajas se toquen y no la cuenta como aislada ni como solapada con esa pieza.

### 2.4. Chequeo de layout (`src/render/svg/layout.ts`)

`checkLayout(def, viewBox)` devuelve una lista de problemas. **Error**
(falla el test):

| código | qué detecta |
|---|---|
| `visual-sin-drawer` | `visual` que no existe en el catálogo |
| `extremo-sin-pieza` | punta de un enlace dibujado en una pieza que no se dibuja, no es sub-pieza ni nudo |
| `puerto-inexistente` | el puerto no está en la geometría |
| `tramo-diagonal` | un tramo que no es horizontal ni vertical |
| `tubo-cruza-pieza` | un tramo que pasa por el interior de una caja (la propia incluida: sale hacia adentro) |
| `nudo-colgando` | un nudo con un solo enlace dibujado (manguera al vacío) |
| `pieza-aislada` | pieza de red dibujada sin ningún enlace dibujado (ni `joinedBy`) |
| `piezas-solapadas` | dos cajas que se pisan (sub-piezas y `joinedBy` aparte) |
| `tubos-encimados` | dos enlaces que corren uno sobre otro sin compartir nudo |
| `fuera-del-lienzo` | caja fuera del `viewBox` |
| `union-lejana` | una pieza o nudo con `joinedBy` cuya caja no toca la de su pieza |

El test `tests/render/layout.test.ts` recorre **todos** los descriptores de
`modules/registry.ts`: un laboratorio nuevo queda cubierto sin tocar el
test. Tests unitarios fijan que cada código dispara.

### 2.5. Hoja de layout (`npm run layout`)

`renderLayoutSheet(def, viewBox, issues)` arma un SVG estático: cajas con su
id, puertos con nombre y coordenadas, mangueras por color de fluido, nudos y
los problemas en rojo. `npm run layout` escribe una hoja por laboratorio en
`layout-sheets/` (ignorada por git). Sirve para ubicar coordenadas al
escribir `via` **antes** de abrir Firefox; no reemplaza la revisión del
usuario (§13). Con `rsvg-convert` (si está en el sistema) se pasa a PNG.

## 3. Rediseño de los laboratorios existentes

Con el chequeo en verde y la hoja a la vista, se rehacen los layouts:

- **Refrigeración** (dos variantes): el circuito del electroventilador se
  cablea a las sub-piezas del ventilador (fusible, relé, motor); el radiador
  y la bomba quedan con sus puertos en el borde; ningún tubo cruza el
  bloque; la llave del calefactor en su puerto.
- **Lubricación** (dos variantes): rejilla como sub-pieza del cárter; bypass
  como sub-pieza del filtro; interruptor como sub-pieza del testigo; las
  referencias de las válvulas dejan de dibujarse; retornos que caen al
  cárter por su puerto.
- **Encendido** (dos variantes) y **combustible**: se migran a `via` y se
  corrige lo que marque el chequeo, sin cambiar el aspecto que el usuario ya
  aprobó salvo donde el chequeo muestre un defecto.
- **4 tiempos**: sin enlaces; sólo solapes y lienzo.

## 4. Archivos

- Nuevos: `src/render/svg/layout.ts` (geometría común, chequeo y hoja),
  `tests/render/layout.test.ts`.
- Cambian: `src/render/svg/{types,index}.ts`, `drawers/index.ts` y cada
  drawer (exporta su geometría), `src/sim/circuit/types.ts` (`via`,
  `joinedBy`), `src/sim/circuit/validate.ts` si nombra `route`, las
  `circuit.ts` de los cinco módulos, `package.json` (script), `.gitignore`,
  `knip.json` si hace falta.
- Docs: `CONTRATOS.md` §6.4 y la definición de `CircuitLinkDef`;
  `FICHAS.md` (Contexto común + aceptación de cada ficha pendiente);
  `plans/2026-09-26-vehiculo.md` (`translateCircuit` mueve `via`, no
  `route`); `AHORA.md` (tarea V1 y su CERRADO con la checklist).

## 5. Qué cambia para las fases siguientes

Va a `FICHAS.md`, Contexto común, y a la aceptación de cada ficha:

- Todo drawer nuevo exporta su geometría (caja del cuerpo, puertos en el
  borde, sub-piezas) en el mismo archivo.
- Los enlaces que se ven llevan `visual`; los codos van en `via`; las puntas
  nunca se escriben.
- **Aceptación de toda tarea con vista**: `tests/render/layout.test.ts` sin
  errores (corre en `npm run check`) y la hoja de `npm run layout` revisada
  antes de dejar la checklist de Firefox.
- A15: `translateCircuit` desplaza `x/y` y `via`; el chequeo corre sobre el
  vehículo compuesto (el cruce entre sistemas también cuenta).

## 6. Checklist de Firefox (va a `AHORA.md`)

En cada laboratorio: ninguna manguera ni cable termina en el aire; cada tubo
entra a su pieza por un borde; ninguno pasa por encima del cuerpo de otra
pieza; los colores son los del fluido (aceite ámbar, refrigerante verde
agua, combustible, eléctrico). En particular:

1. `#/lab/cooling-electric`: batería → fusible → relé → motor del
   ventilador → masa, todos tocando sus cajas.
2. `#/lab/lubrication-lamp`: cárter → rejilla → bomba → alivio/filtro →
   galería → cojinetes → retorno al cárter, sin tubos sueltos.
3. Combustible, encendido (platinos y COP) y 4 tiempos se ven como antes o
   mejor; el quiz sigue jugable.
