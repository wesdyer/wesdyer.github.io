
import sys
import os
from playwright.sync_api import sync_playwright

def screenshot_frontend():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Load the game
        file_path = os.path.abspath('regatta/index.html')
        page.goto(f'file://{file_path}')

        # Wait for game to init and overlay to appear
        page.wait_for_selector("#pre-race-overlay")
        page.wait_for_timeout(1000)

        # Take screenshot of the Pre-Race Overlay showing conditions
        page.screenshot(path="verification/conditions_ui.png")

        browser.close()

if __name__ == "__main__":
    screenshot_frontend()
