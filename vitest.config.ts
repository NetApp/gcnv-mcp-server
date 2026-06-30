import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    restoreMocks: true,
    clearMocks: true,
    mockReset: true,
    coverage: {
      reporter: ['text', 'html', 'lcov', 'json-summary'],
      reportsDirectory: '.vitest-coverage',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/*.spec.ts', 'src/index.ts', 'src/types/**'],
      thresholds: {
        statements: 95,
        lines: 95,
        functions: 95,
        branches: 95,
      },
    },
  },
});
