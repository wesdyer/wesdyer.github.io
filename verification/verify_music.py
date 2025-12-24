import os
import time
from playwright.sync_api import sync_playwright

def verify_music_feature():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Navigate to the file directly
        file_path = os.path.abspath('regatta/index.html')
        page.goto(f'file://{file_path}')

        # Wait for page load
        page.wait_for_timeout(1000)

        # Open Settings (F2)
        page.keyboard.press('F2')
        page.wait_for_selector('#settings-screen')
        page.wait_for_timeout(500)

        # Check if Music checkbox exists
        music_checkbox = page.locator('#setting-music')
        if music_checkbox.is_visible():
            print("Music checkbox is visible in settings.")

            # Check default state (should be unchecked based on DEFAULT_SETTINGS musicEnabled: false)
            is_checked = music_checkbox.is_checked()
            print(f"Default music state checked: {is_checked}")

            # Take screenshot of Settings
            page.screenshot(path='verification/settings_music.png')

            # Close settings
            page.keyboard.press('Escape')
            page.wait_for_timeout(500)
        else:
            print("Music checkbox NOT found!")

        # Check Help Screen (F1 or ?)
        page.keyboard.press('?')
        page.wait_for_selector('#help-screen')
        page.wait_for_timeout(500)

        # Check for F5 keybinding text
        content = page.content()
        if 'Toggle Music' in content and 'F5' in content:
             print("Help screen contains Toggle Music (F5) instruction.")
             page.screenshot(path='verification/help_music.png')
        else:
             print("Help screen missing Toggle Music instruction.")

        # Test F5 toggle
        # Reset to game
        page.keyboard.press('Escape')
        page.wait_for_timeout(500)

        # Toggle Music ON via F5
        page.keyboard.press('F5')

        # Check settings again to see if checked
        page.keyboard.press('F2')
        page.wait_for_selector('#settings-screen')
        page.wait_for_timeout(500)
        is_checked_now = page.locator('#setting-music').is_checked()
        print(f"Music state after F5 checked: {is_checked_now}")

        if is_checked_now:
            print("F5 successfully toggled music ON.")
        else:
            print("F5 failed to toggle music ON.")

        browser.close()

if __name__ == "__main__":
    verify_music_feature()
