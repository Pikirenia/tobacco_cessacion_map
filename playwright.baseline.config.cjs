const {defineConfig, devices} = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tests/baseline',
  timeout: 45000,
  expect: {timeout: 15000, toHaveScreenshot: {animations: 'disabled', caret: 'hide', maxDiffPixelRatio: 0.002}},
  fullyParallel: false,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['list'], ['html', {outputFolder: 'baseline-artifacts/html', open: 'never'}]],
  outputDir: 'baseline-artifacts/test-results',
  use: {
    baseURL: 'http://127.0.0.1:8766/tobacco_cessacion_map/',
    browserName: 'chromium', locale: 'en-US', timezoneId: 'UTC',
    reducedMotion: 'reduce', deviceScaleFactor: 1,
    trace: 'retain-on-failure', screenshot: 'only-on-failure'
  },
  projects: [{name: 'baseline-chromium', use: {...devices['Desktop Chrome'], deviceScaleFactor: 1}}],
  webServer: {
    command: 'python3 tests/serve.py',
    url: 'http://127.0.0.1:8766/tobacco_cessacion_map/',
    reuseExistingServer: true, timeout: 30000
  }
});
