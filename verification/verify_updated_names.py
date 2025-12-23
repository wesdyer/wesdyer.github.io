import os
import time
from playwright.sync_api import sync_playwright

def verify_leaderboard():
    repo_root = os.getcwd()
    index_path = os.path.join(repo_root, 'regatta/index.html')
    url = f"file://{index_path}"

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 1280, 'height': 720})
        page = context.new_page()

        print(f"Navigating to {url}")
        page.goto(url)

        # Force race to start to show leaderboard
        print("Forcing race start...")
        page.evaluate("""
            state.race.timer = 0;
            state.race.status = 'racing';
            updateLeaderboard();
        """)

        time.sleep(1)

        # Check for R5 text (should be gone)
        r5 = page.locator("#lb-header >> text=R5")
        if r5.count() > 0:
            print("FAILURE: 'R5' text found in header!")
        else:
            print("SUCCESS: 'R5' text NOT found.")

        # Check for new names
        names = ['Apex', 'Chomp', 'Bixby', 'Gasket', 'Strut', 'Wobble', 'Whiskers', 'Bruce', 'Pinch']
        content = page.content()
        found_names = [name for name in names if name in content]
        print(f"Found names: {found_names}")

        if len(found_names) > 0:
             print("SUCCESS: Found new AI names.")
        else:
             print("FAILURE: Did not find new AI names.")

        screenshot_path = "verification/leaderboard_updated.png"
        page.screenshot(path=screenshot_path)
        print(f"Screenshot saved to {screenshot_path}")

        browser.close()

if __name__ == "__main__":
    verify_leaderboard()
