// §33: cada ley verificable tiene que disparar. Este test lo prueba con rutas
// virtuales (los archivos no existen): si un regex del lint deja de matchear,
// acá se cae. Las reglas viven en eslint.config.js, citadas por §.
import { ESLint } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, expect, it } from 'vitest';

const eslint = new ESLint({
  overrideConfig: tseslint.configs.disableTypeChecked,
});

async function ruleIds(code: string, filePath: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath });
  return result?.messages.map((m) => m.ruleId ?? '') ?? [];
}

interface LawCase {
  name: string;
  file: string;
  code: string;
  rule: string;
  fires?: boolean;
}

const CASES: LawCase[] = [
  {
    name: '§1/§3 Math.random en un modelo',
    file: 'src/modules/x/model.ts',
    code: 'export const r = Math.random();',
    rule: 'no-restricted-properties',
  },
  {
    name: '§1/§3 new Date en un modo',
    file: 'src/game/modes/x.ts',
    code: 'export const t = new Date();',
    rule: 'no-restricted-syntax',
  },
  {
    name: '§27 new Date en save (frontera de E/S)',
    file: 'src/game/save.ts',
    code: 'export const t = new Date();',
    rule: 'no-restricted-syntax',
    fires: false,
  },
  {
    name: '§19 game no importa render',
    file: 'src/game/x.ts',
    code: "import { x } from '../../render/x.ts';",
    rule: 'no-restricted-imports',
  },
  {
    name: '§19 import type de render sí se permite',
    file: 'src/game/x.ts',
    code: "import type { R } from '../../render/x.ts';",
    rule: 'no-restricted-imports',
    fires: false,
  },
  {
    name: '§11 un módulo no importa a otro módulo',
    file: 'src/modules/fuel/model.ts',
    code: "import { m } from '../other/model.ts';",
    rule: 'no-restricted-imports',
  },
  {
    name: '§17 Phaser fuera de render/phaser',
    file: 'src/render/svg/x.ts',
    code: "import Phaser from 'phaser';\nexport const p = Phaser;",
    rule: 'no-restricted-imports',
  },
  {
    name: '§17 Phaser dentro de render/phaser',
    file: 'src/render/phaser/x.ts',
    code: "import Phaser from 'phaser';\nexport const p = Phaser;",
    rule: 'no-restricted-imports',
    fires: false,
  },
  {
    name: '§17 innerHTML prohibido',
    file: 'src/ui/x.ts',
    code: "declare const node: HTMLElement;\nnode.innerHTML = 'x';",
    rule: 'no-restricted-properties',
  },
  {
    name: '§18 clases sólo en render/phaser',
    file: 'src/core/x.ts',
    code: 'class X {}',
    rule: 'no-restricted-syntax',
  },
  {
    name: '§18 clase permitida en render/phaser',
    file: 'src/render/phaser/x.ts',
    code: 'class X {}',
    rule: 'no-restricted-syntax',
    fires: false,
  },
  {
    name: '§7 enums prohibidos',
    file: 'src/game/types.ts',
    code: 'enum E { A }',
    rule: 'no-restricted-syntax',
  },
];

describe('§33: las reglas de ley del lint disparan', () => {
  for (const c of CASES) {
    it(c.name, async () => {
      const rules = await ruleIds(c.code, c.file);
      if (c.fires === false) expect(rules).not.toContain(c.rule);
      else expect(rules).toContain(c.rule);
    });
  }
});
