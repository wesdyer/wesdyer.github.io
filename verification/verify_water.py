
import os
from playwright.sync_api import sync_playwright

def verify_water_rendering():
    # Use realpath to get the absolute path to the file
    index_path = os.path.abspath("regatta/index.html")
    file_url = f"file://{index_path}"

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 720})

        print(f"Navigating to {file_url}...")
        page.goto(file_url)

        # Wait for the game to initialize (canvas present)
        page.wait_for_selector("#gameCanvas")

        # Click "Start Race" to see the main view (pre-race overlay is semi-transparent anyway, but let's clear it)
        # Actually, let's just take a screenshot of the pre-race screen first, as water is visible behind it?
        # The pre-race overlay covers most things.
        # Let's start the race.

        start_btn = page.locator("#start-race-btn")
        if start_btn.is_visible():
            start_btn.click()

        # Wait a bit for transition
        page.wait_for_timeout(1000)

        # Take a screenshot of the main game view
        page.screenshot(path="verification/water_main.png")
        print("Screenshot saved to verification/water_main.png")

        # Toggle Debug Panel (F8)
        page.keyboard.press("F8")
        page.wait_for_selector("#water-debug")
        page.wait_for_timeout(500)

        page.screenshot(path="verification/water_debug.png")
        print("Screenshot saved to verification/water_debug.png")

        browser.close()

if __name__ == "__main__":
    verify_water_rendering()
