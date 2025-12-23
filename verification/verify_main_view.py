
import asyncio
from playwright.async_api import async_playwright
import os

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        url = f"file://{os.path.abspath('regatta/index.html')}"
        await page.goto(url)
        await page.wait_for_selector("#gameCanvas")

        # Set to Leg 1 (Upwind)
        # Position camera near Upwind Gate (Marks 2 & 3)
        await page.evaluate("""() => {
            state.race.leg = 1;
            state.race.status = 'racing';

            // Move boat/camera to near Upwind Gate
            // Gate is at ~ (ux*courseDist, uy*courseDist)
            // Marks are 2 and 3.
            // Let's just center camera on Mark 2
            const m = state.course.marks[2];
            state.camera.x = m.x;
            state.camera.y = m.y;
            state.camera.target = 'free'; // Unlock from boat
            state.camera.rotation = 0; // North up

            // Ensure we render a frame
            draw();
        }""")

        await page.screenshot(path="verification/main_view_leg1.png")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
