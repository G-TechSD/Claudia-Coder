import { chromium } from 'playwright';

async function test() {
  console.log('Starting simple test...');
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--ignore-certificate-errors']
  });
  const context = await browser.newContext({ 
    ignoreHTTPSErrors: true,
    bypassCSP: true
  });
  const page = await context.newPage();
  
  // Set a page error handler
  page.on('pageerror', error => console.log('Page error:', error.message));
  page.on('console', msg => console.log('Browser:', msg.text()));
  
  try {
    console.log('Navigating to https://localhost:3000/...');
    const response = await page.goto('https://localhost:3000/', { 
      timeout: 30000,
      waitUntil: 'commit' // Just wait for response, not full load
    });
    console.log('Initial response:', response?.status());
    
    // Wait a bit for any client-side stuff
    await page.waitForTimeout(3000);
    
    await page.screenshot({ path: '/tmp/easy-mode-test-v2/test-homepage.png', fullPage: true });
    console.log('Homepage screenshot saved');
    console.log('Page URL:', page.url());
    
    // Now navigate to easy-mode
    console.log('\nNavigating to easy-mode...');
    await page.goto('https://localhost:3000/easy-mode', { 
      timeout: 30000,
      waitUntil: 'commit'
    });
    await page.waitForTimeout(3000);
    
    await page.screenshot({ path: '/tmp/easy-mode-test-v2/test-easy-mode.png', fullPage: true });
    console.log('Easy Mode screenshot saved');
    console.log('Page URL:', page.url());
    
  } catch (error: any) {
    console.log('Error:', error.message);
  } finally {
    await browser.close();
  }
}

test();
