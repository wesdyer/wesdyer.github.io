
import asyncio
from playwright.async_api import async_playwright
import os

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        # Get absolute path to index.html
        pwd = os.getcwd()
        file_path = f"file://{pwd}/regatta/index.html"

        print(f"Navigating to {file_path}")
        await page.goto(file_path)

        # Wait for game to initialize
        await page.wait_for_timeout(2000)

        # Force a strong gust
        await page.evaluate("""() => {
            const player = state.boats[0];
            const gust = createGust(player.x, player.y, 'gust');
            gust.radiusX = 1000; gust.radiusY = 1000;
            gust.speedDelta = 15;
            gust.dirDelta = 0;
            gust.duration = 1000;
            gust.age = 100;
            state.gusts.push(gust);
        }""")

        # Wait for HUD update
        await page.wait_for_timeout(500)

        # Take screenshot
        await page.screenshot(path="verification/hud_wind_verification.png")
        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
