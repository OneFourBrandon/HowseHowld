import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/pwa',
  webServer: {
    command: 'pnpm preview --host 127.0.0.1 --port 5178',
    url: 'http://127.0.0.1:5178',
    reuseExistingServer: false,
  },
  use: { baseURL: 'http://127.0.0.1:5178', browserName: 'chromium' },
})
