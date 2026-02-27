import { expect, test } from '@playwright/test';

test('practice multiplayer: 2 players start, winner shown', async ({ browser, baseURL }, testInfo) => {
  const ctx1 = await browser.newContext();
  const ctx2 = await browser.newContext();

  await ctx1.addInitScript((name) => {
    localStorage.setItem('sr_guest_name', name);
    localStorage.setItem('sr_debug_ws', '1');
    localStorage.setItem('sr_practice_full_tuto_seen', '1');
    localStorage.setItem('sr_howto_seen_v2', '1');
  }, 'PW_ONE');

  await ctx2.addInitScript((name) => {
    localStorage.setItem('sr_guest_name', name);
    localStorage.setItem('sr_debug_ws', '1');
    localStorage.setItem('sr_practice_full_tuto_seen', '1');
    localStorage.setItem('sr_howto_seen_v2', '1');
  }, 'PW_TWO');

  const p1 = await ctx1.newPage();
  const p2 = await ctx2.newPage();

  await p1.goto('/?practice=1', { waitUntil: 'domcontentloaded' });
  await p2.goto('/?practice=1', { waitUntil: 'domcontentloaded' });

  await p1.getByRole('button', { name: /multiplayer/i }).click();
  await p1.locator('#lobby-screen').waitFor({ state: 'visible', timeout: 30_000 });
  await expect(p1.locator('#lobby-screen')).toContainText(/need 1 more player/i, { timeout: 30_000 });

  await p2.getByRole('button', { name: /multiplayer/i }).click();
  await p2.locator('#lobby-screen').waitFor({ state: 'visible', timeout: 30_000 });

  // Countdown should start once both players are in.
  await expect(p1.getByText('STARTING IN')).toBeVisible({ timeout: 45_000 });
  await expect(p2.getByText('STARTING IN')).toBeVisible({ timeout: 45_000 });

  // Game should mount (Pixi overview canvas + debug overlay).
  await p1.locator('#game-overview-canvas').waitFor({ state: 'attached', timeout: 60_000 });
  await p2.locator('#game-overview-canvas').waitFor({ state: 'attached', timeout: 60_000 });

  await expect(p1.locator('#sr-ws-debug')).toBeVisible({ timeout: 60_000 });
  await expect(p2.locator('#sr-ws-debug')).toBeVisible({ timeout: 60_000 });

  const waitForTwoPlayers = async (page: any) => {
    await page.waitForFunction(() => {
      const el = document.getElementById('sr-ws-debug');
      if (!el) return false;
      const m = el.textContent?.match(/serverPlayers=(\\d+)/);
      return !!m && Number(m[1]) >= 2;
    }, { timeout: 30_000 });
  };

  await waitForTwoPlayers(p1);
  await waitForTwoPlayers(p2);

  await p1.screenshot({ path: testInfo.outputPath('p1-in-game.png') });
  await p2.screenshot({ path: testInfo.outputPath('p2-in-game.png') });

  // Force a round end deterministically: disconnect player 2 and verify player 1 sees results + winner.
  await ctx2.close();

  await p1.locator('#round-end').waitFor({ state: 'visible', timeout: 60_000 });
  await expect(p1.locator('#round-end')).not.toContainText('Winner: —', { timeout: 30_000 });
  await p1.screenshot({ path: testInfo.outputPath('p1-results.png') });

  await ctx1.close();
});

