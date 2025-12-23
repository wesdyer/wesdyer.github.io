
import os
from playwright.sync_api import sync_playwright

def verify_minimap():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Emulate a larger screen or mobile depending on needs, but standard is fine.
        page = browser.new_page(viewport={'width': 1280, 'height': 800})

        # Navigate to the file directly
        file_path = os.path.abspath("regatta/index.html")
        page.goto(f"file://{file_path}")

        # Wait for canvas to be present
        page.wait_for_selector("#gameCanvas")

        # Wait a moment for things to initialize and render (game loop running)
        page.wait_for_timeout(2000)

        # Press F1 to ensure a screenshot of the whole body (optional, but let's stick to standard element screenshot)

        # Take a screenshot of the minimap specifically
        minimap = page.locator("#minimap")
        minimap.screenshot(path="verification/minimap_screenshot.png")

        # Also take a full page screenshot just in case
        page.screenshot(path="verification/full_page_screenshot.png")

        print("Screenshots taken.")
        browser.close()

if __name__ == "__main__":
    verify_minimap()
