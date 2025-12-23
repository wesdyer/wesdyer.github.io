
import pytest
from playwright.sync_api import sync_playwright
import os
import time

def test_new_color_settings():
    # Use absolute path to the HTML file
    file_path = os.path.abspath("regatta/index.html")
    file_url = f"file://{file_path}"

    with sync_playwright() as p:
        browser = p.chromium.launch()
        # Set viewport to a good size for screenshot
        page = browser.new_page(viewport={"width": 1280, "height": 720})
        page.goto(file_url)

        # Wait for game to initialize
        time.sleep(1)

        # 1. Open Settings
        page.keyboard.press("F2")

        # Verify settings screen is visible
        settings_screen = page.locator("#settings-screen")
        assert settings_screen.is_visible()

        # 2. Check for new inputs
        sail_color_input = page.locator("#setting-color-sail")
        cockpit_color_input = page.locator("#setting-color-cockpit")

        # 3. Change inputs
        # Change Sail Color to Red (#ff0000)
        sail_color_input.fill("#ff0000")

        # Change Cockpit Color to Blue (#0000ff)
        cockpit_color_input.fill("#0000ff")

        # 4. Save and Close Settings
        # Click the "Close" button which triggers saveSettings() and toggleSettings(false)
        save_button = page.locator("#save-settings")
        save_button.click()

        # Wait for settings to close
        assert not settings_screen.is_visible()

        # 5. Take Screenshot
        # We wait a brief moment for any rendering loop to catch up (though it runs on requestAnimationFrame)
        time.sleep(0.5)

        screenshot_path = os.path.abspath("verification/regatta_boat_colors.png")
        page.screenshot(path=screenshot_path)
        print(f"Screenshot saved to {screenshot_path}")

        browser.close()

if __name__ == "__main__":
    test_new_color_settings()
