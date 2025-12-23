import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        # Go to the regatta game
        await page.goto("http://localhost:8000/regatta/index.html")

        # Wait for game to initialize (state object to be available)
        await page.wait_for_function("window.state !== undefined")

        # Get the first mark position
        mark0 = await page.evaluate("window.state.course.marks[0]")
        print(f"Mark 0 position: {mark0}")

        # Teleport boat to Mark 0 collision distance (Mark radius 15 + Boat radius 25 = 40).
        # Let's put it closer, e.g., 20 units away.
        # Mark 0 is at (-rx*w/2, -ry*w/2).

        # Teleport boat
        await page.evaluate(f"""
            const m = window.state.course.marks[0];
            const p = window.state.boats[0];
            p.x = m.x + 20;
            p.y = m.y;
            p.raceState.penalty = false;
        """)

        # We need to ensure 'racing' status or whatever status checkMarkCollisions respects.
        # checkMarkCollisions doesn't seem to check race status for penalty logic in the current code,
        # but triggerPenalty might need checks.

        # Currently the code in checkMarkCollisions is:
        # boat.speed *= 0.5;
        # It does NOT call triggerPenalty(boat).

        # Let's wait a bit for the game loop to run
        await asyncio.sleep(1)

        # Check if penalty is active
        penalty = await page.evaluate("window.state.boats[0].raceState.penalty")
        print(f"Penalty active: {penalty}")

        await browser.close()

        if penalty:
            print("TEST FAILED: Penalty was triggered (unexpectedly, or already fixed?)")
        else:
            print("TEST PASSED: Penalty was NOT triggered (reproduced issue)")

if __name__ == "__main__":
    asyncio.run(run())
