from playwright.sync_api import sync_playwright
import os

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Determine absolute path to index.html
        cwd = os.getcwd()
        file_path = f"file://{cwd}/regatta/index.html"

        print(f"Navigating to {file_path}")
        page.goto(file_path)

        # Wait for game to load
        page.wait_for_selector("#gameCanvas")

        # Click start button if visible
        try:
            page.get_by_role("button", name="Start Race").click(timeout=5000)
            print("Clicked Start Race")
        except:
            print("Start button not found or already started")

        # Wait a bit for game loop to run
        page.wait_for_timeout(2000)

        # Take screenshot
        screenshot_path = "verification/regatta_loaded.png"
        page.screenshot(path=screenshot_path)
        print(f"Screenshot saved to {screenshot_path}")

        browser.close()

if __name__ == "__main__":
    run()
