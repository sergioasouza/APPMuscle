import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
  },
  resolve: {
    alias: {
      // Next.js path alias
      '@': resolve(__dirname, './src'),
      // server-only throws outside react-server bundler conditions.
      // In plain Node.js (Vitest) we stub it with an empty module.
      'server-only': resolve(__dirname, './src/__mocks__/server-only.ts'),
    },
  },
})
