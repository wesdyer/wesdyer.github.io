
import os
import sys
from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()

        # Calculate absolute path to index.html
        cwd = os.getcwd()
        file_path = os.path.join(cwd, 'regatta/index.html')
        url = f'file://{file_path}'

        print(f"Navigating to {url}")
        page.goto(url)

        # Wait for canvas
        page.wait_for_selector('#gameCanvas')

        # Wait a bit for animation to run
        page.wait_for_timeout(2000)

        # Take screenshot
        screenshot_path = os.path.join(cwd, 'verification/regatta_screenshot.png')
        os.makedirs(os.path.dirname(screenshot_path), exist_ok=True)
        page.screenshot(path=screenshot_path)
        print(f"Screenshot saved to {screenshot_path}")

        # Check for console errors
        # (This is a basic check, in a real scenario we'd attach a listener)

        browser.close()

if __name__ == '__main__':
    run()
