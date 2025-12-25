from playwright.sync_api import sync_playwright
import os

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Determine absolute path to regatta/index.html
        cwd = os.getcwd()
        file_url = f"file://{cwd}/regatta/index.html"

        print(f"Navigating to {file_url}")
        page.goto(file_url)

        # Wait for the pre-race overlay to be visible
        overlay = page.locator("#pre-race-overlay")
        if overlay.is_visible():
            print("Pre-race overlay is visible.")
            # Screenshot the pre-race overlay
            page.screenshot(path="verification/prerace_overlay.png", clip={"x": 0, "y": 0, "width": 1280, "height": 720})
        else:
            print("Pre-race overlay is NOT visible.")

        browser.close()

if __name__ == "__main__":
    run()
