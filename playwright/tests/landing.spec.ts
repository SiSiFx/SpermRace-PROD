import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test('landing loads on local preview and captures screenshot', async ({ page }, testInfo) => {
  // baseURL is configured in playwright.config.ts
  await page.goto('/', { waitUntil: 'networkidle' });

  // Basic smoke check that the app mounted
  await expect(page.locator('text=SPERM')).toBeVisible({ timeout: 15000 });

  const screenshotsDir = path.join(process.cwd(), 'playwright-screenshots');
  fs.mkdirSync(screenshotsDir, { recursive: true });

  const fileName = `${testInfo.project.name}-landing.png`;
  const screenshotPath = path.join(screenshotsDir, fileName);

  await page.screenshot({ path: screenshotPath, fullPage: true });

  // Log for debugging / inspection
  console.log(`Saved Playwright screenshot for ${testInfo.project.name} to ${screenshotPath}`);
});
