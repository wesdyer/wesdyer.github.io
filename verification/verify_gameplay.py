from playwright.sync_api import sync_playwright
import os
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Determine absolute path to index.html
        path = os.path.abspath("regatta/index.html")
        page.goto(f"file://{path}")

        # Wait for game to initialize
        page.wait_for_timeout(2000)

        # Click Start Race button
        start_btn = page.locator("#start-race-btn")
        if start_btn.is_visible():
            start_btn.click()
            print("Clicked Start Race")

        # Wait for race to start and AI to move (Prestart phase)
        # Accelerate time slightly to see movement
        page.evaluate("() => { state.time += 10; }")
        page.wait_for_timeout(1000)

        # Take screenshot of the start line action
        screenshot_path = os.path.abspath("verification/gameplay_start.png")
        page.screenshot(path=screenshot_path)
        print(f"Screenshot captured at {screenshot_path}")

        browser.close()

if __name__ == "__main__":
    run()
