
import os
import time
from playwright.sync_api import sync_playwright

def verify_gusts():
    # Get the absolute path to the regatta index.html
    current_dir = os.path.dirname(os.path.abspath(__file__))
    # Go up one level to root, then into regatta
    regatta_path = os.path.join(current_dir, "..", "regatta", "index.html")
    file_url = f"file://{os.path.abspath(regatta_path)}"

    print(f"Navigating to: {file_url}")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto(file_url)

        # Wait for the game to initialize
        time.sleep(2)

        # Start the race to see gusts on the map better (though they exist in prestart)
        # But gusts are drawn immediately in resetGame.

        # Evaluate state to check gust count
        gust_count = page.evaluate("window.state.gusts.length")
        print(f"Gust count: {gust_count}")

        # Take a screenshot
        screenshot_path = os.path.join(current_dir, "gusts_screenshot.png")
        page.screenshot(path=screenshot_path)
        print(f"Screenshot saved to: {screenshot_path}")

        browser.close()

if __name__ == "__main__":
    verify_gusts()
