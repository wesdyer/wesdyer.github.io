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

        # Teleport boat to Mark 0 collision distance
        await page.evaluate(f"""
            const m = window.state.course.marks[0];
            const p = window.state.boats[0];
            p.x = m.x + 20;
            p.y = m.y;
            p.raceState.penalty = false;
        """)

        # Wait a bit for the game loop to run and collision to be detected
        await asyncio.sleep(1)

        # Check if penalty is active
        penalty = await page.evaluate("window.state.boats[0].raceState.penalty")
        print(f"Penalty active: {penalty}")

        await browser.close()

        if penalty:
            print("TEST PASSED: Penalty was triggered correctly.")
        else:
            print("TEST FAILED: Penalty was NOT triggered.")
            exit(1)

if __name__ == "__main__":
    asyncio.run(run())
