const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Login first
  await page.goto('http://localhost:3000');
  
  // wait for guest btn
  await page.waitForSelector('#guest-btn');
  await page.click('#guest-btn');
  
  await page.waitForSelector('.char-option[data-class="warrior"]');
  await page.click('.char-option[data-class="warrior"]');
  const uniqueName = 'Hero' + Date.now();
  await page.fill('#guest-name', uniqueName);
  await page.click('#start-guest-btn');
  
  await page.waitForSelector('#app-view', { state: 'visible' });
  
  const shopHtml = await page.innerHTML('.shop-item-list');
  console.log('--- SHOP HTML ---');
  console.log(shopHtml);
  console.log('-----------------');
  
  await browser.close();
})();
