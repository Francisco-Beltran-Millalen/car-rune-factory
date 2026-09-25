# Plan: TypeScript estricto y leyes verificadas por herramientas

> **Cerrado (2026-09-25).** TS0–TS5 hechas; informe en `docs/informes/2026-09-25-migracion-typescript.md`. No hay nada pendiente aquí salvo TS 7 (ver `AHORA.md`).

Fecha: 2026-09-24. Aprobado por el usuario el mismo día ("vamos con lo de
typescript primero"). Va **antes de A3** y no cambia el orden de A3–A10.

## 0. Resumen para el agente que lo implementa

1. Portar todo `src/` y `tests/` de JS a **TypeScript estricto**, **sin cambiar
   el comportamiento**: los 109 tests siguen verdes y el laboratorio y el
   quiz se ven y se usan igual.
2. Agregar herramientas de desarrollo (nada entra al bundle, §17 intacto) que
   detecten errores **antes de ejecutar**: `tsc`, `typescript-eslint` con
   reglas que traducen las leyes de `ARCHITECTURE.md` a lint, `knip` (código
   y dependencias muertas) y `vite-plugin-checker` (errores en el overlay de
   `npm run dev`).
3. Un único comando de cierre, `npm run check`, que se exige en todas las
   tareas desde ahora.
4. Se trabaja en 6 fases (TS0–TS5). Cada una termina con `npm run check` en
   verde y un commit, directo en `main` (sin ramas).

Lee antes: `docs/ARCHITECTURE.md`, `docs/CONTRATOS.md`, `src/core/types.js`
y `src/game/types.js` (hoy los tipos son JSDoc y nadie los verifica).

## 1. Contexto y datos medidos (2026-09-24)

- 52 archivos `.js`, ~5.300 líneas en `src/` + `tests/`. No hay `tsconfig`
  ni `checkJs`, así que los typedefs JSDoc son decorativos.
- Sonda hecha con `typescript@6.0.3` en modo `checkJs` + `strict` +
  `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` sobre el código
  actual: **697 errores**. Los más frecuentes:

  | Código | Cantidad | Qué es |
  |---|---|---|
  | TS7006 | 323 | parámetro con `any` implícito |
  | TS2339 | 159 | propiedad que no existe en el tipo (sobre todo `state = {}` en `fuel/model.js`) |
  | TS7005/7034 | 81 | variable con `any` implícito (`let rng;`) |
  | TS7053 | 25 | indexar con `string` un objeto sin índice |
  | TS2532/18048 | 34 | posible `undefined` (por `noUncheckedIndexedAccess`) |

  Por archivo, los peores son `modules/fuel/model.js` (109),
  `tests/game/quiz.test.js` (51), `game/modes/quiz.js` (46),
  `tests/fuel/model.test.js` (42) y `core/svg.js` (42).
- Casi todos son de **inferencia**, no bugs. Ejemplo: `pipe(parent, points,
  { width = 10, radius = 14, className, part } = {})` sí maneja `part`, pero
  JSDoc infiere el tipo de opciones desde el objeto por defecto. Otro:
  `markSuspect(partId, mark = null)` infiere `mark: null`. Al portar se
  arreglan declarando los tipos, **no** cambiando la lógica.
- Cosas reales que el compilador pide resolver:
  - `core/shell.js:163` recibe `ModuleDescriptor | { module, stage, attempt }`
    y lee propiedades de las dos formas sin discriminar.
  - `core/shell.js:386` usa `window.__sim` (hook de depuración) → requiere
    `declare global`.
  - `core/router.js` acepta `Object | Window` como `win` → definir una
    interfaz mínima `HashWindow` (`location.hash`, `add/removeEventListener`).
  - `main.js`: `document.getElementById('app')` puede ser `null`.
- Tests que leen archivos fuente por ruta (hay que actualizarlos al
  renombrar): `tests/game/quiz.test.js:291` y
  `tests/fuel/content.test.js:117` leen `src/modules/fuel/view.js`.

## 2. Decisiones (con el porqué)

**D1. TypeScript 6.0, no 7.** `npm view typescript` da `latest = 7.0.2` (el
compilador nativo en Go), pero `typescript-eslint@8.70.1` declara
`peerDependencies.typescript: ">=4.8.4 <6.1.0"`: el lint con tipos no
funciona con TS 7 (tampoco en `canary` 8.70.2-alpha.7). Se fija
`typescript@~6.0.3`. **Opción A**, elegida por el usuario el 2026-09-24
después de comparar (ver 2.1). Subir a 7 es una tarea aparte (sección 12).

### 2.1 Comparación TS 6 + ESLint (A) vs. TS 7 + oxlint (B)

Medido el 2026-09-24 con `oxlint@1.85.0` + `oxlint-tsgolint@7.0.2003` y
`typescript@7.0.2`:

- **El código `.ts` es el mismo con las dos opciones.** Sobre el prototipo de 8.1,
  TS 6.0.3 y TS 7.0.2 dan exactamente el mismo error (0,35 s TS 7 vs. 1,27 s
  TS 6). Sobre el JS actual con `checkJs`: 697 errores en TS 6 y 704 en TS 7.
  Las diferencias son sólo de JSDoc (TS2694 en `import('…')` de JSDoc, TS2488
  en destructuring inferido), que desaparecen con TS5.
- **B tiene huecos hoy:** oxlint no tiene `no-restricted-syntax` ni
  equivalente de `eslint-comments/require-description`;
  `no-unnecessary-condition` está en "nursery"; `oxlint-tsgolint` salió el
  mismo día; el chequeo de tipos de `vite-plugin-checker` usa la API JS de
  TypeScript (`ts.sys`), que TS 7 no trae. Lo que sí funciona en B (probado):
  `switch-exhaustiveness-check`, `no-floating-promises`,
  `no-restricted-properties` con tipos.
- **A cubre todas las reglas del plan** con herramientas maduras. Lo único
  que se pierde es velocidad, que con ~5.300 líneas no se nota.
- **Migrar después cuesta poco y está acotado** (sección 12): no crece con
  las líneas de código, sólo con la config de lint y la cantidad de
  `eslint-disable`. Por eso no vale la pena aceptar hoy los huecos de B.

**D2. `.ts` de verdad, no JSDoc + `checkJs`.** Uniones discriminadas,
genéricos y `satisfies` son ilegibles en JSDoc, y el solver (A4/A5) va a
depender de ellos. JSDoc + `checkJs` sólo se usa **durante** la migración
(TS0–TS4) para que lo que falta portar ya sirva de algo.

**D3. Sintaxis sólo borrable** (`erasableSyntaxOnly`): sin `enum`, sin
`namespace`, sin parameter properties. Vite/esbuild sólo borran tipos, y §7
ya pide uniones de strings en vez de `enum`.

**D4. Imports con extensión `.ts`** (`import { clamp } from './math.ts'`)
con `allowImportingTsExtensions`. El archivo se llama como se importa: nada
de "`.js` que en realidad es `.ts`". Vite y Vitest lo resuelven sin
configuración.

**D5. Las leyes que se pueden verificar con una herramienta, se verifican
con una herramienta.** El tipado no ve `NaN`, las unidades, el determinismo
ni las capas. Eso se cubre con reglas de ESLint que citan el § (sección 5) y
con una prueba que demuestra que esas reglas disparan (TS0.6).

**D6. Pocas dependencias, todas de desarrollo:**

| Paquete | Versión verificada 2026-09-24 | Para qué |
|---|---|---|
| `typescript` | `~6.0.3` | tipos, `tsc --noEmit` |
| `eslint` | `^10.11.0` | lint |
| `@eslint/js` | `^10.0.1` | reglas base recomendadas |
| `typescript-eslint` | `^8.70.1` | parser + `strictTypeChecked` |
| `@eslint-community/eslint-plugin-eslint-comments` | `^4.8.1` (peer `eslint ^10`, exporta `./configs`) | exige motivo en cada `eslint-disable` |
| `globals` | `^17.12.0` | globales de navegador/node para ESLint |
| `@types/node` | `^26` | `node:fs` en tests y `vite.config.ts` |
| `knip` | `^6.38.0` | archivos, exports y dependencias sin uso |
| `vite-plugin-checker` | `^0.14.5` (peer `vite >=5.4.21`, `eslint >=9.39.4`) | errores de tipos y lint en el overlay de `npm run dev` |

Vuelve a verificar las versiones con `npm view <paquete> version
peerDependencies` antes de instalar y anota lo que cambie en el `CERRADO`.

**D7. Lo que NO se agrega, y por qué:**
- **Prettier**: reformatear todo ensucia el diff de la migración. El estilo
  actual es consistente. Si se quiere, va en una tarea aparte con un commit
  sólo de formato.
- **Zod u otra validación en runtime**: el guardado ya valida a mano (§27) y
  sería una dependencia de runtime (§17).
- **husky / lint-staged**: proyecto personal; la regla es "no se cierra una
  tarea sin `npm run check`" (AGENTS.md).
- **`strict-boolean-expressions`, `no-magic-numbers`, `max-lines`**: mucho
  ruido o choca con reglas vigentes (las constantes físicas viven en `K`,
  §16 es una señal y no un bloqueo duro, y `core/shell.js` ya tiene 447
  líneas). `--max-warnings 0` convertiría un warning en bloqueo, así que
  estas reglas quedan fuera.
- **Tipos "branded" para unidades** (§5): cuesta mucho y rinde poco. Las
  unidades siguen respaldadas por la tabla de `modules/<id>.md` y los tests
  con rangos (§14).

**D8. El cast se paga con un comentario.** `as` (excepto `as const`) sólo en
fronteras: DOM (`querySelector`, `event.target`), `JSON.parse` ya validado,
y como mucho una vez en `defineModule` si el borrado de tipos no alcanza. Cada
`as` lleva un comentario de ≤1 línea que dice por qué es seguro. Sin
`@ts-ignore` ni `@ts-nocheck`; `@ts-expect-error` sólo con descripción (la
regla lo exige) y sólo en tests que prueban que algo **no** compila.

**D9. No se borran chequeos de runtime porque "el tipo dice que no puede
pasar".** Lo que viene de afuera (eventos DOM, `localStorage`, hash de la
URL, intents de la UI, args de acciones) se tipa como `unknown` y se valida
con un type guard. El chequeo defensivo que hoy protege §6 se queda: si
`no-unnecessary-condition` lo marca, se ensancha el tipo de entrada a
`unknown`, no se borra el chequeo. Ejemplo: `accepts(current, value)` de
`game/modes/lab.js` sigue igual, con `value: unknown`.

## 3. `tsconfig.json` (uno solo, en la raíz)

```jsonc
{
  "compilerOptions": {
    "target": "ES2023",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "types": ["vite/client", "node"],
    "noEmit": true,
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "erasableSyntaxOnly": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,

    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noPropertyAccessFromIndexSignature": true,
    "useUnknownInCatchVariables": true,
    "noUnusedLocals": false,          // lo cubre ESLint (permite el prefijo _)
    "noUnusedParameters": false,

    "allowJs": true,                  // sólo TS0–TS4; en TS5 pasa a false
    "checkJs": false                  // ver TS0.3
  },
  "include": ["src", "tests", "vite.config.ts"]
}
```

- TS 6 cambió varios valores por defecto; por eso todo va explícito.
- `types: ["node"]` hace visible `process`/`Buffer` también en `src/`. Lo
  prohíbe ESLint (sección 5.3), no el tsconfig: separar libs por carpeta
  exigiría project references, y no vale la pena con este tamaño.
- `vite/client` tipa el `import './fuel.css'`.

## 4. Scripts de `package.json`

```jsonc
"scripts": {
  "dev": "vite",
  "build": "tsc -p . && vite build",      // Vite no revisa tipos: sin esto el build pasa con errores
  "preview": "vite preview",
  "typecheck": "tsc -p .",
  "lint": "eslint . --max-warnings 0",
  "lint:fix": "eslint . --fix",
  "knip": "knip",
  "test": "vitest run",
  "test:watch": "vitest",
  "check": "npm run typecheck && npm run lint && npm run knip && npm test && npm run build"
}
```

`npm run check` es el criterio de cierre de **toda** tarea desde TS0
(reemplaza a "`npm test` + `npm run build`" de `AHORA.md`).

## 5. ESLint (`eslint.config.js`, flat config)

Queda en `.js` con `// @ts-check`: así no depende de cómo ESLint 10 cargue
configs en TS. Estructura:

```js
// @ts-check
// Leyes de ARCHITECTURE.md verificadas por lint. Cada bloque cita su §.
// Cambiar este archivo es tarea de core (§12, §33).
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import comments from '@eslint-community/eslint-plugin-eslint-comments/configs';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**'] },
  { linterOptions: { reportUnusedDisableDirectives: 'error', reportUnusedInlineConfigs: 'error' } },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  comments.recommended,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
      globals: { ...globals.browser },
    },
  },
  // 5.1 Reglas generales de TS
  // 5.2 Capas e imports (§11, §17, §19, §22)
  // 5.3 Pureza y determinismo (§1, §3, §21)
  // 5.4 DOM seguro, factories y enums (§17, §18, §7)
  // 5.5 Tests
  // 5.6 Mientras quede JS (TS0–TS4): tseslint.configs.disableTypeChecked para **/*.js
);
```

### 5.1 Reglas generales (todos los `.ts`)

| Regla | Config | Por qué |
|---|---|---|
| `@typescript-eslint/switch-exhaustiveness-check` | `error`, `{ considerDefaultExhaustiveForUnions: false, requireDefaultForNonUnion: true }` | un intent o estado nuevo rompe cada `switch` que lo ignora (§7, §20) |
| `@typescript-eslint/consistent-type-imports` | `error` | va con `verbatimModuleSyntax` y hace que los imports sólo de tipos no cuenten como dependencia de capa (5.2) |
| `@typescript-eslint/consistent-type-assertions` | `error`, `{ assertionStyle: 'as', objectLiteralTypeAssertions: 'never' }` | D8 |
| `@typescript-eslint/explicit-module-boundary-types` | `error` en `src/**` | los contratos (factories exportadas) declaran su tipo de retorno |
| `@typescript-eslint/no-explicit-any` | `error` (ya viene en strict) | usar `unknown` + guard |
| `@typescript-eslint/ban-ts-comment` | `{ 'ts-expect-error': 'allow-with-description', minimumDescriptionLength: 10 }` | D8 |
| `@typescript-eslint/no-unused-vars` | `error`, `{ argsIgnorePattern: '^_', varsIgnorePattern: '^_' }` | |
| `@typescript-eslint/restrict-template-expressions` | `error`, `{ allowNumber: true }` | los paths SVG interpolan números todo el tiempo |
| `@eslint-community/eslint-comments/require-description` | `error` | cada `eslint-disable` dice por qué |
| `@eslint-community/eslint-comments/no-unlimited-disable` | `error` (viene en recommended) | |
| `eqeqeq` | `['error', 'always', { null: 'ignore' }]` | |
| `no-console` | `['error', { allow: ['warn', 'error'] }]` | |

### 5.2 Capas e imports

Se usa `@typescript-eslint/no-restricted-imports` (desactivando el
`no-restricted-imports` base) con `allowTypeImports: true`: importar un
**tipo** de otra capa está permitido y no crea dependencia en runtime. Usa
patrones con **`regex`** sobre el especificador (p. ej.
`'(^|/)render/'`), no globs: los globs no se llevan bien con rutas que empiezan
con `../`.

| Archivos | No pueden importar (en runtime) | Ley |
|---|---|---|
| **todo** salvo `src/render/phaser/**` | `phaser` | §17 |
| **todo** | `…/render/phaser/…` de forma estática (el `import()` dinámico **sí** se permite: la regla no mira `import()`) | §17 |
| `src/core/{math,rng,loop,history,format,types}.ts` ("core puro") | `core/{dom,svg,particles,shell,router}`, `core/ui/`, `game/`, `modules/`, `sim/`, `presenter/`, `render/`, `ui/` | §1, §19 |
| `src/sim/**` | `game/`, `presenter/`, `render/`, `ui/`, `modules/`, `core/{dom,svg,particles,shell,router}`, `core/ui/` | §19 |
| `src/modules/<id>/{model,content,specs,narrate}.ts` y futuros `{faults,diagnosis,circuit,controllers,reference-model}.ts` | lo mismo que `sim/` **más** otro módulo (regex `^\.\./(?!\.\.)` = un hermano en `modules/`) | §1, §11 |
| `src/modules/<id>/view.ts` | `game/`, `render/`, `ui/`, otro módulo | §11 |
| `src/game/**` | `render/`, `ui/`, `presenter/`, `core/{dom,svg,particles,shell,router}`, `core/ui/`, `modules/` | §19, §21 |
| `src/presenter/**` | `render/`, `ui/`, `core/{dom,svg,particles,shell,router}`, `core/ui/` | §19 |
| `src/render/**` salvo `render/legacy/**` | `sim/`, `modules/*/model`, `game/` salvo `game/intents` y `game/types` | §20, §22 |
| `src/ui/**`, `src/core/ui/**` | `sim/`, `modules/*/model`, `render/`, `presenter/` | §19 |

`render/legacy/**` queda exento de §22 hasta A7, como dice la ley.

Hoy el código ya cumple estas reglas (verificado con `grep`), **salvo una
cosa**: `modules/fuel/narrate.js` importa `fmt` desde `core/dom.js`, y eso
arrastra el DOM a un archivo puro. En TS1 `fmt` se mueve a
`src/core/format.ts` (puro); `dom.ts` lo reexporta **sólo si** algo más lo
sigue necesitando desde ahí (si no, se actualizan los imports y `knip` lo
confirma).

### 5.3 Pureza y determinismo

Aplica a: "core puro", `src/sim/**`, `src/game/**`, `src/presenter/**` y los
archivos puros de `src/modules/<id>/` (tabla 5.2).

- `no-restricted-globals`: `document`, `window`, `navigator`, `location`,
  `localStorage`, `sessionStorage`, `requestAnimationFrame`,
  `cancelAnimationFrame`, `performance`, `setTimeout`, `setInterval`,
  `fetch`, `process`, `Buffer`, `require`, `__dirname`.
- `no-restricted-properties`: `Math.random`, `Date.now`, `performance.now`,
  `globalThis.localStorage`, `globalThis.document`, `globalThis.window`.
- `no-restricted-syntax`: `NewExpression[callee.name='Date']`.

Mensaje de cada una: `"§1/§3: el modelo es puro; el azar sale de core/rng.ts
y el tiempo de step(dt)"`.

**Excepciones explícitas, en la config y no inline** (hoy existen y son
legítimas):
- `src/game/save.ts`: `globalThis.localStorage` y `new Date()` (frontera de
  E/S del guardado, §27).
- `src/core/loop.ts` y `src/game/session.ts`: `requestAnimationFrame` sólo
  como valor por defecto del parámetro `raf` inyectable.

En **todo** `src/**` (también en los archivos con DOM) están prohibidos
`process`, `Buffer`, `require` y `__dirname`.

### 5.4 DOM seguro, factories y enums

En todo `src/**`:
- `no-restricted-properties`: `innerHTML`, `outerHTML`,
  `insertAdjacentHTML` (§17: se usan `core/dom.ts` y `core/svg.ts`).
- `no-restricted-syntax`: `ClassDeclaration` y `ClassExpression` (§18:
  factories), **excepto** en `src/render/phaser/**`, porque Phaser exige
  `class X extends Phaser.Scene`. También `TSEnumDeclaration` (§7; lo
  frena también `erasableSyntaxOnly`, pero el mensaje de lint cita la ley).

### 5.5 Tests (`tests/**`)

- `globals.node` además de `globals.browser`.
- Se permiten `@typescript-eslint/no-non-null-assertion` y
  `explicit-module-boundary-types: off` (con `noUncheckedIndexedAccess` los
  tests indexan mucho y fallar ahí es fallar el test, que es lo correcto).
- `@typescript-eslint/no-floating-promises` sigue activa: un `expect` async
  sin `await` es un test que no prueba nada.

### 5.6 Transición

Mientras quede `.js` (TS0–TS4): un bloque `files: ['**/*.js']` con
`...tseslint.configs.disableTypeChecked`. Así las reglas de 5.2–5.4 (que no
necesitan tipos) ya valen para el JS que falta portar. En TS5 este bloque
se borra, salvo para `eslint.config.js`.

## 6. `knip.json`

```json
{
  "$schema": "https://unpkg.com/knip@6/schema.json",
  "entry": ["src/main.ts", "tests/**/*.test.ts"],
  "project": ["src/**/*.ts", "tests/**/*.ts"],
  "ignoreExportsUsedInFile": true
}
```

- Knip detecta solo los plugins de Vite, Vitest y ESLint. Si algo no se
  detecta, se ajusta en `knip.json` y se anota el porqué en el `CERRADO`.
- Un tipo o export que es **contrato reservado** para una tarea futura
  (p. ej. intents de armado `placePart`/`connect`, que usa A9) se marca con
  `/** @public — A9 */` (knip respeta `@public`). No se borra un contrato
  documentado en `CONTRATOS.md` sólo porque todavía no tenga uso.
- Lo demás que knip reporte se **borra**, no se ignora.
- `src/modules/_demo/` sólo lo usan tests (`tests/core/ui-pure.test.js`).
  Knip lo va a ver como usado (los tests son entry). Se porta igual que el
  resto; decidir si se borra no es parte de este plan.

## 7. `vite.config.ts`

```ts
import { defineConfig } from 'vitest/config';
import checker from 'vite-plugin-checker';

export default defineConfig(({ command }) => ({
  plugins:
    command === 'serve' && !process.env.VITEST
      ? [checker({ typescript: true, eslint: { lintCommand: 'eslint "./src/**/*.ts"', useFlatConfig: true } })]
      : [],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],   // en TS0–TS4: 'tests/**/*.test.{js,ts}'
    passWithNoTests: true,
  },
}));
```

- `defineConfig` viene de `vitest/config` para que la clave `test` tenga
  tipos.
- El checker sólo corre en `npm run dev`. En el build la barrera es el `tsc`
  del script. Verifica que Vitest no levante el checker (condición
  `VITEST`); si la API del plugin cambió, adáptalo y anótalo.

## 8. Diseño de tipos (lo que las fases tienen que respetar)

Prototipado y compilado con `tsc 6.0.3 --strict --exactOptionalPropertyTypes
--noUncheckedIndexedAccess` el 2026-09-24: la forma de abajo compila, el
borrado a `AnyModel` **no necesita casts**, `m.state.pRail = 3` fuera del
modelo **no compila** (§2) y un typo en `params` tampoco.

### 8.1 Modelo y descriptor — `src/core/types.ts`

```ts
export type ParamValue = number | boolean | string;
export type ParamRecord = Record<string, ParamValue>;
// Las acciones reciben args de la UI/presets: los validan en runtime (§6).
export type ModelActions = Readonly<Record<string, (...args: unknown[]) => void>>;

export interface Model<
  P extends ParamRecord = ParamRecord,
  F extends ParamRecord = ParamRecord,
  S extends object = object,
> {
  readonly params: P;            // escriben sólo modos y tests (§2, §20)
  readonly faults: F;
  readonly state: Readonly<S>;   // §2: afuera es de sólo lectura
  readonly actions: ModelActions;
  readonly time: number;
  step(dt: number): void;
  reset(): void;
}
export type AnyModel = Model;

export interface ReadoutSpec<S extends object = object> {
  id: string; label: string; unit: string; decimals?: number;
  get(state: Readonly<S>): number;       // sintaxis de MÉTODO: ver nota
  gauge?: { min: number; max: number; green?: readonly [number, number] };
  history?: boolean;
}

export interface ModuleDescriptor<M extends AnyModel = AnyModel> {
  id: string; title: string; summary: string; order: number;
  viewBox: readonly [number, number, number, number];
  createModel(): M;
  createView(ctx: ViewContext<M>): View;
  defaultParams: Readonly<M['params']>;
  defaultFaults: Readonly<M['faults']>;
  controls: readonly ControlSpec<M>[];
  faults: readonly FaultSpec<M>[];
  readouts: readonly ReadoutSpec<M['state']>[];
  parts: Readonly<Record<string, PartInfo>>;
  narrate(model: M): Narration[];
  presets?: readonly Preset<M>[];
}

/** Único punto donde un descriptor concreto pasa a la lista genérica del registry. */
export function defineModule<M extends AnyModel>(d: ModuleDescriptor<M>): ModuleDescriptor {
  return d;
}
```

Notas:
- **Nota de varianza**: los callbacks que reciben tipos del módulo (`get`,
  `createView`, `narrate`, `createModel`, `disabledWhen`) se declaran con
  **sintaxis de método** (`get(state): number`), no de propiedad
  (`get: (state) => number`). Los métodos son bivariantes, y por eso
  `ModuleDescriptor<FuelModel>` se asigna a `ModuleDescriptor` sin cast. Si
  `@typescript-eslint/method-signature-style` o `unbound-method` se quejan,
  se desactivan **sólo** en `src/core/types.ts` con motivo. Si aun así
  `defineModule` necesita un `as`, va ahí y en ningún otro lado (D8).
- `params`/`faults`/`state` de cada módulo se declaran con **`type`**, no
  con `interface`: un alias de objeto es asignable a `Record<string, …>`, una
  interfaz no (no tiene firma de índice implícita).
- `defineModule` es código de runtime (una función identidad) en un archivo
  de tipos. Si knip o la capa lo complican, muévelo a `src/core/module.ts`.

### 8.2 Tipos por módulo (combustible)

En `src/modules/fuel/model.ts`:

```ts
export type IgnitionKey = 'off' | 'on' | 'start' | 'run';
export type EngineState = 'off' | 'cranking' | 'running' | 'misfire' | …;  // leer model.js y fuel.md: todos los valores
export type FuelParams = { ignitionKey: IgnitionKey; rpm: number; throttle: number; batteryV: number; fastConsumption: boolean };
export type FuelFaults = { strainerClog: number; filterClog: number; pumpWear: number;
  relay: 'ok' | 'intermittent' | 'dead'; regulator: 'ok' | 'stuckOpen' | 'stuckClosed';
  vacuumHoseOff: boolean; injectorLeak: number; lineLeak: number };
export type FuelState = { engineState: EngineState; pRail: number; /* bar rel. */ … };
export type FuelModel = Model<FuelParams, FuelFaults, FuelState>;
export const DEFAULT_PARAMS: Readonly<FuelParams> = { … };
```

- `FuelState` se escribe **completo** a partir de `initState()` y de la
  tabla de estado de `docs/modules/fuel.md` (§5: la tabla manda en las
  unidades). Cada campo lleva la unidad en un comentario corto. Si la tabla y
  el código no coinciden, **se para y se anota**: no se "arregla" la física
  en esta tarea.
- `state` se crea con todos sus campos (hoy es `{}` + `Object.assign`). El
  `reset()` sigue mutando **el mismo objeto** (`CONTRATOS.md`: la UI guarda
  referencias).
- `injectors: { open: boolean }[]` → `readonly { open: boolean }[]` en la
  vista externa (el `Readonly<S>` es superficial; los arrays del estado se
  declaran `readonly` en `FuelState` y adentro del modelo se muta el
  elemento, no el array).
- Los ids de fallas **no** se renombran a `<partId>.<falla>` (§26): eso es
  A3. Aquí sólo se tipan las claves actuales.
- Las acciones: `setTank(liters: unknown)` con `Number(liters) || 0` y
  `clamp`, igual que hoy.

### 8.3 Intents — `src/game/intents.ts`

- `Intent` pasa a **unión discriminada** por `type`, con el payload exacto de
  cada uno (hoy es una bolsa de opcionales en `game/types.js`). La unión sale
  de un mapa, para no escribir cada tipo dos veces:

  ```ts
  type IntentPayloads = {
    setParam: { key: string; value: ParamValue };
    answer: { choiceId: string };
    markSuspect: { partId: string; mark: 'suspect' | 'cleared' | null };
    quit: {};  // usa Record<string, never> si el lint lo pide
    // … los 23 tipos actuales de INTENT_TYPES
  };
  export type IntentType = keyof IntentPayloads;
  export type Intent = { [K in IntentType]: { type: K } & IntentPayloads[K] }[IntentType];
  export type IntentOf<K extends IntentType> = Extract<Intent, { type: K }>;
  ```

- `INTENT_TYPES` queda como objeto `as const satisfies Record<IntentType,
  IntentType>` (los tests y los modos lo usan).
- `intents.*` (los constructores) quedan tipados. `value` de `setParam` y
  `setFault` es `ParamValue`, y el modo sigue validando con `accepts` (D9).
- Todo `switch (intent.type)` de los modos queda exhaustivo: cada caso que el
  modo ignora se lista y devuelve `[]`, en vez de caer en un `default`
  silencioso (lo exige 5.1).
- Los tests de TS3 incluyen **un** `@ts-expect-error` que prueba que un
  intent mal formado no compila (p. ej. `answer` sin `choiceId`).

### 8.4 Resto de `game/types.ts`

- `ModeEvent`: unión discriminada (`feedback | score | stageEnd | uiChanged |
  highlight`), cada uno con su payload.
- `GameMode.status`: `'playing' | 'won' | 'lost' | 'free'` (ya lo es).
- `Stage.config` y `ModeContext.stage`: hoy son `Object`. Se tipan con lo que
  realmente usa `quiz.js` (leer el código, no adivinar); `config` como unión
  por `mode`.
- `SaveData`: tipo exacto. `loadSave(raw: string | null): SaveData` parsea a
  `unknown` y valida con guards (hoy ya sanea a mano: se conserva esa lógica
  tal cual). `SaveApi.recordStage`/`recordAnswer` hoy devuelven `Object`:
  tiparlos con lo que realmente devuelven.
- `Session.loop`/`recorder`: `ReturnType<typeof createLoop>` → mejor exportar
  `Loop` y `Recorder` como tipos nombrados desde `core/loop.ts` y
  `core/history.ts`.

### 8.5 DOM y SVG — `core/dom.ts`, `core/svg.ts`

- `h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs?: Attrs, ...children:
  Child[]): HTMLElementTagNameMap[K]`, con `Child = Node | string | number |
  false | null | undefined | Child[]`.
- `el<K extends keyof SVGElementTagNameMap>(…)`: lo mismo con
  `SVGElementTagNameMap`.
- `setAttrs` hace `node[k] = v` con clave dinámica: usar `Reflect.set(node, k,
  v)` en vez de un cast.
- Opciones de `pipe`, `box`, `label` y `gaugeSvg`: interfaces explícitas con
  **todas** las claves que el código lee (`part`, `size`, `ticks`, `green`…).
  Es la causa de muchos de los errores de la sonda.

### 8.6 Shell y router

- `shell.mount` recibe una unión discriminada: `{ kind: 'lab'; module } |
  { kind: 'stage'; module; stage; attempt }`. Se actualizan todos los
  llamadores (hoy la función adivina la forma por las propiedades).
- `window.__sim`: `declare global { interface Window { __sim?: … } }` en
  `core/shell.ts`, con un comentario de que es un hook de depuración.
- `createRouter(onRoute, win: HashWindow = window)`, con `HashWindow` como
  interfaz mínima (`location: { hash: string }`, `addEventListener`,
  `removeEventListener`). Así los tests del router siguen pasando un objeto
  falso sin cast.

## 9. Fases

Orden: TS0 → TS1 → TS2 → TS3 → TS4 → TS5. Todas en `main`, un
commit por fase (`chore(ts): TS<n> — …`). **Criterio común de cierre:**
`npm run check` en verde, los 109 tests (o los que haya) pasan sin tocar sus
aserciones, y `git diff --stat` no muestra archivos fuera de la lista de la
fase salvo imports que cambian de extensión.

**Regla de oro de la migración:** portar ≠ refactorizar. Se cambian tipos,
extensiones e imports. Un cambio de lógica sólo se hace si el compilador
encuentra un bug real, y entonces va en un commit aparte `fix(…)` con un test
que lo reproduce y una línea en el `CERRADO`.

### TS0 — Herramientas (sin portar código todavía)

1. `npm i -D` los paquetes de D6 (volver a verificar versiones).
2. `tsconfig.json` de la sección 3 (`allowJs: true`, `checkJs: false`).
3. `eslint.config.js` completo (sección 5, incluido el bloque de transición
   5.6). Correr `npm run lint` sobre el JS actual: **las reglas de ley deben
   pasar sin excepciones nuevas** más allá de las de 5.3. Si alguna falla, es
   una violación real de una ley: se anota en el `CERRADO` y se arregla en un
   commit aparte.
4. `knip.json`, con `entry` en `.js` mientras tanto (`src/main.js`,
   `tests/**/*.test.js`). Lo que reporte se arregla o se justifica.
5. `vite.config.js` → `vite.config.ts` (sección 7, con `include` de tests
   para `.js` y `.ts`).
6. **Test de las leyes**: `tests/tooling/lint-laws.test.ts`. Usa la API de
   ESLint (`new ESLint({ overrideConfig: tseslint.configs.disableTypeChecked
   })` + `lintText(código, { filePath: 'src/sim/_fake.ts' })`, con rutas
   virtuales) y demuestra que **cada** regla de 5.2–5.4 dispara:
   - `Math.random()` en `src/modules/x/model.ts` → error.
   - `new Date()` en `src/game/modes/x.ts` → error; en `src/game/save.ts` → ok.
   - `import … from '../../render/x.ts'` en `src/game/x.ts` → error;
     `import type` del mismo → ok.
   - `import … from '../other/model.ts'` en `src/modules/fuel/model.ts` →
     error (§11).
   - `import Phaser from 'phaser'` en `src/render/svg/x.ts` → error; en
     `src/render/phaser/x.ts` → ok.
   - `node.innerHTML = s` en cualquier `src/` → error.
   - `class X {}` en `src/core/x.ts` → error; en `src/render/phaser/x.ts` → ok.
   - `enum E {}` → error.

   Si `lintText` con una ruta inexistente no funciona con la versión
   instalada, usa fixtures reales en `tests/tooling/fixtures/src/...`
   (excluidos del lint normal con `ignores` y del tsconfig), y anótalo.
   *Por qué*: una regla mal escrita (un regex que nunca matchea) no avisa
   nada; este test es lo único que prueba que la ley está protegida.
7. `package.json`: scripts de la sección 4. El `build` todavía no puede
   correr `tsc` sobre el JS sin tipar (con `checkJs: false` pasa: verifícalo).
8. **Aceptación**: `npm run check` verde, test de leyes verde y `npm run dev`
   muestra el overlay del checker si se agrega a mano un error de tipos en un
   `.ts` (se revierte después).

### TS1 — Core puro

Archivos: `src/core/{types,math,rng,loop,history}.js` → `.ts`, nuevo
`src/core/format.ts` (`fmt` sale de `dom.js`), y sus tests
`tests/core/{math,rng,loop,history}.test.js` → `.ts`.

- `types.ts` según 8.1 (reemplaza a `types.js`; los JSDoc `import('…types.js')`
  del JS que todavía no se portó pasan a apuntar a `types.ts`).
- `Rng`, `Loop` y `Recorder` exportados como tipos nombrados.
- `loop.ts`: `raf` y `now` siguen inyectables; la excepción de 5.3 ya cubre
  el default.
- `fmt` en `format.ts`. Actualiza `narrate.js` y los paneles que lo importan.

### TS2 — Core con DOM y UI

Archivos: `src/core/{dom,svg,particles,router}.js`, `src/core/ui/*.js` → `.ts`,
y `tests/core/{particles,ui-pure}.test.js`, `tests/game/router.test.js` →
`.ts`.

- `dom.ts`/`svg.ts` según 8.5; `router.ts` según 8.6.
- Paneles: `ControlSpec`, `FaultSpec` y `ReadoutSpec` genéricos en `types.ts`.
  Los paneles trabajan con la versión borrada (`AnyModel`).
- `controls.js:101` agrega `.spec` a un objeto después de crearlo: declara la
  propiedad en el tipo al crear el objeto.

### TS3 — Juego

Archivos: `src/game/**` → `.ts` (`types`, `intents`, `session`, `save`,
`campaign`, `stages/*`, `modes/{lab,quiz}`), `src/ui/hud.js` → `.ts`, y
`tests/game/{intents,session,save,lab,quiz}.test.js` → `.ts`.

- Según 8.3 y 8.4.
- `quiz.ts:129-131`, `:237`: los `possibly undefined` de
  `noUncheckedIndexedAccess` se resuelven con un guard explícito, **no** con
  `!`. Si el guard no puede fallar por construcción, un `if (!x) throw new
  Error('invariante: …')` documenta la invariante.
- El test de `quiz.test.ts:291` que lee `view.js` sigue apuntando a `view.js`
  hasta TS4.

### TS4 — Módulos

Archivos: `src/modules/{registry,_demo/*,fuel/*}.js` → `.ts`, y
`tests/fuel/{model,content}.test.js` → `.ts`.

- Según 8.2. `fuel/index.ts` exporta `defineModule({ … })`.
- `let rng; let prevKey; …` del modelo quedan con tipo explícito
  (`let rng: Rng`), inicializados en `initState()`. Si TS no ve la
  asignación antes del uso, inicialízalos en la declaración (`let prevKey:
  IgnitionKey = 'off'`), que es lo mismo que hace `initState`.
- Actualiza las rutas `view.js` → `view.ts` en `tests/game/quiz.test.ts` y
  `tests/fuel/content.test.ts`.
- **Verificación extra de "sin cambios de física"**: antes de empezar TS4,
  guarda (fuera del repo, en el scratchpad) el `state` completo del
  combustible tras 10 s simulados en 3 escenarios (arranque normal,
  `filterClog: 0.8`, `relay: 'dead'`) con semilla fija. Al terminar, compáralo
  con igualdad exacta (`toEqual`). Anota en el `CERRADO` que dio idéntico.

### TS5 — Composición, cierre y docs

Código: `src/core/shell.js`, `src/render/legacy/index.js`, `src/main.js` →
`.ts`. `index.html` apunta a `/src/main.ts`.

- `shell.ts` según 8.6.
- `tsconfig`: `allowJs: false`, sin `checkJs`. `vite.config.ts`: `include`
  sólo `.test.ts`. `knip.json`: entry en `.ts`. ESLint: borra el bloque de
  transición.
- `git ls-files 'src/**/*.js' 'tests/**/*.js'` → vacío.
- Cuenta de fronteras: `grep -rn " as " src | grep -v "as const"`, y lista
  en el `CERRADO` cada `as` con su archivo (D8). Meta: menos de 10.

Docs (vivos; los `plans/` **no** se editan):
- `ARCHITECTURE.md` (sigue ≤200 líneas):
  - §1: "`model.ts` es TS puro…".
  - §7: "…unión de strings (`'off' | 'cranking' | …`), nunca varios booleanos
    ni `enum`".
  - §18: "…tipos en TypeScript (`core/types.ts`, `game/types.ts`, y los del
    módulo en su `model.ts`). Factories en vez de clases, salvo las escenas
    de Phaser en `src/render/phaser/`".
  - Leyes nuevas:
    - **§31** TypeScript estricto (`tsconfig.json` de la raíz). Sin `any`
      explícito, sin `@ts-ignore`/`@ts-nocheck`. `as` (salvo `as const`) sólo
      en fronteras y con un comentario que dice por qué es seguro. Lo que
      viene de afuera es `unknown` y se valida con un guard.
    - **§32** Toda tarea cierra con `npm run check` en verde (tipos, lint sin
      warnings, knip, tests y build).
    - **§33** Las leyes verificables se verifican con herramientas:
      `eslint.config.js` las cita por §, y `tests/tooling/lint-laws.test.ts`
      prueba que disparan. `eslint-disable` sólo con motivo. `tsconfig.json`,
      `eslint.config.js` y `knip.json` son core (§12).
  - Rationale: cambiar "Vanilla + Vite" por "TypeScript + Vite, sin
    framework" y agregar un párrafo corto: por qué TS (contratos
    verificados antes del solver), por qué TS 6 (D1) y por qué lint (D5).
  - README de docs dice "leyes §1-§18": actualizar a §1-§33.
- `CONTRATOS.md`: los bloques JSDoc pasan a tipos TS. **La fuente de verdad
  de las firmas es el código** (`core/types.ts`, `game/types.ts`); el doc
  explica y cita el archivo. Donde un bloque sólo repetía el tipo, se
  reemplaza por un puntero al archivo.
- `NORTE.md`: "JavaScript puro + Vite" → "TypeScript estricto + Vite".
- `AGENTS.md`: regla 7 → "Al cerrar una tarea, `npm run check` en verde y
  un bloque `CERRADO` …".
- `docs/modules/fuel.md` y los demás docs vivos: las rutas `*.js` de
  `src/` pasan a `*.ts` (`grep -rn "\.js" docs --include=*.md | grep -v
  plans/`).
- `AHORA.md`: "Cada una cierra con `npm test` + `npm run build`" → "`npm run
  check`". Bloque `CERRADO` con todo lo pedido en las fases. Se aclara que
  las tareas A3–A10 del plan del 2026-09-23 se implementan en `.ts` (las
  listas de archivos de ese plan dicen `.js`: léanse como `.ts`).

**Checklist en Firefox** (la hace el usuario; déjala en `AHORA.md`):
1. `npm run dev` → portada con "Etapas" y "Laboratorio", igual que antes.
2. Laboratorio del combustible: llave on → cebado de la bomba; arranque;
   sliders, fallas y presets funcionan; lecturas y sparklines se mueven;
   narración; clic en pieza → ficha; tema oscuro.
3. Etapas de quiz 1 y 2: preguntas, feedback, puntaje, estrellas, guardado
   (recargar la página conserva el progreso), candado de la etapa 2.
4. Consola del navegador sin errores.
5. Meter a mano un error de tipos en un `.ts` con `npm run dev` corriendo →
   aparece el overlay del checker. Sacarlo → desaparece.

## 10. Riesgos y qué hacer

| Riesgo | Señal | Qué hacer |
|---|---|---|
| `strictTypeChecked` marca cientos de cosas en el primer archivo | `lint` rojo | Se arregla archivo por archivo. **No** se baja una regla global para pasar; si una regla es ruido real, se discute y se anota en la config con el motivo |
| `no-unnecessary-condition` empuja a borrar chequeos defensivos | aviso en un guard | D9: ensanchar la entrada a `unknown`, no borrar el guard |
| El borrado `ModuleDescriptor<FuelModel>` → `ModuleDescriptor` no compila | error en `registry.ts` | Revisar que los callbacks usen sintaxis de método (8.1); como último recurso, un `as` en `defineModule` |
| `exactOptionalPropertyTypes` rompe spreads con `undefined` | `{ x: undefined }` no asignable | Omitir la clave, o declarar `x?: T \| undefined` sólo donde el `undefined` explícito es intencional |
| Cambio de física escondido en el port | la comparación de TS4 no da igual | Parar, hacer bisect en el diff de TS4, revertir el cambio de lógica |
| Versiones distintas a las verificadas | `npm i` con conflictos de peers | Respetar D1 (TS <6.1 para typescript-eslint); anotar la versión usada |
| El checker del overlay molesta o ralentiza el dev | dev lento | Se puede apagar su parte de ESLint (dejar sólo `typescript`) y anotarlo |

## 11. Fuera de alcance

- Renombrar ids de fallas a `<partId>.<falla>` (§26) → A3.
- Borrar `_demo`, partir `shell.ts` (447 líneas, §16) o cualquier refactor
  "ya que estamos".
- Prettier, Zod, husky (D7).
- TypeScript 7 (D1; ver sección 12).
- Phaser: sigue siendo la prueba A8. Lo único que este plan deja listo es la
  regla de lint que lo encierra en `src/render/phaser/`.

## 12. Migración futura a TypeScript 7 (tarea aparte, no parte de TS0–TS5)

**Cuándo hacerla** (lo que ocurra primero; revisar al empezar cada fase A):
1. `npm view typescript-eslint peerDependencies` acepta `typescript` 7 →
   **camino 1**.
2. oxlint cubre los huecos de 2.1 (algo equivalente a `no-restricted-syntax`
   y a `require-description`, y `no-unnecessary-condition` fuera de
   nursery) → se puede evaluar el **camino 2**.
3. TS 6 deja de recibir parches, o una dependencia (Vite, Vitest, Phaser)
   pide TS 7 → la que esté disponible de las dos.

**Camino 1 — seguir con ESLint** (~1 hora):
- Subir `typescript` a 7 y `typescript-eslint` a la versión que lo soporte.
- `tsconfig.json`: borrar lo que TS 7 ya no acepte (el plan no usa `baseUrl`,
  `moduleResolution: node10`, `target: es5` ni `outFile`, así que no
  debería haber nada).
- `vite-plugin-checker`: si su checker de `typescript` sigue dependiendo de
  la API JS (`ts.sys`), sacar ese checker y dejar el de ESLint, o usar
  `tsc --watch` en una terminal. Anotarlo en `AHORA.md`.
- `npm run check` en verde; arreglar lo que marquen las reglas nuevas.

**Camino 2 — cambiar a oxlint + oxlint-tsgolint** (tarea del tamaño de TS0):
- Reescribir `eslint.config.js` como `.oxlintrc.json`, usando `overrides` por
  carpeta para las tablas de 5.2–5.4. La mayoría de las reglas se llaman
  igual (`typescript/…`, `no-restricted-imports`, `-globals`, `-properties`).
- Reemplazos de lo que falta:
  - `new Date` en archivos puros → `no-restricted-globals: Date` (prohíbe
    `Date` entero ahí; `save.ts` sigue como excepción).
  - `enum` → ya lo bloquea `erasableSyntaxOnly` en el compilador.
  - `class` fuera de `render/phaser/` → probar `max-classes-per-file: 0` o
    un `jsPlugins` propio; si no funciona, queda para revisión y se anota.
  - Motivo obligatorio en `disable` → si no existe, queda para revisión a
    mano, y §33 se ajusta.
- Verificar que `no-restricted-imports` de oxlint acepte patrones `regex` y
  permita importar sólo tipos (`allowTypeImports`); si no, reescribir los
  patrones de 5.2.
- Verificar si oxlint respeta los comentarios `eslint-disable` que ya haya;
  si no, pasarlos a `oxlint-disable`.
- `tests/tooling/lint-laws.test.ts` pasa a llamar al CLI de oxlint sobre
  fixtures; **cada caso de TS0.6 tiene que seguir disparando**.
- `vite-plugin-checker`: usar su checker de `oxlint`; el de tipos, según el
  camino 1.
- `knip` no cambia (no depende de TypeScript: usa `oxc-parser`).
- Borrar de `package.json` `eslint`, `@eslint/js`, `typescript-eslint`,
  `@eslint-community/eslint-plugin-eslint-comments` y `globals` si ya no se
  usan (knip lo confirma).

**Lo que no cambia en ningún camino:** el código `.ts`, los tests (salvo el
de leyes en el camino 2) y las leyes. Si aparece un error de tipos que TS 6
no daba, se arregla el código en un commit aparte `fix(ts7): …`.
