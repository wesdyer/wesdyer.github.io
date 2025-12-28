from playwright.sync_api import sync_playwright
import os

def check_islands():
    # Use realpath to get absolute path to index.html
    path = os.path.abspath("regatta/index.html")
    url = f"file://{path}"

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Load game
        page.goto(url)

        # Wait for initialization (state object to be available)
        page.wait_for_timeout(1000)

        # Check island coverage in state
        # We run this multiple times to verify the probability roughly if possible,
        # but for visual verification we just want to see the state.

        coverage = page.evaluate("window.state.race.conditions.islandCoverage")
        print(f"Island Coverage: {coverage}")

        # Take screenshot of the pre-race overlay which shows the slider
        # The overlay ID is 'pre-race-overlay'

        # Ensure overlay is visible (resetGame triggers it)
        # Wait for it just in case
        try:
            page.wait_for_selector("#pre-race-overlay", state="visible", timeout=2000)
        except:
            print("Overlay not visible?")

        page.screenshot(path="verification/island_check.png")

        browser.close()

if __name__ == "__main__":
    check_islands()
