const {defineConfig}=require('@playwright/test');

module.exports=defineConfig({
  testDir:'./tests/visual',
  timeout:30000,
  expect:{timeout:5000},
  fullyParallel:false,
  workers:1,
  retries:process.env.CI?'1':0,
  reporter:[['line'],['html',{outputFolder:'playwright-report',open:'never'}]],
  outputDir:'visual-audit-artifacts',
  use:{
    baseURL:'http://127.0.0.1:4173/',
    headless:true,
    locale:'ru-RU',
    timezoneId:'Europe/Warsaw',
    colorScheme:'light',
    reducedMotion:'reduce',
    trace:'retain-on-failure',
    video:'retain-on-failure',
    screenshot:'only-on-failure'
  },
  webServer:{
    command:'npm run preview -- --host 127.0.0.1 --port 4173',
    url:'http://127.0.0.1:4173/',
    reuseExistingServer:false,
    timeout:120000
  }
});
