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
        statements: 100,
        lines: 100,
        functions: 100,
        branches: 100,
      },
    },
  },
});
