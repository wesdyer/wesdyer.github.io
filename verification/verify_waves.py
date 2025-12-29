from playwright.sync_api import sync_playwright
import time
import os

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Determine absolute path to regatta/index.html
        cwd = os.getcwd()
        file_path = f"file://{cwd}/regatta/index.html"

        print(f"Navigating to {file_path}")
        page.goto(file_path)

        # Wait for game to initialize
        time.sleep(2)

        # Start race
        page.click("#start-race-btn")
        time.sleep(1)

        # Take a screenshot to manually verify
        page.screenshot(path="verification/waves_screenshot.png")
        print("Screenshot saved to verification/waves_screenshot.png")

        browser.close()

if __name__ == "__main__":
    run()
