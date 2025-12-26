
from playwright.sync_api import sync_playwright
import os

def check_wakes_screenshot():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()

        filepath = os.path.abspath('regatta/index.html')
        page.goto(f'file://{filepath}')

        # Wait for game to initialize
        page.wait_for_timeout(2000)

        # Take screenshot of the pre-race screen
        page.screenshot(path='verification/prerace_screen.png')

        browser.close()

if __name__ == '__main__':
    check_wakes_screenshot()
