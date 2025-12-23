from playwright.sync_api import sync_playwright
import os

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Navigate to the file
        filepath = os.path.abspath("regatta/index.html")
        page.goto(f"file://{filepath}")

        # Wait for the HUD to load
        page.wait_for_selector("#hud-leg-times")

        # Simulate some gameplay to generate stats
        # We can evaluate JS to simulate speed and movement
        page.evaluate("""
            state.boat.speed = 10; // 40 knots
            update(1.0); // Simulate 1 second
            update(1.0); // Simulate another second
        """)

        # Take a screenshot of the HUD area (bottom left)
        # Or just full page
        page.screenshot(path="verification/hud_stats.png")

        browser.close()

if __name__ == "__main__":
    run()
