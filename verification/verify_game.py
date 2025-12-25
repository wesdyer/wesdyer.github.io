from playwright.sync_api import sync_playwright
import os

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Navigate to the game (file protocol)
        cwd = os.getcwd()
        page.goto(f"file://{cwd}/regatta/index.html")

        # Check if Start Race button is visible
        start_btn = page.locator("#start-race-btn")
        start_btn.wait_for(state="visible")

        # Click it
        start_btn.click()

        # Wait for race to start (HUD appears)
        page.locator("#hud-timer").wait_for(state="visible")

        # Take screenshot of started game
        page.screenshot(path="verification/game_started.png")

        browser.close()

if __name__ == "__main__":
    run()
