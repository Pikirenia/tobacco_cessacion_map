const {defineConfig,devices}=require('@playwright/test');
module.exports=defineConfig({
 testDir:'./tests/mobile',timeout:60000,expect:{timeout:20000,toHaveScreenshot:{animations:'disabled',caret:'hide',maxDiffPixelRatio:.005}},
 fullyParallel:false,workers:process.env.CI?2:undefined,
 reporter:[['list'],['html',{outputFolder:'mobile-artifacts/html',open:'never'}]],
 outputDir:'mobile-artifacts/test-results',
 use:{baseURL:'http://127.0.0.1:8766/tobacco_cessacion_map/',locale:'en-US',timezoneId:'UTC',
 reducedMotion:'reduce',deviceScaleFactor:1,trace:'retain-on-failure',screenshot:'only-on-failure'},
 projects:[{name:'mobile-chromium',use:{...devices['Pixel 7'],deviceScaleFactor:1}},
 {name:'mobile-webkit',use:{...devices['iPhone 13'],deviceScaleFactor:1}}],
 webServer:{command:'python3 tests/serve.py',url:'http://127.0.0.1:8766/tobacco_cessacion_map/',
 reuseExistingServer:!process.env.CI,timeout:30000}
});