import asyncio
from playwright.async_api import async_playwright
import os

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={'width': 1280, 'height': 720})
        page = await context.new_page()

        # Load the game
        filepath = os.path.abspath("regatta/index.html")
        await page.goto(f"file://{filepath}")

        # Wait for game to load
        await page.wait_for_timeout(1000)

        # Inject code to force finish race and show results with dummy data
        await page.evaluate("""() => {
            // Mock boats
            state.boats = [];
            for(let i=0; i<10; i++) {
                let b = new Boat(i, i===0, 0, 0, i===0?"Player":"AI-"+i);
                b.raceState.finished = true;
                b.raceState.finishTime = 300 + i*10;
                b.raceState.legDistances = [500, 1000, 1000, 1000, 1000];
                b.raceState.legTopSpeeds = [10, 12, 11, 13, 14];
                b.raceState.legManeuvers = [2, 5, 4, 6, 3];
                // Mock leg times
                b.raceState.startLegDuration = 30;
                b.raceState.legTimes = [60, 60, 60, 90];
                state.boats.push(b);
            }
            showResults();
        }""")

        # Wait for animation/render
        await page.wait_for_timeout(1000)

        # Screenshot
        await page.screenshot(path="verification/results_after.png", full_page=True)

        # Check dimensions
        dims = await page.evaluate("""() => {
            const el = document.getElementById('results-overlay');
            const list = document.getElementById('results-list');
            return {
                overlayScrollHeight: el.scrollHeight,
                overlayClientHeight: el.clientHeight,
                listHeight: list.clientHeight,
                windowHeight: window.innerHeight
            };
        }""")

        print(f"Dimensions: {dims}")
        print(f"Is scrollable? {dims['overlayScrollHeight'] > dims['overlayClientHeight']}")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
