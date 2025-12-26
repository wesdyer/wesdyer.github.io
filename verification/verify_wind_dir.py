import asyncio
from playwright.async_api import async_playwright
import math

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        # Load the page from the local file system
        import os
        repo_root = os.getcwd()
        page_url = f"file://{repo_root}/regatta/index.html"
        await page.goto(page_url)

        # Wait for state to be available
        await page.wait_for_function("window.state !== undefined")

        print("Checking wind direction distribution...")

        directions = []
        for i in range(20):
            # Trigger resetGame
            await page.evaluate("resetGame()")

            # Read baseDirection
            base_dir = await page.evaluate("window.state.wind.baseDirection")
            directions.append(base_dir)
            # print(f"Run {i}: {base_dir}")

        min_dir = min(directions)
        max_dir = max(directions)

        print(f"Min Direction: {min_dir}")
        print(f"Max Direction: {max_dir}")

        # Current logic: (Math.random()-0.5)*0.5 -> Range -0.25 to 0.25
        if min_dir >= -0.3 and max_dir <= 0.3:
            print("Distribution appears constrained (Near North).")
        else:
            print("Distribution appears randomized (Full Circle).")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
