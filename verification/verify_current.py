from playwright.sync_api import sync_playwright
import os

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1280, 'height': 720})

        # Determine absolute path to index.html
        cwd = os.getcwd()
        path = f"file://{cwd}/regatta/index.html"
        print(f"Navigating to {path}")

        page.goto(path)

        # Wait for pre-race overlay
        page.wait_for_selector("#pre-race-overlay")

        # Take screenshot of the pre-race briefing showing the Current section
        page.screenshot(path="verification/pre_race_current.png")
        print("Screenshot saved to verification/pre_race_current.png")

        # Now start the race to verify visual effects (this is harder to screenshot statically but we can try)
        page.click("#start-race-btn")

        # Wait a bit for race to start and effects to spawn
        page.wait_for_timeout(2000)

        # Take screenshot of gameplay
        page.screenshot(path="verification/gameplay_current.png")
        print("Screenshot saved to verification/gameplay_current.png")

        browser.close()

if __name__ == "__main__":
    run()
