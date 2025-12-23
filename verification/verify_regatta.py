
import os
from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Get the absolute path to the file
        filepath = os.path.abspath("regatta/index.html")
        page.goto(f"file://{filepath}")

        # Wait for canvas
        page.wait_for_selector("#gameCanvas")

        # Wait a bit for the game to initialize and draw
        page.wait_for_timeout(2000)

        # Take a screenshot
        page.screenshot(path="verification/regatta_screenshot.png")

        browser.close()

if __name__ == "__main__":
    run()
