import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/browser',
  timeout: 30000,
  fullyParallel: true,
  use: { baseURL: 'http://127.0.0.1:4174/card_maker/', headless: true, launchOptions: {executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}, hasTouch: true, trace: 'retain-on-failure' },
  webServer: { command: 'npm run preview -- --host 127.0.0.1 --port 4174', url: 'http://127.0.0.1:4174/card_maker/', reuseExistingServer: !process.env.CI },
})
