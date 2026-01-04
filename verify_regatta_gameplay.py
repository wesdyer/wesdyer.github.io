
import os
from playwright.sync_api import sync_playwright, expect

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 1280, 'height': 720})
        page = context.new_page()

        # Capture console messages
        page.on("console", lambda msg: print(f"CONSOLE: {msg.text}"))
        page.on("pageerror", lambda exc: print(f"ERROR: {exc}"))

        # Load the page via HTTP
        page.goto("http://localhost:8080/regatta/index.html")

        # Verify initial state
        expect(page.locator("#start-race-btn")).to_be_visible()

        # Start the race
        print("Starting race...")
        page.click("#start-race-btn")

        # Wait for game to initialize and boats to appear
        # The start sequence is 30s. We just want to see boats on screen.
        page.wait_for_timeout(3000)

        # Take screenshot
        screenshot_path = os.path.abspath("verification_gameplay.png")
        page.screenshot(path=screenshot_path)
        print(f"Screenshot saved to {screenshot_path}")

        browser.close()

if __name__ == "__main__":
    run()
