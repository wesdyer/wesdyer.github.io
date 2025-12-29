from playwright.sync_api import sync_playwright
import os
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()

        # Navigate to regatta index.html
        cwd = os.getcwd()
        url = f"file://{cwd}/regatta/index.html"
        print(f"Navigating to {url}")
        page.goto(url)

        # Wait for game to initialize
        time.sleep(2)

        # Capture screenshot of the initial state
        screenshot_path = f"{cwd}/verification/regatta_initial_state.png"
        page.screenshot(path=screenshot_path)
        print(f"Screenshot saved to {screenshot_path}")

        # Open Pre-Race Overlay to see settings (Islands/Current)
        # Assuming the overlay might be visible or accessible via UI interaction if game hasn't started
        # Actually, let's just inspect the HUD if the game has started or check the pre-race overlay if it's there.
        # The prompt says "Pre-Race Config Listeners" so likely there is a pre-race screen.

        # Let's take another screenshot of the pre-race overlay if visible
        try:
            if page.locator("#pre-race-overlay").is_visible():
                page.screenshot(path=f"{cwd}/verification/regatta_prerace_overlay.png")
                print("Captured pre-race overlay")
        except:
            pass

        browser.close()

if __name__ == "__main__":
    run()
