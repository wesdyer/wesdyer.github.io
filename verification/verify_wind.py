
import os
import time
from playwright.sync_api import sync_playwright, expect

def verify_wind_ui():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Use a larger viewport to see the UI clearly
        context = browser.new_context(viewport={'width': 1280, 'height': 720})
        page = context.new_page()

        # Navigate to the file directly
        url = f"file://{os.path.abspath('regatta/index.html')}"
        print(f"Navigating to {url}")
        page.goto(url)

        # Wait for game to initialize
        time.sleep(2)

        # Click Start Race to get into the game
        print("Starting race...")
        start_btn = page.locator("#start-race-btn")
        if start_btn.is_visible():
            start_btn.click()
            time.sleep(1)

        # Verify initial state (TWA)
        print("Checking initial state (TWA)...")
        label = page.locator("#hud-wind-label")
        expect(label).to_have_text("TWA")

        # Press F6 to toggle
        print("Pressing F6 to toggle to AWA...")
        page.keyboard.press("F6")
        time.sleep(0.5)

        # Verify toggle state (AWA)
        expect(label).to_have_text("AWA")

        # Check Settings Menu
        print("Opening Settings (F2)...")
        page.keyboard.press("F2")
        time.sleep(0.5)

        # Verify "Show Apparent Wind" checkbox exists and is checked
        checkbox = page.locator("#setting-apparent-wind")
        expect(checkbox).to_be_visible()
        if not checkbox.is_checked():
            print("Error: Checkbox should be checked after F6 toggle")
        else:
            print("Checkbox is correctly checked")

        # Take Screenshot
        screenshot_path = os.path.abspath("verification/verify_wind_ui.png")
        page.screenshot(path=screenshot_path)
        print(f"Screenshot saved to {screenshot_path}")

        browser.close()

if __name__ == "__main__":
    verify_wind_ui()
