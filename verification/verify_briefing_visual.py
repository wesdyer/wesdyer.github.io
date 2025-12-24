import re
from playwright.sync_api import sync_playwright

def verify_briefing_visual():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Navigate to the game via localhost
        page.goto("http://localhost:8000/regatta/index.html")

        # Wait for pre-race overlay
        page.wait_for_selector("#pre-race-overlay")

        # Wait for competitors grid to populate
        grid = page.locator("#pr-competitors-grid")
        grid.wait_for()

        # Wait for at least one card
        page.wait_for_selector("#pr-competitors-grid > div", state="visible")

        # Take a screenshot of the competitors grid to verify visual truncation (ellipsis)
        screenshot_path = "verification/briefing_visual.png"
        grid.screenshot(path=screenshot_path)
        print(f"Screenshot saved to {screenshot_path}")

        browser.close()

if __name__ == "__main__":
    verify_briefing_visual()
