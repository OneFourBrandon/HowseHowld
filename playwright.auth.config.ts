import { defineConfig, devices } from '@playwright/test'
process.env.VITE_DEMO_MODE = 'false'
process.env.VITE_SUPABASE_URL = 'http://127.0.0.1:54399'
process.env.VITE_SUPABASE_PUBLISHABLE_KEY = 'test-public-key'
export default defineConfig({
  testDir: './tests/auth',
  webServer: { command: 'pnpm dev --host 127.0.0.1 --port 5176', url: 'http://127.0.0.1:5176', reuseExistingServer: false },
  use: { baseURL: 'http://127.0.0.1:5176', trace: 'retain-on-failure' },
  projects: [{ name: 'auth-chromium', use: { ...devices['Desktop Chrome'] } }],
})
