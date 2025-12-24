import time
from playwright.sync_api import sync_playwright
import os

def verify_start_strategies():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Get absolute path to index.html
        cwd = os.getcwd()
        url = f"file://{cwd}/regatta/index.html"

        print(f"Navigating to {url}")
        page.goto(url)

        # Wait for game to load
        page.wait_for_selector("#gameCanvas")
        time.sleep(2) # Let init happen

        # Check if boats exist and have strategies
        strategies = page.evaluate("""() => {
            return state.boats.filter(b => !b.isPlayer).map(b => ({
                name: b.name,
                strategy: b.ai.startStrategy
            }));
        }""")

        print("AI Strategies assigned:")
        for s in strategies:
            print(f"  {s['name']}: {s['strategy']}")
            if not s['strategy']:
                print("  ERROR: Strategy missing!")
                exit(1)

        # Take screenshot of Prestart
        print("Capturing prestart screenshot...")
        time.sleep(5) # Let them move to positions
        page.screenshot(path="verification/prestart_strategies.png")

        # Fast forward time to near start?
        # We can set state.race.timer = 5
        print("Fast forwarding to start sequence...")
        page.evaluate("state.race.timer = 5;")
        time.sleep(6) # Wait for start (5s + buffer)

        print("Capturing post-start screenshot...")
        page.screenshot(path="verification/post_start.png")

        # Verify race started
        status = page.evaluate("state.race.status")
        print(f"Race Status: {status}")

        if status != 'racing':
            print("Error: Race did not start.")
            exit(1)

        print("Verification successful.")
        browser.close()

if __name__ == "__main__":
    verify_start_strategies()
