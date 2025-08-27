import { defineConfig, devices } from '@playwright/test';

const isCI = !!process.env.CI;

const projects = [
  { name: 'Desktop Chromium', use: { ...devices['Desktop Chrome'] } },
  { name: 'Mobile Chrome', use: { ...devices['Pixel 7'] } },
];

if (isCI) {
  projects.push(
    { name: 'Desktop Firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'Desktop Safari', use: { ...devices['Desktop Safari'] } },
  );
}

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  reporter: isCI
    ? [
        ['github'],
        ['html', { open: 'never', outputFolder: 'playwright-report' }],
      ]
    : [['list'], ['html', { open: 'on-failure' }]],
  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 20_000,
  },
  webServer: [
    {
      command: isCI ? 'npm run start:ci' : 'npm run dev',
      url: 'http://localhost:3000',
      reuseExistingServer: !isCI,
      timeout: 180_000,
      env: {
        NEXT_TELEMETRY_DISABLED: '1',
        NEXT_PUBLIC_E2E_MOCK: '1',
        NEXT_PUBLIC_SUPABASE_URL: 'http://localhost',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
        SUPABASE_SERVICE_ROLE_KEY: 'service',
      },
    },
  ],
  projects,
});
