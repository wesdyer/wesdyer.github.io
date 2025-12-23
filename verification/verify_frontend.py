
import asyncio
from playwright.async_api import async_playwright, expect
import os

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        # Determine the absolute path to the file
        cwd = os.getcwd()
        filepath = os.path.join(cwd, 'regatta/index.html')
        url = f'file://{filepath}'

        print(f"Navigating to {url}")
        await page.goto(url)

        # Wait for canvas to be ready
        await page.wait_for_selector('#gameCanvas')

        # Press Enter 3 times to reach Gate mode (Heading -> North -> Wind -> Gate)
        for _ in range(3):
            await page.keyboard.press('Enter')
            await asyncio.sleep(0.5)

        # Check if message is displayed
        # Since message is on canvas, we just take a screenshot and we already verified logic with previous script.
        # But we can check state via evaluate
        message = await page.evaluate("state.camera.message")
        print(f"Current Message: {message}")

        if message != "GATE":
            print("Message is not GATE")
            exit(1)

        # Take screenshot
        os.makedirs('verification', exist_ok=True)
        screenshot_path = 'verification/regatta_gate_mode.png'
        await page.screenshot(path=screenshot_path)
        print(f"Screenshot saved to {screenshot_path}")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
