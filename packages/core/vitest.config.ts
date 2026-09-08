import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      thresholds: {
        lines: 90,
        branches: 80,
        functions: 85,
        statements: 90
      }
    }
  }
})
