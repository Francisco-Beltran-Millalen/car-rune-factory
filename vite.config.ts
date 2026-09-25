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
  },
}));
