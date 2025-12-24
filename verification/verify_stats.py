
import asyncio
from playwright.async_api import async_playwright
import math

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        # Load the page
        import os
        repo_root = os.getcwd()
        url = f"file://{repo_root}/regatta/index.html"
        await page.goto(url)

        # Start race immediately
        await page.evaluate("state.race.timer = 0.1; state.race.status = 'prestart';")
        # Wait for transition to racing
        await page.wait_for_timeout(100) # Prestart to Racing transition happens when timer <= 0

        # Force stats to racing (skip prestart countdown logic if needed, but easier to just fast forward timer)
        await page.evaluate("state.race.timer = 0; state.race.status = 'racing';")
        await page.evaluate("state.boats[0].raceState.leg = 1;") # Set to leg 1 to track stats

        # Set speed to exactly 10 knots (2.5 units/frame)
        # And heading 0 (North, assuming wind is 0)
        await page.evaluate("""
            const p = state.boats[0];
            p.speed = 2.5;
            p.heading = 0;
            state.wind.direction = Math.PI; // Wind from South (Tailwind)
        """)

        # Run for exactly 60 frames (approx 1 second)
        # We can step the loop manually or just wait
        # Better to step manually to control dt

        print("Stepping 60 frames with dt=0.01666...")
        await page.evaluate("""
            const dt = 1/60;
            for(let i=0; i<60; i++) {
                // Force speed to remain constant (disable physics decay)
                state.boats[0].speed = 2.5;
                state.boats[0].x += state.boats[0].speed * (Math.sin(state.boats[0].heading)) * (dt*60);
                state.boats[0].y -= state.boats[0].speed * (Math.cos(state.boats[0].heading)) * (dt*60);

                // Update stats manually if needed, or call updateBoatRaceState
                // But updateBoat calls updateBoatRaceState.
                // Let's call updateBoatRaceState directly to isolate stat tracking logic
                updateBoatRaceState(state.boats[0], dt);
            }
        """)

        # Check stats
        stats = await page.evaluate("state.boats[0].raceState.legDistances[1]")
        print(f"Recorded Distance (1s @ 10kts): {stats}")

        # Expected:
        # Visual distance: 2.5 units/frame * 60 frames = 150 units.
        # Meters (0.2 scale): 150 * 0.2 = 30 meters.
        # Current Logic (2.0576 factor): 2.5 * 2.0576 * (1/60) * 60 = 5.144 meters.

        print(f"Expected (Visual/Physical): 30.0")
        print(f"Expected (Old Logic): 5.144")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
