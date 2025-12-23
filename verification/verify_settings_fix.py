
import os
import time
from playwright.sync_api import sync_playwright, expect

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        # Construct the absolute file path
        file_path = os.path.abspath("regatta/index.html")
        page.goto(f"file://{file_path}")

        # Wait for the page to load
        page.wait_for_load_state("networkidle")

        print("Page loaded.")

        # Locate settings button
        settings_button = page.locator("#settings-button")
        expect(settings_button).to_be_visible()
        print("Settings button visible.")

        # Click settings button
        settings_button.click()
        print("Clicked settings button.")

        # Locate settings screen
        settings_screen = page.locator("#settings-screen")
        expect(settings_screen).to_be_visible()
        print("Settings screen visible.")

        # Take screenshot
        page.screenshot(path="verification/settings_screen.png")
        print("Screenshot taken.")

        browser.close()

if __name__ == "__main__":
    run()
