import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@nexus/core': fileURLToPath(new URL('../core/src/index.ts', import.meta.url)),
      '@nexus/contracts': fileURLToPath(new URL('../contracts/src/index.ts', import.meta.url))
    }
  },
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
