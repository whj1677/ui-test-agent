import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir:'./tests',testMatch:'sorting.spec.ts',retries:0,workers:1,fullyParallel:false,
  timeout:120000,expect:{timeout:5000},
  outputDir:process.env.PILOT_RESULT_DIR || './private/unapproved-results',
  reporter:[['json',{outputFile:process.env.PILOT_JSON_REPORT || './private/unapproved-report.json'}],['html',{outputFolder:process.env.PILOT_HTML_REPORT || './private/unapproved-html',open:'never'}]],
  use:{browserName:'chromium',headless:true,locale:'zh-CN',viewport:{width:1440,height:1000},trace:'on',screenshot:'on',video:'on'},
});
