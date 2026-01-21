const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();
  
  // Go to projects list
  await page.goto('http://localhost:3000/projects', { waitUntil: 'networkidle', timeout: 30000 });
  await page.screenshot({ path: '/tmp/projects-list.png', fullPage: false });
  console.log('Projects list screenshot: /tmp/projects-list.png');
  
  // Click first project
  const projectLink = await page.$('a[href^="/projects/"]');
  if (projectLink) {
    await projectLink.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: '/tmp/project-page.png', fullPage: true });
    console.log('Project page screenshot: /tmp/project-page.png');
  } else {
    console.log('No projects found');
  }
  
  await browser.close();
})();
