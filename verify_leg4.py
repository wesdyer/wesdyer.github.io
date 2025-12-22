import os
from playwright.sync_api import sync_playwright
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 1280, 'height': 720})
        page = context.new_page()

        cwd = os.getcwd()
        path = f"file://{cwd}/regatta/index.html"
        page.goto(path)

        # Move boat to position where we can see the finish marks (same as start marks)
        # Finish logic uses targets [0, 1]
        page.evaluate("""
            state.race.leg = 4;
            state.race.status = 'racing';

            // Move boat near finish (which is same as start)
            state.boat.x = 0;
            state.boat.y = 200; // Looking North at marks
            state.boat.heading = 0;

            draw();
        """)

        time.sleep(0.5)
        page.screenshot(path="verification/leg4_repro.png")
        browser.close()

if __name__ == "__main__":
    run()
