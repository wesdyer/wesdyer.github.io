const { test, expect } = require('@playwright/test');
const path = require('path');

test('Verify Physics Display', async ({ page }) => {
    // 1. Navigate to the game
    const filePath = path.resolve(__dirname, '../regatta/index.html');
    await page.goto(`file://${filePath}`);

    // 2. Wait for initialization
    await page.waitForFunction(() => window.state && window.state.boats.length > 0);

    // 3. Inject debug commands to set state for screenshot
    await page.evaluate(() => {
        const boat = window.state.boats[0];

        // Setup "Irons" state visuals
        boat.heading = 0;
        window.state.wind.direction = 0;
        boat.sailAngle = 0;
        boat.luffIntensity = 1.0; // Force luffing visual
        boat.speed = 2.0; // Slow speed

        // Add a message to show we are testing physics
        window.showRaceMessage("TEST: HEAD TO WIND", "text-white", "border-white");
    });

    // 4. Take Screenshot of Game View
    await page.screenshot({ path: 'verification/physics_check.png' });
});
