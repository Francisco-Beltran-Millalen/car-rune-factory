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
    // Las simulaciones largas (A13: calentamiento ×20; A15: el vehículo
    // fusionado) compiten por CPU entre archivos en paralelo; el default de
    // 5 s (y luego 30 s) hacía fallar tests ajenos que solos son rápidos.
    testTimeout: 60_000,
  },
}));
