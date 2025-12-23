
import asyncio
from playwright.async_api import async_playwright
import os

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        file_path = os.path.abspath("regatta/index.html")
        await page.goto(f"file://{file_path}")

        # Inject scenario: AI boat rounding mark
        await page.evaluate("""
            state.paused = true;
            state.boats = [];
            // Create boat at (-300, -4200) - Just past Upwind Gate (Mark 2)
            let b = new Boat(1, false, -300, -4200, "TestBot");
            state.boats.push(b);
            b.raceState.leg = 1;
            b.raceState.isRounding = true;

            // Set Camera to follow boat
            state.camera.target = 'boat';
            state.camera.x = b.x;
            state.camera.y = b.y;
            state.camera.rotation = 0; // North Up
            state.camera.mode = 'north';

            state.wind.baseDirection = 0;
            state.wind.direction = 0;
            initCourse();

            // Run one update to set heading
            updateAI(b, 0.1);

            // Force redraw
            draw();
        """)

        # Take screenshot
        screenshot_path = os.path.abspath("verification/frontend_verification.png")
        await page.screenshot(path=screenshot_path)
        print(f"Screenshot saved to {screenshot_path}")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
