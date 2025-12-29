import time
from playwright.sync_api import sync_playwright
import os

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()

        # Navigate to regatta index.html
        # Using file protocol for simplicity as we are in the repo
        cwd = os.getcwd()
        url = f"file://{cwd}/regatta/index.html"
        print(f"Navigating to {url}")
        page.goto(url)

        # Wait for game to initialize
        time.sleep(2)

        # Check defaults on initial load
        conditions = page.evaluate("window.state.race.conditions")
        print(f"Initial Load Conditions: IslandCoverage={conditions.get('islandCoverage')}, Current={conditions.get('current')}")

        initial_islands = conditions.get('islandCoverage')
        initial_current = conditions.get('current')

        # We expect these to be 0/null by default after our change.
        # Before change, they are random.

        # Reset Game multiple times to check consistency
        failed = False
        for i in range(5):
            page.evaluate("resetGame()")
            conditions = page.evaluate("window.state.race.conditions")
            islands = conditions.get('islandCoverage')
            current = conditions.get('current')
            print(f"Reset {i+1}: IslandCoverage={islands}, Current={current}")

            if islands != 0:
                print(f"FAIL: IslandCoverage is {islands}, expected 0")
                failed = True

            if current is not None:
                print(f"FAIL: Current is {current}, expected None")
                failed = True

        browser.close()

        if failed:
            print("Verification Failed: Defaults are not consistently enforced.")
            exit(1)
        else:
            print("Verification Passed: Defaults are consistently enforced.")
            exit(0)

if __name__ == "__main__":
    run()
