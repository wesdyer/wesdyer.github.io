import os
import asyncio
from playwright.async_api import async_playwright

file_path = os.path.abspath("regatta/index.html")
file_url = f"file://{file_path}"

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await page.goto(file_url)
        await page.wait_for_selector("#gameCanvas")

        # Set to Leg 1 (Intermediate) to show lines are gone
        await page.evaluate("""() => {
            resetGame();
            state.race.leg = 1;
            state.race.status = 'racing';
            const m2 = state.course.marks[2];
            const m3 = state.course.marks[3];
            const cx = (m2.x + m3.x)/2;
            const cy = (m2.y + m3.y)/2;
            state.boat.x = cx;
            state.boat.y = cy + 200;
            state.camera.target = 'boat';
            state.camera.x = cx;
            state.camera.y = cy + 200;
            state.camera.rotation = 0;
            state.paused = true;
        }""")

        # Force render
        await page.evaluate("state.paused = false")
        await asyncio.sleep(0.2)
        await page.evaluate("state.paused = true")

        path = "verification/final_check.png"
        await page.screenshot(path=path)
        print(f"Captured {path}")
        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
