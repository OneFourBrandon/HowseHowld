import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    globals: true,
    css: true,
  },
})
