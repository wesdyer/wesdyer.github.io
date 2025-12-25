
import pytest
from playwright.sync_api import sync_playwright
import os

def test_portrait_overlay():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()

        # Load the page
        file_path = os.path.abspath("regatta/index.html")
        page.goto(f"file://{file_path}")

        # Wait for the competitors grid to be populated
        page.wait_for_selector("#pr-competitors-grid > div")

        # Check for the overlay element
        # We look for the specific class used for the overlay
        overlay_selector = "#pr-competitors-grid .absolute.inset-0.bg-gradient-to-t.from-slate-900\\/80.to-transparent"

        overlays = page.locator(overlay_selector)
        count = overlays.count()

        print(f"Found {count} overlays.")

        # We expect 9 overlays (one for each opponent) initially
        # After the fix, we expect 0

        browser.close()

if __name__ == "__main__":
    test_portrait_overlay()
