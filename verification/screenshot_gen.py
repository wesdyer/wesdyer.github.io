
import os
from playwright.sync_api import sync_playwright

def capture_screenshot():
    cwd = os.getcwd()
    url = f"file://{cwd}/regatta/index.html"

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto(url)
        page.wait_for_timeout(2000) # Wait for game to load
        page.screenshot(path="verification/game_screenshot.png")
        browser.close()

if __name__ == "__main__":
    capture_screenshot()
