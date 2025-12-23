
import asyncio
from playwright.async_api import async_playwright
import os

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        # Load the page
        url = f"file://{os.path.abspath('regatta/index.html')}"
        await page.goto(url)

        # Wait for canvas
        await page.wait_for_selector("#gameCanvas")

        # Set state to Leg 1 (Upwind)
        # Position boat near Upwind Gate to see if line is drawn in main view?
        # But we know main view hides it.
        # We want to check Minimap.

        await page.evaluate("""() => {
            state.race.leg = 1;
            state.race.status = 'racing';
            // Force redraw of minimap
            drawMinimap();
        }""")

        # Take screenshot of minimap
        element = await page.query_selector("#minimap")
        await element.screenshot(path="verification/minimap_before.png")

        # Also take screenshot of main view just in case
        await page.screenshot(path="verification/screen_before.png")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
