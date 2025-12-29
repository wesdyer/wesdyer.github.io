from playwright.sync_api import sync_playwright
import os

def verify_water_renders():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Load the regatta game
        url = f"file://{os.path.abspath('regatta/index.html')}"
        print(f"Loading {url}")
        page.goto(url)

        # Wait for the game to initialize
        page.wait_for_timeout(2000)

        # Check if WaterRenderer is initialized
        is_initialized = page.evaluate("!!window.WaterRenderer")
        print(f"WaterRenderer exists: {is_initialized}")

        # Check if WATER_CONFIG has updated values
        config = page.evaluate("window.WATER_CONFIG")
        print(f"ContourScrollSpeed: {config['contourScrollSpeed']}")
        print(f"CausticSpeed: {config['causticSpeed']}")

        # Take a screenshot to verify it renders without crashing
        page.screenshot(path="verification/water_check.png")
        print("Screenshot saved to verification/water_check.png")

        browser.close()

if __name__ == "__main__":
    verify_water_renders()
