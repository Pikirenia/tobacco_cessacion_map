const {defineConfig, devices} = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tests/browser',
  timeout: 30000,
  fullyParallel: true,
  use: {baseURL: 'http://127.0.0.1:8766/tobacco_cessacion_map/', trace: 'retain-on-failure'},
  webServer: {command: 'python3 tests/serve.py', url: 'http://127.0.0.1:8766/tobacco_cessacion_map/', reuseExistingServer: !process.env.CI},
  projects: [
    {name: 'desktop', use: {...devices['Desktop Chrome']}},
    {name: 'mobile-chromium', use: {...devices['Pixel 7']}},
    {name: 'mobile-webkit', use: {...devices['iPhone 13']}}
  ]
});
