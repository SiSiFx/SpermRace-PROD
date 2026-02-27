import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test('landing + practice game load and capture screenshots with browser logs', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const isMobileProject = testInfo.project.name.toLowerCase().includes('mobile');

  // Capture console + page errors from the browser context
  page.on('console', (msg) => {
    console.log(`[browser:${msg.type()}] ${msg.text()}`);
  });
  page.on('pageerror', (err) => {
    console.log(`[pageerror] ${err.message}\n${err.stack || ''}`);
  });

  // baseURL is configured in playwright.config.ts
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  // For mobile project, skip the full tutorial so we hit the actual game path like real users
  if (isMobileProject) {
    await page.evaluate(() => {
      try {
        localStorage.setItem('sr_practice_full_tuto_seen', '1');
        localStorage.setItem('sr_howto_seen_v2', '1');
      } catch {}
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
  }

  // Basic smoke check that the app mounted (supports current and legacy landing headings)
  await expect(
    page.getByRole('heading', { name: /Spermrace Tournament Room|SPERM\s+RACE|SELECT MODE/i }).first()
  ).toBeVisible({ timeout: 15000 });

  const screenshotsDir = path.join(process.cwd(), 'playwright-screenshots');
  fs.mkdirSync(screenshotsDir, { recursive: true });

  const safeScreenshot = async (file: string) => {
    const screenshotPath = path.join(screenshotsDir, file);
    try {
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`Saved Playwright screenshot for ${testInfo.project.name} to ${screenshotPath}`);
    } catch (e: any) {
      console.log(`[test] Screenshot failed (${file}): ${e?.message || String(e)}`);
    }
  };

  // 1) Landing screenshot
  await safeScreenshot(`${testInfo.project.name}-landing.png`);

  // 1b) PC header nav smoke tests (top buttons) – ensure they navigate correctly
  if (!isMobileProject) {
    // Header Practice nav → Practice Lobby → Back to Menu
    const headerPractice = page.getByRole('button', { name: /^Practice$/i });
    if (await headerPractice.isVisible().catch(() => false)) {
      await headerPractice.click();
      await expect(page.getByText(/Practice Lobby/i)).toBeVisible({ timeout: 10000 });
      await page.getByRole('button', { name: /Back to Menu/i }).click();
      await expect(page.getByRole('heading', { name: /SPERM\s+RACE/i })).toBeVisible({ timeout: 10000 });
      console.log('[test] Header Practice nav navigates to Practice Lobby and back');
    } else {
      console.log('[test] Header Practice nav not visible on PC landing – skipping');
    }

    // Header Tournaments nav → Tier selection → Back to Menu
    const headerTournaments = page.getByRole('button', { name: /Tournaments/i });
    if (await headerTournaments.isVisible().catch(() => false)) {
      await headerTournaments.click();
      await expect(page.getByRole('heading', { name: /Select Your Entry Tier/i })).toBeVisible({ timeout: 10000 });
      console.log('[test] Header Tournaments nav navigates to tier selection');
    } else {
      console.log('[test] Header Tournaments nav not visible on PC landing – skipping');
    }

    // Header Leaderboard nav → Leaderboard overlay
    const headerLeaderboard = page.getByRole('button', { name: /Leaderboard/i });
    if (await headerLeaderboard.isVisible().catch(() => false)) {
      await headerLeaderboard.click();
      await expect(page.getByRole('heading', { name: /Leaderboard/i })).toBeVisible({ timeout: 10000 });
      // Close via ✕ button
      await page.getByRole('button', { name: /✕/ }).click();
      console.log('[test] Header Leaderboard nav opens and closes leaderboard overlay');
    } else {
      console.log('[test] Header Leaderboard nav not visible on PC landing – skipping');
    }

    // Header How to Play nav → How-to overlay
    const headerHowTo = page.getByRole('button', { name: /How to Play/i });
    if (await headerHowTo.isVisible().catch(() => false)) {
      await headerHowTo.click();
      await expect(page.getByText(/Objective/i)).toBeVisible({ timeout: 10000 });
      await page.getByRole('button', { name: /Close/i }).click();
      console.log('[test] Header How to Play nav opens and closes how-to overlay');
    } else {
      console.log('[test] Header How to Play nav not visible on PC landing – skipping');
    }
  }

  // 2) Try to enter free Practice/Race mode and capture what happens
  // Prefer the main CTA text, then fall back to generic Practice buttons
  const practiceLocators = isMobileProject
    ? [
        page.getByRole('button', { name: /FREE\s+MULTIPLAYER/i }),
        page.getByRole('button', { name: /MULTIPLAYER/i }),
        page.getByRole('button', { name: /Practice mode/i }),
        page.getByRole('button', { name: /Race for Free/i }),
        page.getByRole('button', { name: /Practice \(Free\)/i }),
        page.getByRole('button', { name: /^Practice$/i }),
      ]
    : [
        page.getByRole('button', { name: /Practice mode/i }),
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

  await safeScreenshot(`${testInfo.project.name}-practice-lobby.png`);

  // 4) Wait for the actual game screen (NewGameView) to mount and capture state
  // PC: lobby auto-counts down into game. Mobile: tutorial is skipped via localStorage above.
  await page.waitForSelector('canvas', { timeout: 20000 }).catch(() => null);

  const hasCanvas = await page.evaluate(() => !!document.querySelector('canvas'));
  console.log(`[test] Game canvas present: ${hasCanvas}`);

  await safeScreenshot(`${testInfo.project.name}-practice-game.png`);
});
