import asyncio
from playwright.async_api import async_playwright
import os

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={'width': 1000, 'height': 800})
        page = await context.new_page()

        cwd = os.getcwd()
        app_path = os.path.join(cwd, 'regatta/index.html')
        url = f'file://{app_path}'

        await page.goto(url)
        await page.wait_for_timeout(1000)

        # Init deterministic course
        await page.evaluate("""() => {
            state.wind.baseDirection = 0;
            state.wind.direction = 0;
            initCourse();
            state.paused = false;
        }""")
        await page.wait_for_timeout(100)

        # Test Case 1: Leg 1 (Upwind)
        await page.evaluate("""() => {
            state.race.leg = 1;
            state.race.status = 'racing';
            state.boat.x = 0;
            state.boat.y = -4000;
            state.camera.x = 0;
            state.camera.y = -4000;
            state.showNavAids = true;
        }""")
        await page.wait_for_timeout(500)
        await page.screenshot(path='verification/arrows_leg1_upwind_v2.png')
        print("Captured Leg 1 Upwind v2")

        # Test Case 2: Leg 2 (Downwind)
        await page.evaluate("""() => {
            state.race.leg = 2;
            state.race.status = 'racing';
            state.boat.x = 0;
            state.boat.y = 0;
            state.camera.x = 0;
            state.camera.y = 0;
        }""")
        await page.wait_for_timeout(500)
        await page.screenshot(path='verification/arrows_leg2_downwind_v2.png')
        print("Captured Leg 2 Downwind v2")

        # Test Case 3: Start
        await page.evaluate("""() => {
            state.race.leg = 0;
            state.race.status = 'prestart';
            state.boat.x = 0;
            state.boat.y = 0;
            state.camera.x = 0;
            state.camera.y = 0;
        }""")
        await page.wait_for_timeout(500)
        await page.screenshot(path='verification/arrows_leg0_start_v2.png')
        print("Captured Leg 0 Start v2")

        await browser.close()

if __name__ == '__main__':
    asyncio.run(run())
