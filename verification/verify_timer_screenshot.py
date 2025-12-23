
import os
import time
from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Navigate to the file
        filepath = os.path.abspath("regatta/index.html")
        page.goto(f"file://{filepath}")

        # Wait for game to initialize
        page.wait_for_selector("#hud-timer")

        # Wait a bit for scripts to load
        time.sleep(1)

        # Simulate player finishing the race
        finish_time = 123.45
        page.evaluate(f"""
            window.state.race.status = 'racing';
            window.state.race.timer = 200.0;
            window.state.boats[0].raceState.finished = true;
            window.state.boats[0].raceState.finishTime = {finish_time};
        """)

        # Wait for next frame update
        time.sleep(0.5)

        # Take screenshot
        screenshot_path = "verification/timer_stopped.png"
        page.screenshot(path=screenshot_path)
        print(f"Screenshot saved to {screenshot_path}")

        browser.close()

if __name__ == "__main__":
    run()
