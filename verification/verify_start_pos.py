
import asyncio
from playwright.async_api import async_playwright
import os

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        # Determine absolute path to index.html
        repo_root = os.getcwd()
        url = f"file://{repo_root}/regatta/index.html"

        await page.goto(url)
        await page.wait_for_timeout(2000) # Wait for load

        # Change wind direction to force update
        await page.evaluate("""() => {
            const slider = document.getElementById('conf-wind-direction');
            slider.value = 2; // East
            slider.dispatchEvent(new Event('input'));
        }""")
        await page.wait_for_timeout(1000)

        # Take screenshot of the game canvas area
        await page.screenshot(path="verification/boat_positions.png")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
