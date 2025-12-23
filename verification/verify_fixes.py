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

        # Force race to start
        print("Forcing race start...")
        page.evaluate("""
            state.race.timer = 0;
            state.race.status = 'racing';
            updateLeaderboard();
        """)

        time.sleep(1)

        # Check for 'Player' name (Yellow text)
        content = page.content()
        if "Player" in content:
            print("SUCCESS: Found 'Player' name in leaderboard.")
        else:
            print("FAILURE: 'Player' name not found.")

        screenshot_path = "verification/leaderboard_fixes.png"
        page.screenshot(path=screenshot_path)
        print(f"Screenshot saved to {screenshot_path}")

        browser.close()

if __name__ == "__main__":
    verify_leaderboard()
