
import asyncio
from playwright.async_api import async_playwright
import os

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        filepath = os.path.abspath("regatta/index.html")
        url = f"file://{filepath}"

        await page.goto(url)
        await page.wait_for_timeout(1000)

        # Click Start Race
        await page.click('#start-race-btn')

        # Wait for game loop to run a bit
        await page.wait_for_timeout(2000)

        # Force camera to zoom out or move to an island?
        # Let's just try to find an island in state and move camera there via evaluate

        island_pos = await page.evaluate("""() => {
            if (state.course.islands && state.course.islands.length > 0) {
                return {x: state.course.islands[0].x, y: state.course.islands[0].y};
            }
            return null;
        }""")

        if island_pos:
            print(f"Moving camera to island at {island_pos}")
            # Override camera position to look at the island
            await page.evaluate(f"state.camera.x = {island_pos['x']}; state.camera.y = {island_pos['y']}; state.camera.target = 'fixed';")
            await page.wait_for_timeout(500)

            await page.screenshot(path="verification/island_gameplay.png")
            print("Screenshot saved to verification/island_gameplay.png")
        else:
            print("No islands found to focus on.")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
