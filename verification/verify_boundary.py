
import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        await page.goto("http://localhost:8000/regatta/index.html")

        # Wait for game to initialize
        await page.wait_for_timeout(1000)

        # Inject code to move camera to boundary and pause game
        await page.evaluate("""
            state.paused = true;
            const b = state.course.boundary;
            state.camera.x = b.x + b.radius;
            state.camera.y = b.y;
            state.camera.rotation = -Math.PI / 2;
        """)

        await page.wait_for_timeout(500)
        await page.screenshot(path="verification/boundary_fixed.png")
        print("Screenshot saved to verification/boundary_fixed.png")

        await browser.close()

asyncio.run(run())
