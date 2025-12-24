
import asyncio
import os
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        # Get absolute path to regatta/index.html
        cwd = os.getcwd()
        url = f"file://{cwd}/regatta/index.html"

        print(f"Navigating to {url}")
        await page.goto(url)

        # Wait for gusts to spawn and be visible
        await page.wait_for_function("() => window.state && window.state.gusts && window.state.gusts.length > 0")

        # Take a screenshot
        screenshot_path = f"{cwd}/verification/gust_alignment.png"
        await page.screenshot(path=screenshot_path)
        print(f"Screenshot saved to {screenshot_path}")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
