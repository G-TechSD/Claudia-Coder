const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    args: ['--ignore-certificate-errors']
  });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    ignoreHTTPSErrors: true
  });
  const page = await context.newPage();
  
  try {
    const baseUrl = 'https://localhost:3000';
    console.log('Navigating to', baseUrl + '/projects');
    
    await page.goto(baseUrl + '/projects', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(3000);
    
    const url = page.url();
    console.log('Current URL:', url);
    
    // Take screenshot of projects list
    await page.screenshot({ path: '/tmp/projects-list.png', fullPage: false });
    console.log('Projects list screenshot saved: /tmp/projects-list.png');
    
    // Get all links and find actual projects (with UUIDs or IDs, not /new or utility pages)
    const allHrefs = await page.$$eval('a[href*="/projects/"]', els => 
      els.map(el => el.getAttribute('href')).filter(h => h)
    );
    console.log('All project hrefs:', allHrefs);
    
    // Find a project with a UUID-like ID (not /new, /starred, etc.)
    const projectRegex = /\/projects\/([a-f0-9-]{8,}|[a-zA-Z0-9_-]{20,})/;
    const realProject = allHrefs.find(href => projectRegex.test(href) && !href.includes('/new'));
    
    if (realProject) {
      console.log('Found real project:', realProject);
      await page.goto(baseUrl + realProject, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(3000);
      
      // Take screenshot of project detail page with sidebar
      await page.screenshot({ path: '/tmp/project-page.png', fullPage: true });
      console.log('Project page screenshot saved: /tmp/project-page.png');
      console.log('Final URL:', page.url());
      
      // Also take a viewport-only screenshot to show sidebar clearly
      await page.screenshot({ path: '/tmp/project-sidebar.png', fullPage: false });
      console.log('Project sidebar screenshot saved: /tmp/project-sidebar.png');
    } else {
      // Try clicking on a project card directly
      const projectCard = await page.$('.project-card, [class*="project-item"], table tbody tr');
      if (projectCard) {
        console.log('Clicking on project card/row...');
        await projectCard.click();
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(3000);
        await page.screenshot({ path: '/tmp/project-page.png', fullPage: true });
        console.log('Project page screenshot saved: /tmp/project-page.png');
        console.log('Final URL:', page.url());
      } else {
        console.log('No real projects found. Page might be empty or need auth.');
        // Take screenshot anyway
        await page.screenshot({ path: '/tmp/project-page-empty.png', fullPage: true });
      }
    }
  } catch (error) {
    console.error('Error:', error.message);
    try {
      await page.screenshot({ path: '/tmp/error-screenshot.png', fullPage: true });
      console.log('Error screenshot saved to /tmp/error-screenshot.png');
    } catch (e) {
      console.error('Could not save error screenshot');
    }
  }
  
  await browser.close();
})();
