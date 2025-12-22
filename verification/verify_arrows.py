import asyncio
from playwright.async_api import async_playwright, expect
import os

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={'width': 1000, 'height': 800})
        page = await context.new_page()

        # Determine absolute path to regatta/index.html
        cwd = os.getcwd()
        app_path = os.path.join(cwd, 'regatta/index.html')
        url = f'file://{app_path}'

        await page.goto(url)
        await page.wait_for_timeout(1000) # Wait for init

        # Test Case 1: Leg 1 (Upwind)
        # Force state to Leg 1
        await page.evaluate("""() => {
            state.race.leg = 1;
            state.race.status = 'racing';
            // Teleport boat near Windward Gate (Marks 2 & 3)
            // Marks are approx at (0, 3900) for standard North wind setup?
            // Actually wind is 0, so uy=-1. courseDist=4000.
            // Marks 2,3 are at y = -4000 (roughly).
            // Let's teleport boat to see them.
            // Mark 2 is left (-x), Mark 3 is right (+x).
            // Mark x = +/- rx * gateWidth/2. Gate width = 10 * 55 = 550.
            // x = +/- 275.
            state.boat.x = 0;
            state.boat.y = -3500;
            state.camera.x = 0;
            state.camera.y = -3500;
        }""")

        await page.wait_for_timeout(500)
        await page.screenshot(path='verification/arrows_leg1_upwind.png')
        print("Captured Leg 1 Upwind")

        # Test Case 2: Leg 2 (Downwind)
        # Force state to Leg 2
        await page.evaluate("""() => {
            state.race.leg = 2;
            state.race.status = 'racing';
            // Teleport boat near Leeward Gate (Marks 0 & 1)
            // Marks 0,1 are at (0,0) roughly.
            state.boat.x = 0;
            state.boat.y = -500;
            state.camera.x = 0;
            state.camera.y = 0;
        }""")

        await page.wait_for_timeout(500)
        await page.screenshot(path='verification/arrows_leg2_downwind.png')
        print("Captured Leg 2 Downwind")

        # Test Case 3: Leg 0 (Start)
        # Should NOT show arrows
        await page.evaluate("""() => {
            state.race.leg = 0;
            state.race.status = 'prestart';
            state.boat.x = 0;
            state.boat.y = -500;
            state.camera.x = 0;
            state.camera.y = 0;
        }""")

        await page.wait_for_timeout(500)
        await page.screenshot(path='verification/arrows_leg0_start.png')
        print("Captured Leg 0 Start")

        await browser.close()

if __name__ == '__main__':
    asyncio.run(run())
