
from playwright.sync_api import sync_playwright
import os
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()

        # Navigate to regatta
        filepath = os.path.abspath('regatta/index.html')
        page.goto(f'file://{filepath}')

        # Wait for initialization
        page.wait_for_timeout(2000)

        # Take a screenshot to verify the game loads and we can visually inspect gusts if any are visible
        # Gusts are rendered as colored circles.
        page.screenshot(path='verification/gust_visual_check.png')

        browser.close()

if __name__ == "__main__":
    run()
