
import asyncio
import os
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()

        # Load the game
        print("Loading game...")
        await page.goto(f"file://{os.path.abspath('regatta/index.html')}")

        # Wait for game to initialize
        await page.wait_for_selector("#start-race-btn")
        print("Game loaded. Clicking Start...")

        # Click Start
        await page.click("#start-race-btn")

        # Wait a bit
        await asyncio.sleep(2)
        print("Race started.")

        # Monitor for 30 seconds (Start sequence)
        print("Monitoring start sequence...")

        # We can check state via evaluate
        for i in range(10):
            await asyncio.sleep(3)
            state = await page.evaluate("() => { return { timer: window.state.race.timer, status: window.state.race.status, boats: window.state.boats.map(b => ({x: b.x, y: b.y, speed: b.speed})) } }")
            print(f"Time: {state['timer']:.1f}, Status: {state['status']}")

            # Check for clump (boats very close to each other)
            boats = state['boats']
            clump_count = 0
            stuck_count = 0
            for j, b1 in enumerate(boats):
                if b1['speed'] < 0.1: stuck_count += 1
                for k in range(j+1, len(boats)):
                    b2 = boats[k]
                    dist = ((b1['x']-b2['x'])**2 + (b1['y']-b2['y'])**2)**0.5
                    if dist < 40: # Touching
                        clump_count += 1

            print(f"  Stuck Boats (<0.4kn): {stuck_count}")
            print(f"  Clump Pairs (<40u): {clump_count}")

            # Screenshot
            await page.screenshot(path=f"verification/frame_{i}.png")

        print("Verification complete.")
        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
