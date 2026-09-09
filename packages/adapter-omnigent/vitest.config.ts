import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    alias: {
      '@nexus/core': fileURLToPath(new URL('../core/src/index.ts', import.meta.url))
    }
  },
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      thresholds: { lines: 90, branches: 80 }
    }
  }
})
