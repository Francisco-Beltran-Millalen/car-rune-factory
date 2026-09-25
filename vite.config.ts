import { defineConfig } from 'vitest/config';
import checker from 'vite-plugin-checker';

export default defineConfig(({ command }) => ({
  plugins:
    command === 'serve' && !process.env['VITEST']
      ? [
          checker({
            typescript: true,
            // Mientras quede JS (TS0–TS4) también se lintea; desde TS5 basta .ts.
            eslint: {
              lintCommand: 'eslint "./src/**/*.{js,ts}"',
              useFlatConfig: true,
            },
          }),
        ]
      : [],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.{js,ts}'],
    passWithNoTests: true,
  },
}));
