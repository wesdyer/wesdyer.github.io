
import os
from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        # Capture console messages
        page.on("console", lambda msg: print(f"CONSOLE: {msg.text}"))
        page.on("pageerror", lambda exc: print(f"ERROR: {exc}"))

        # Load the page
        filepath = os.path.abspath("regatta/index.html")
        page.goto(f"file://{filepath}")

        # Wait a bit to ensure scripts load and run
        page.wait_for_timeout(2000)

        # Check if we can start the race
        try:
            page.click("#start-race-btn", timeout=2000)
            print("Clicked Start Race")
            page.wait_for_timeout(2000)
        except Exception as e:
            print(f"Could not click start button: {e}")

        browser.close()

if __name__ == "__main__":
    run()
