import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test('landing + practice game load and capture screenshots with browser logs', async ({ page }, testInfo) => {
  const isMobileProject = testInfo.project.name.toLowerCase().includes('mobile');

  // Capture console + page errors from the browser context
  page.on('console', (msg) => {
    console.log(`[browser:${msg.type()}] ${msg.text()}`);
  });
  page.on('pageerror', (err) => {
    console.log(`[pageerror] ${err.message}\n${err.stack || ''}`);
  });

  // baseURL is configured in playwright.config.ts
  await page.goto('/', { waitUntil: 'networkidle' });

  // For mobile project, skip the full tutorial so we hit the actual game path like real users
  if (isMobileProject) {
    await page.evaluate(() => {
      try {
        localStorage.setItem('sr_practice_full_tuto_seen', '1');
        localStorage.setItem('sr_howto_seen_v2', '1');
      } catch {}
    });
    await page.reload({ waitUntil: 'networkidle' });
  }

  // Basic smoke check that the app mounted (use unique heading instead of loose text match)
  await expect(page.getByRole('heading', { name: /SPERM\s+RACE/i })).toBeVisible({ timeout: 15000 });

  const screenshotsDir = path.join(process.cwd(), 'playwright-screenshots');
  fs.mkdirSync(screenshotsDir, { recursive: true });

  // 1) Landing screenshot
  const landingFile = `${testInfo.project.name}-landing.png`;
  const landingPath = path.join(screenshotsDir, landingFile);
  await page.screenshot({ path: landingPath, fullPage: true });
  console.log(`Saved Playwright landing screenshot for ${testInfo.project.name} to ${landingPath}`);

  // 2) Try to enter free Practice/Race mode and capture what happens
  // Prefer the main CTA text, then fall back to generic Practice buttons
  const practiceLocators = [
    page.getByRole('button', { name: /Race for Free/i }),
    page.getByRole('button', { name: /Practice \(Free\)/i }),
    page.getByRole('button', { name: /^Practice$/i }),
  ];

  let clickedPractice = false;
  for (const loc of practiceLocators) {
    if (await loc.first().isVisible().catch(() => false)) {
      await loc.first().click();
      clickedPractice = true;
      console.log('[test] Clicked Practice / Race for Free button');
      break;
    }
  }

  if (!clickedPractice) {
    console.log('[test] No Practice / Race for Free button found on landing; skipping practice step');
    return;
  }

  // 3) Practice lobby (if present)
  try {
    await expect(page.getByText(/Practice Lobby/i)).toBeVisible({ timeout: 10000 });
    console.log('[test] Practice Lobby became visible');
  } catch {
    console.log('[test] Practice Lobby did NOT become visible within timeout (mobile may skip lobby or game may have black-screened early)');
  }

  const practiceLobbyFile = `${testInfo.project.name}-practice-lobby.png`;
  const practiceLobbyPath = path.join(screenshotsDir, practiceLobbyFile);
  await page.screenshot({ path: practiceLobbyPath, fullPage: true });
  console.log(`Saved Playwright practice-lobby screenshot for ${testInfo.project.name} to ${practiceLobbyPath}`);

  // 4) Wait for the actual game screen (NewGameView) to mount and capture state
  // PC: lobby auto-counts down into game. Mobile: tutorial is skipped via localStorage above.
  await page.waitForTimeout(9000); // allow countdown + Pixi init

  const hasCanvas = await page.evaluate(() => !!document.querySelector('canvas'));
  console.log(`[test] Game canvas present: ${hasCanvas}`);

  const practiceGameFile = `${testInfo.project.name}-practice-game.png`;
  const practiceGamePath = path.join(screenshotsDir, practiceGameFile);
  await page.screenshot({ path: practiceGamePath, fullPage: true });
  console.log(`Saved Playwright practice-game screenshot for ${testInfo.project.name} to ${practiceGamePath}`);
});
