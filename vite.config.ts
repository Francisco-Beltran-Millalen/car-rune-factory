import { defineConfig } from 'vitest/config';
import checker from 'vite-plugin-checker';

export default defineConfig(({ command }) => ({
  plugins:
    command === 'serve' && !process.env['VITEST']
      ? [
          checker({
            typescript: true,
            eslint: {
              lintCommand: 'eslint "./src/**/*.ts"',
              useFlatConfig: true,
            },
          }),
        ]
      : [],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    passWithNoTests: true,
    // Las simulaciones largas de A13 (calentamiento ×20) compiten entre
    // archivos en paralelo; el default de 5 s hacía fallar tests ajenos.
    testTimeout: 30_000,
  },
}));
