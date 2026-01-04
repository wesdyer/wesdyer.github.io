
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

        # Load the page via HTTP to avoid CORS
        page.goto("http://localhost:8080/regatta/index.html")

        # Wait a bit to ensure scripts load and run
        page.wait_for_timeout(2000)

        # Check for errors in initialization
        try:
             # Check if state is defined
             is_state = page.evaluate("() => !!window.state")
             print(f"State initialized: {is_state}")
        except Exception as e:
             print(f"Error checking state: {e}")

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
