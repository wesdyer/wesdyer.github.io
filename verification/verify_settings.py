from playwright.sync_api import sync_playwright, expect
import time
import os

def test_regatta_settings(page):
    # Navigate to the app
    # We use localhost:8000/regatta/index.html since we started the server in root
    page.goto("http://localhost:8000/regatta/index.html")

    # Wait for the canvas to load (simple check)
    page.wait_for_selector("#gameCanvas")

    # Click Settings Button
    settings_btn = page.locator("#settings-button")
    settings_btn.click()

    # Wait for settings screen
    settings_screen = page.locator("#settings-screen")
    expect(settings_screen).to_be_visible()

    # Take screenshot of settings (Initial state)
    page.screenshot(path="verification/settings_initial.png")

    # Check Camera Mode Select exists
    camera_select = page.locator("#setting-camera-mode")
    expect(camera_select).to_be_visible()

    # Change Camera Mode to North
    camera_select.select_option("north")

    # Toggle Manual Trim to check blue color
    # The input is hidden (sr-only), so we must click the label or the visual div to toggle it.
    # We locate the label that contains the input.
    trim_label = page.locator("label").filter(has=page.locator("#setting-trim"))
    trim_label.click()

    # Take screenshot of settings (Modified state)
    page.screenshot(path="verification/settings_modified.png")

    # Close settings
    close_btn = page.locator("#save-settings") # The 'Close' button has ID save-settings
    close_btn.click()

    expect(settings_screen).to_be_hidden()

    # Wait for camera rotation (visual check mostly)
    time.sleep(1)

    # Open settings again to verify persistence
    settings_btn.click()
    expect(settings_screen).to_be_visible()

    # Verify Camera Mode is still North
    expect(camera_select).to_have_value("north")

    # Verify Manual Trim is still checked (assert on the input state)
    trim_input = page.locator("#setting-trim")
    expect(trim_input).to_be_checked()

    # Take final screenshot
    page.screenshot(path="verification/settings_final.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            test_regatta_settings(page)
        finally:
            browser.close()
