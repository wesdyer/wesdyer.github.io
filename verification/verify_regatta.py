import asyncio
import os
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        # Navigate to the file directly
        file_path = os.path.abspath("regatta/index.html")
        await page.goto(f"file://{file_path}")

        # Force race start to show leaderboard
        await page.evaluate("""
            window.state.race.status = 'racing';
            window.state.race.timer = 10;
            window.updateLeaderboard();
        """)

        # Wait for leaderboard rows
        try:
            await page.wait_for_selector(".lb-row", timeout=5000)
            print("Leaderboard rows found.")
        except:
            print("Leaderboard rows NOT found.")
            await browser.close()
            return

        # Screenshot
        screenshot_path = "verification/verification.png"
        await page.screenshot(path=screenshot_path)
        print(f"Screenshot saved to {screenshot_path}")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
