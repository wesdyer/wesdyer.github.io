
import asyncio
from playwright.async_api import async_playwright
import os

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        # Load the page
        repo_root = os.getcwd()
        url = f"file://{repo_root}/regatta/index.html"
        await page.goto(url)

        # Pause game to prevent raf interference
        await page.evaluate("state.paused = true; lastTime = 0;")

        # Reset and Setup
        await page.evaluate("""
            state.race.timer = 0;
            state.race.status = 'racing';
            const p = state.boats[0];
            p.raceState.leg = 1;
            p.raceState.legDistances = [0,0,0,0,0];
            p.raceState.legSpeedSums = [0,0,0,0,0];
            p.raceState.legTopSpeeds = [0,0,0,0,0];
            p.raceState.legManeuvers = [0,0,0,0,0];
            p.lastWindSide = 1;
            p.heading = 0;
            p.speed = 2.5; // 10 knots
        """)

        # Run manual loop
        await page.evaluate("""
            const dt = 1/60;
            const p = state.boats[0];

            for(let i=0; i<60; i++) {
                // Mock Physics movement (y is inverted)
                p.x += p.speed * Math.sin(p.heading) * (dt*60);
                p.y -= p.speed * Math.cos(p.heading) * (dt*60);

                // Stats
                updateBoatRaceState(p, dt);

                // Timer
                state.race.timer += dt;
            }
        """)

        # Trigger results overlay
        await page.evaluate("UI.resultsOverlay.classList.remove(\"hidden\"); showResults();")

        # Screenshot results
        await page.screenshot(path="verification/results_stats_fixed.png")
        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
