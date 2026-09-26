// @ts-check
// Leyes de ARCHITECTURE.md verificadas por lint. Cada bloque cita su §.
// Cambiar este archivo es tarea de core (§12, §33).
import comments from '@eslint-community/eslint-plugin-eslint-comments/configs';
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const PURE =
  '§1/§3: el modelo es puro; el azar sale de core/rng.ts y el tiempo de step(dt)';

/** Patrón de import restringido (D8: sólo tipos permitidos entre capas). */
const pattern = (regex, message) => ({ regex, message, allowTypeImports: true });

// §17: Phaser vive sólo en src/render/phaser/ y se carga con import() dinámico.
const PHASER_BLOCKED = [
  pattern('^phaser$', '§17: Phaser sólo se importa desde src/render/phaser/'),
  pattern('(^|/)render/phaser/', '§17: Phaser se carga con import() dinámico'),
];

const DOM_CORE_BLOCKED = [
  pattern(
    '(^|/)(dom|svg|particles|shell|router)\\.(js|ts)$',
    '§1/§19: este archivo es puro (sin DOM); usa core/sim/game',
  ),
  pattern('(^|/)core/ui/', '§19: este archivo no puede importar la capa de UI'),
];

const PURE_BLOCKED = [
  ...PHASER_BLOCKED,
  ...DOM_CORE_BLOCKED,
  pattern(
    '(^|/)(game|modules|sim|presenter|render|ui)/',
    '§1/§19: una capa no importa a las de su derecha',
  ),
];

const MODULE_BLOCKED = [
  // Un módulo sí arma su física sobre `sim/**` (A5/A6: `fuel/circuit.ts` usa
  // `compileCircuit` y `ELEMENT_TYPES`) y su esquema sobre `core/types.ts`
  // (A7: `fuel/present.ts`); sigue sin ver game/presenter/render/ui.
  ...PHASER_BLOCKED,
  ...DOM_CORE_BLOCKED,
  pattern(
    '(^|/)(game|presenter|render|ui)/',
    '§1/§19: una capa no importa a las de su derecha',
  ),
  pattern('^\\.\\./(?!\\.\\.)', '§11: un módulo no importa a otro módulo'),
];

const GAME_BLOCKED = [
  ...PHASER_BLOCKED,
  ...DOM_CORE_BLOCKED,
  pattern(
    '(^|/)(render|ui|presenter|modules)/',
    '§19/§21: game es puro; no conoce render, ui, presenter ni módulos',
  ),
];

const PRESENTER_BLOCKED = [
  ...PHASER_BLOCKED,
  ...DOM_CORE_BLOCKED,
  pattern('(^|/)(render|ui)/', '§19: presenter es puro; no conoce render ni ui'),
];

const RENDER_LAYER = [
  pattern('(^|/)sim/', '§22: el renderer sólo lee VisualState (presenter)'),
  pattern(
    '(^|/)modules/[^/]+/model\\.(js|ts)$',
    '§22: el renderer no lee model.state, model.params ni model.faults',
  ),
  pattern(
    '(^|/)game/(?!intents\\.(js|ts)$)(?!types\\.(js|ts)$)',
    '§20/§22: del juego sólo se importan intents y tipos',
  ),
];

const UI_BLOCKED = [
  ...PHASER_BLOCKED,
  pattern('(^|/)sim/', '§19: ui no importa sim'),
  pattern('(^|/)modules/[^/]+/model\\.(js|ts)$', '§19: ui no importa modelos'),
  pattern('(^|/)(render|presenter)/', '§19: ui no importa render ni presenter'),
];

const VIEW_BLOCKED = [
  ...PHASER_BLOCKED,
  pattern(
    '(^|/)(game|render|ui)/',
    '§11: la vista de un módulo no importa juego, render ni ui',
  ),
  pattern('^\\.\\./(?!\\.\\.)', '§11: un módulo no importa a otro módulo'),
];

const PROP_PURE = [
  { object: 'Math', property: 'random', message: PURE },
  { object: 'Date', property: 'now', message: PURE },
  { object: 'performance', property: 'now', message: PURE },
  { object: 'globalThis', property: 'localStorage', message: PURE },
  { object: 'globalThis', property: 'document', message: PURE },
  { object: 'globalThis', property: 'window', message: PURE },
];

const PROP_HTML = [
  {
    property: 'innerHTML',
    message: '§17: usa los helpers de core/dom.ts y core/svg.ts',
  },
  {
    property: 'outerHTML',
    message: '§17: usa los helpers de core/dom.ts y core/svg.ts',
  },
  {
    property: 'insertAdjacentHTML',
    message: '§17: usa los helpers de core/dom.ts y core/svg.ts',
  },
];

const GLOBAL_PURE = [
  'document',
  'window',
  'navigator',
  'location',
  'localStorage',
  'sessionStorage',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'performance',
  'setTimeout',
  'setInterval',
  'fetch',
  'process',
  'Buffer',
  'require',
  '__dirname',
];

const GLOBALS_NODE_ONLY = ['process', 'Buffer', 'require', '__dirname'];

const restrictGlobals = (names) =>
  ['error', ...names.map((name) => ({ name, message: PURE }))];

const DATE_SYNTAX = {
  selector: "NewExpression[callee.name='Date']",
  message: PURE,
};

const CLASS_ENUM_SYNTAX = [
  {
    selector: 'ClassDeclaration',
    message: '§18: factories (createX()) en vez de clases',
  },
  {
    selector: 'ClassExpression',
    message: '§18: factories (createX()) en vez de clases',
  },
  {
    selector: 'TSEnumDeclaration',
    message: '§7: uniones de strings en vez de enum',
  },
];

// Archivos puros (§1, §3, §21). Crecerá con faults/diagnosis/circuit/controllers.
const PURE_FILES = [
  'src/core/{math,rng,loop,history,format,types}.{js,ts}',
  'src/sim/**',
  'src/game/**',
  'src/presenter/**',
  'src/modules/*/{model,content,specs,narrate,faults,diagnosis,circuit,controllers,reference-model,present,constants,gas,timing,mechanism}.{js,ts}',
];

// Excepciones de 5.3, en la config y no inline: save es la frontera de E/S (§27)
// y loop/session usan rAF sólo como default del parámetro inyectable `raf` (D9).
const PURE_EXCEPTIONS = [
  'src/game/save.{js,ts}',
  'src/core/loop.{js,ts}',
  'src/game/session.{js,ts}',
];

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**'] },
  {
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
      reportUnusedInlineConfigs: 'error',
    },
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  comments.recommended,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: { ...globals.browser },
    },
  },

  // 5.1 Reglas generales (§7, §20; D8)
  {
    rules: {
      '@typescript-eslint/switch-exhaustiveness-check': [
        'error',
        {
          considerDefaultExhaustiveForUnions: false,
          requireDefaultForNonUnion: true,
        },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/consistent-type-assertions': [
        'error',
        { assertionStyle: 'as', objectLiteralTypeAssertions: 'never' },
      ],
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-expect-error': 'allow-with-description',
          minimumDescriptionLength: 10,
        },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        { allowNumber: true },
      ],
      '@eslint-community/eslint-comments/require-description': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },
  {
    files: ['src/**/*.ts'],
    rules: { '@typescript-eslint/explicit-module-boundary-types': 'error' },
  },
  // Stubs del contrato (emit = () => {}, highlight() {}, sync() {}, resize() {}):
  // son no-ops deliberados que el patrón factory declara vacíos.
  {
    files: [
      'src/core/loop.{js,ts}',
      'src/game/session.{js,ts}',
      'src/core/ui/*.{js,ts}',
      'src/modules/*/view.{js,ts}',
      'src/render/svg/**',
      'tests/**',
    ],
    rules: { '@typescript-eslint/no-empty-function': 'off' },
  },
  // Los params/faults/state de un módulo van con `type`, no `interface`:
  // un alias de objeto sí es asignable a Record<string, …> (plan §8.1).
  // `reference-model` es el nombre de A6 para el modelo de referencia;
  // `mechanism` es el de A11 para el mecanismo de 4 tiempos.
  {
    files: ['src/modules/*/{model,reference-model,mechanism}.{js,ts}'],
    rules: { '@typescript-eslint/consistent-type-definitions': 'off' },
  },

  // 5.4 DOM seguro, factories y enums (§17, §18, §7)
  {
    files: ['src/**'],
    rules: { 'no-restricted-properties': ['error', ...PROP_HTML] },
  },
  {
    files: ['src/**'],
    ignores: ['src/render/phaser/**'],
    rules: { 'no-restricted-syntax': ['error', ...CLASS_ENUM_SYNTAX] },
  },

  // 5.3 Pureza y determinismo (§1, §3, §21)
  // process/Buffer/require/__dirname prohibidos en todo src/**.
  {
    files: ['src/**'],
    rules: { 'no-restricted-globals': restrictGlobals(GLOBALS_NODE_ONLY) },
  },
  {
    files: PURE_FILES,
    ignores: PURE_EXCEPTIONS,
    rules: {
      'no-restricted-globals': restrictGlobals(GLOBAL_PURE),
      'no-restricted-properties': ['error', ...PROP_PURE, ...PROP_HTML],
      'no-restricted-syntax': ['error', DATE_SYNTAX, ...CLASS_ENUM_SYNTAX],
    },
  },
  {
    files: ['src/game/save.{js,ts}'],
    rules: {
      'no-restricted-globals': restrictGlobals(GLOBAL_PURE),
      'no-restricted-properties': [
        'error',
        ...PROP_PURE.filter((p) => p.property !== 'localStorage'),
        ...PROP_HTML,
      ],
      'no-restricted-syntax': ['error', ...CLASS_ENUM_SYNTAX],
    },
  },
  {
    files: ['src/core/loop.{js,ts}', 'src/game/session.{js,ts}'],
    rules: {
      'no-restricted-globals': restrictGlobals(
        GLOBAL_PURE.filter(
          (name) =>
            name !== 'requestAnimationFrame' && name !== 'cancelAnimationFrame',
        ),
      ),
      'no-restricted-properties': ['error', ...PROP_PURE, ...PROP_HTML],
      'no-restricted-syntax': ['error', DATE_SYNTAX, ...CLASS_ENUM_SYNTAX],
    },
  },

  // 5.2 Capas e imports (§11, §17, §19, §20, §22)
  {
    files: ['**/*.{js,ts}'],
    ignores: ['src/render/phaser/**'],
    rules: {
      'no-restricted-imports': ['error', { patterns: PHASER_BLOCKED }],
    },
  },
  {
    files: ['src/core/{math,rng,loop,history,format,types}.{js,ts}'],
    rules: {
      'no-restricted-imports': ['error', { patterns: PURE_BLOCKED }],
    },
  },
  {
    files: ['src/sim/**'],
    rules: {
      'no-restricted-imports': ['error', { patterns: PURE_BLOCKED }],
    },
  },
  {
    files: [
      'src/modules/*/{model,content,specs,narrate,faults,diagnosis,circuit,controllers,reference-model,present,constants,gas,timing,mechanism}.{js,ts}',
    ],
    rules: {
      'no-restricted-imports': ['error', { patterns: MODULE_BLOCKED }],
    },
  },
  {
    files: ['src/modules/*/view.{js,ts}'],
    rules: {
      'no-restricted-imports': ['error', { patterns: VIEW_BLOCKED }],
    },
  },
  {
    files: ['src/game/**'],
    rules: {
      'no-restricted-imports': ['error', { patterns: GAME_BLOCKED }],
    },
  },
  {
    files: ['src/presenter/**'],
    rules: {
      'no-restricted-imports': ['error', { patterns: PRESENTER_BLOCKED }],
    },
  },
  {
    files: ['src/render/**'],
    ignores: ['src/render/phaser/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [...PHASER_BLOCKED, ...RENDER_LAYER] },
      ],
    },
  },
  {
    files: ['src/render/phaser/**'],
    rules: {
      'no-restricted-imports': ['error', { patterns: RENDER_LAYER }],
    },
  },
  {
    files: ['src/ui/**', 'src/core/ui/**'],
    rules: {
      'no-restricted-imports': ['error', { patterns: UI_BLOCKED }],
    },
  },

  // 5.5 Tests (§33)
  {
    files: ['tests/**/*.{js,ts}'],
    languageOptions: { globals: { ...globals.node } },
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      // Los matchers de vitest referencian métodos de dobles (vi.fn).
      '@typescript-eslint/unbound-method': 'off',
    },
  },

  // 5.6 Sólo queda JS en la config de ESLint; el código es todo .ts.
  {
    files: ['eslint.config.js'],
    ...tseslint.configs.disableTypeChecked,
  },
);
