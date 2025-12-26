from playwright.sync_api import sync_playwright
import os

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()

        cwd = os.getcwd()
        url = f"file://{cwd}/regatta/index.html"

        # 1. Load Page (Pre-Race Overlay is visible by default)
        page.goto(url)

        # 2. Screenshot Pre-Race Overlay to see new labels
        page.screenshot(path="verification/pre_race_overlay.png")
        print("Captured Pre-Race Overlay")

        # 3. Start Race
        page.evaluate("startRace()")

        # 4. Wait a bit for wind effects to be visible on water/particles
        page.wait_for_timeout(2000)

        # 5. Screenshot Game View (Water, Particles)
        page.screenshot(path="verification/game_view.png")
        print("Captured Game View")

        browser.close()

if __name__ == "__main__":
    run()
