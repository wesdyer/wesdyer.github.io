import os
from playwright.sync_api import sync_playwright

def verify_boundary_rendering():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Navigate to the regatta application
        # Using realpath to get absolute path
        file_path = os.path.abspath("regatta/index.html")
        page.goto(f"file://{file_path}")

        # Wait for canvas to be present
        page.wait_for_selector("#gameCanvas")

        # Wait a bit for the game to initialize and render a few frames
        page.wait_for_timeout(2000)

        # Take a screenshot
        screenshot_path = "verification/regatta_boundary.png"
        page.screenshot(path=screenshot_path)
        print(f"Screenshot saved to {screenshot_path}")

        browser.close()

if __name__ == "__main__":
    verify_boundary_rendering()
