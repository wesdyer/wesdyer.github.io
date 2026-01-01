
import asyncio
from playwright.async_api import async_playwright
import os

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        # Navigate to the game
        cwd = os.getcwd()
        url = f"file://{cwd}/regatta/index.html"
        await page.goto(url)

        # Wait for game to load
        await page.wait_for_timeout(1000)

        # Force Island Generation and Start Game
        await page.evaluate("""
            state.race.conditions.islandCount = 3;
            state.race.conditions.islandMaxSize = 0.8;
            state.race.conditions.islandClustering = 0.2;
            state.camera.target = 'manual';
            resetGame();

            // Hide Overlay to see islands
            if(UI.preRaceOverlay) UI.preRaceOverlay.classList.add('hidden');

            // Pan to first island
            setTimeout(() => {
                const isl = state.course.islands[0];
                if (isl) {
                    state.camera.x = isl.x;
                    state.camera.y = isl.y;
                }
            }, 500);
        """)

        await page.wait_for_timeout(2000)

        # Take Screenshot
        await page.screenshot(path="verification/island_final_1.png")

        # Another island if available
        await page.evaluate("""
            const isl = state.course.islands[1];
            if (isl) {
                state.camera.x = isl.x;
                state.camera.y = isl.y;
            }
        """)
        await page.wait_for_timeout(1000)
        await page.screenshot(path="verification/island_final_2.png")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
