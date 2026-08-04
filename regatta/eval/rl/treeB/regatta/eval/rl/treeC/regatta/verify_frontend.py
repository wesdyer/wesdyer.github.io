from playwright.sync_api import sync_playwright
import os

def verify_frontend():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        cwd = os.getcwd()
        page.goto(f"file://{cwd}/regatta/index.html")

        # Click Start Race
        page.locator("#start-race-btn").click()

        # Wait a bit
        page.wait_for_timeout(2000)

        # Take screenshot
        os.makedirs("verification", exist_ok=True)
        page.screenshot(path="verification/regatta_running.png")
        browser.close()

if __name__ == "__main__":
    verify_frontend()