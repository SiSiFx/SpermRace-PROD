// SpermRace.io - Automated Screenshot Tool
// Takes screenshots of landing page and game to analyze visual quality

const { chromium, devices } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  console.log('🎮 Starting SpermRace.io Screenshot Tool...\n');

  // Create screenshots directory
  const screenshotDir = path.join(__dirname, 'screenshots');
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  // Launch browser
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  // Test on multiple devices
  const testDevices = [
    {
      name: 'Desktop',
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    },
    {
      name: 'iPhone-12',
      ...devices['iPhone 12']
    },
    {
      name: 'Galaxy-S21',
      ...devices['Galaxy S21']
    }
  ];

  for (const device of testDevices) {
    console.log(`\n📱 Testing on ${device.name}...`);

    const context = await browser.newContext({
      ...device,
      permissions: [],
    });

    const page = await context.newPage();

    try {
      // Go to production site
      console.log(`  → Loading https://spermrace.io`);
      await page.goto('https://spermrace.io', {
        waitUntil: 'networkidle',
        timeout: 30000
      });

      // Wait for content to load
      await page.waitForTimeout(2000);

      // Screenshot 1: Landing Page
      const landingPath = path.join(screenshotDir, `${device.name}-landing.png`);
      await page.screenshot({
        path: landingPath,
        fullPage: false
      });
      console.log(`  ✅ Landing page: ${landingPath}`);

      // Get page info
      const pageInfo = await page.evaluate(() => {
        return {
          title: document.title,
          viewport: {
            width: window.innerWidth,
            height: window.innerHeight,
            dpr: window.devicePixelRatio
          },
          buttons: Array.from(document.querySelectorAll('button')).map(b => b.textContent?.trim()).slice(0, 5),
          hasCanvas: !!document.querySelector('canvas'),
        };
      });

      console.log(`  📊 Info:`, JSON.stringify(pageInfo, null, 2));

      // Try to click "Practice Mode" if visible
      try {
        const practiceButton = await page.locator('button:has-text("Practice")').first();
        if (await practiceButton.isVisible({ timeout: 2000 })) {
          console.log(`  → Clicking Practice Mode...`);
          await practiceButton.click();
          await page.waitForTimeout(3000); // Wait for game to initialize

          // Screenshot 2: Game View
          const gamePath = path.join(screenshotDir, `${device.name}-game.png`);
          await page.screenshot({
            path: gamePath,
            fullPage: false
          });
          console.log(`  ✅ Game view: ${gamePath}`);

          // Get game canvas info
          const gameInfo = await page.evaluate(() => {
            const canvas = document.querySelector('canvas');
            if (!canvas) return null;

            return {
              canvasSize: {
                width: canvas.width,
                height: canvas.height,
                displayWidth: canvas.offsetWidth,
                displayHeight: canvas.offsetHeight
              },
              pixelRatio: window.devicePixelRatio,
              computedDPR: canvas.width / canvas.offsetWidth
            };
          });

          console.log(`  🎮 Canvas:`, JSON.stringify(gameInfo, null, 2));
        }
      } catch (e) {
        console.log(`  ⚠️  Could not access game (might need wallet): ${e.message}`);
      }

    } catch (error) {
      console.error(`  ❌ Error on ${device.name}:`, error.message);
    } finally {
      await context.close();
    }
  }

  await browser.close();

  console.log('\n✅ Screenshot capture complete!');
  console.log(`📂 Screenshots saved to: ${screenshotDir}`);
  console.log('\nScreenshots taken:');
  
  const files = fs.readdirSync(screenshotDir).filter(f => f.endsWith('.png'));
  files.forEach(file => {
    const stats = fs.statSync(path.join(screenshotDir, file));
    console.log(`  - ${file} (${(stats.size / 1024).toFixed(1)} KB)`);
  });

})().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
