// Simple Playwright screenshot helper for local preview
// Usage (from repo root):
//   1) pnpm --filter client build
//   2) pnpm --filter client preview --port 4173 &
//   3) node scripts/screenshot-howto.js
// This script assumes the client is served on http://127.0.0.1:4173

const { chromium } = require('playwright');

async function main() {
  const url = process.env.SR_SCREENSHOT_URL || 'http://127.0.0.1:4173/';
  const outPath = process.env.SR_SCREENSHOT_PATH || 'screenshot-howto.png';

  console.log('[screenshot-howto] Launching Chromium…');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  console.log('[screenshot-howto] Navigating to', url);
  await page.goto(url, { waitUntil: 'networkidle' });

  // Wait a bit for React + overlays to settle
  await page.waitForTimeout(3000);

  console.log('[screenshot-howto] Capturing screenshot →', outPath);
  await page.screenshot({ path: outPath, fullPage: true });

  await browser.close();
  console.log('[screenshot-howto] Done');
}

main().catch((err) => {
  console.error('[screenshot-howto] Error:', err);
  process.exit(1);
});
