import { defineConfig, devices } from '@playwright/test';
import path from 'path';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium-mobile',
      use: {
        ...devices['Pixel 5'],
        launchArgs: ['--no-sandbox'],
        executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
      },
    },
    {
      name: 'chromium-desktop',
      use: {
        ...devices['Desktop Chrome'],
        launchArgs: ['--no-sandbox'],
        executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
      },
    },
    {
      name: 'webkit-mobile',
      use: { ...devices['iPad Pro'] },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
