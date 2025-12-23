
from playwright.sync_api import sync_playwright
import os

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        # Determine the absolute path to regatta/index.html
        cwd = os.getcwd()
        url = f'file://{cwd}/regatta/index.html'

        print(f'Navigating to {url}')
        page.goto(url)

        # Wait for canvas to be present
        page.wait_for_selector('#gameCanvas')

        # Wait a bit for the game to initialize and render
        # We want to see boats, so we need the game to start.
        # regatta/script.js auto-starts (calls resetGame and loop).
        # We need to wait for frames to render.

        page.wait_for_timeout(2000) # Wait 2 seconds

        # Take screenshot
        page.screenshot(path='verification/regatta_screenshot.png')
        print('Screenshot saved to verification/regatta_screenshot.png')

        browser.close()

if __name__ == '__main__':
    run()
