
import os
from playwright.sync_api import sync_playwright

def verify_visuals():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()

        # Load the page
        file_path = os.path.abspath("regatta/index.html")
        page.goto(f"file://{file_path}")

        # Wait for the competitors grid to be populated
        page.wait_for_selector("#pr-competitors-grid > div")

        # Take a screenshot of the competitors grid
        screenshot_path = "verification/portrait_visual_check.png"
        page.locator("#pr-competitors-grid").screenshot(path=screenshot_path)
        print(f"Screenshot saved to {screenshot_path}")

        browser.close()

if __name__ == "__main__":
    verify_visuals()
