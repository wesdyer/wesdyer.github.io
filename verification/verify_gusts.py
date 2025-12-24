
import os
import time
from playwright.sync_api import sync_playwright

def run_test():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Get absolute path to index.html
        cwd = os.getcwd()
        url = f"file://{cwd}/regatta/index.html"

        print(f"Navigating to {url}")
        page.goto(url)

        # Wait for game to initialize
        page.wait_for_timeout(2000)

        # Check if gusts exist
        gusts_count = page.evaluate("state.gusts.length")
        print(f"Gusts count: {gusts_count}")

        # Take screenshot
        output_path = "verification/gusts_after.png"
        page.screenshot(path=output_path)
        print(f"Screenshot saved to {output_path}")

        browser.close()

if __name__ == "__main__":
    run_test()
