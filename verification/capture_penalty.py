from playwright.sync_api import sync_playwright
import os

def capture_penalty_screenshot():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        context = browser.new_context()
        page = context.new_page()

        # Path to index.html
        filepath = os.path.abspath("regatta/index.html")
        page.goto(f"file://{filepath}")

        # Wait for game to initialize
        page.wait_for_function("() => window.state && window.state.boats.length > 0")

        # Start the race
        page.click("#start-race-btn")

        # Enable penalties and trigger one
        page.evaluate("""() => {
            settings.penaltiesEnabled = true;
            const player = state.boats[0];
            triggerPenalty(player);
        }""")

        # Force redraw to ensure message is visible immediately
        page.evaluate("draw()")

        # Take screenshot of the HUD area where message appears
        # The message is at top center
        page.screenshot(path="verification/penalty_screenshot.png")

        browser.close()

if __name__ == "__main__":
    capture_penalty_screenshot()
