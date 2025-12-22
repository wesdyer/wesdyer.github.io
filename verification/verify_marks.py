import os
from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Get absolute path to the file
        file_path = os.path.abspath("regatta/index.html")
        page.goto(f"file://{file_path}")

        # Wait for canvas to be ready and draw a few frames
        page.wait_for_timeout(1000)

        # Take screenshot
        page.screenshot(path="verification/marks_after.png")
        print("Screenshot saved to verification/marks_after.png")

        browser.close()

if __name__ == "__main__":
    run()
