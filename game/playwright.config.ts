import { defineConfig } from '@playwright/test';

const port = Number(process.env.SELANTIS_E2E_PORT ?? 5187);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('SELANTIS_E2E_PORT must be an integer between 1 and 65535');
}
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.pw.ts',
  outputDir: process.env.SELANTIS_E2E_OUTPUT ?? `test-results/${port}`,
  workers: 2,
  use: { baseURL, trace: 'retain-on-failure' },
  webServer: {
    command: `npm run dev -- --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: false,
  },
});
