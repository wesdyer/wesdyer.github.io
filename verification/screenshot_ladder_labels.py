import re
import os
from playwright.sync_api import sync_playwright

def screenshot_ladder_label():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Use a larger viewport to see clearly
        context = browser.new_context(viewport={'width': 1280, 'height': 720})
        page = context.new_page()

        # Load the page
        page.goto(f"file://{os.path.realpath('regatta/index.html')}")

        setup_script = """
        // Pause game
        state.paused = true;
        state.showNavAids = true;
        state.race.status = 'racing';

        // Setup simple course
        state.course = {
            marks: [
                {x: 0, y: 0}, {x: 0, y: 0},
                {x: 0, y: -4000}, {x: 0, y: -4000}
            ],
            boundary: {x: 0, y: -2000, radius: 10000}
        };
        state.wind.baseDirection = 0;
        state.wind.direction = 0;

        // Move camera so line center (x=0) is off screen to left
        // Camera at x=2000, y=-500.
        state.camera.x = 2000;
        state.camera.y = -500;
        state.camera.rotation = 0;

        // Force draw
        draw();
        """

        page.evaluate(setup_script)

        # Take screenshot
        page.screenshot(path="verification/ladder_labels.png")
        print("Screenshot saved to verification/ladder_labels.png")

        browser.close()

if __name__ == "__main__":
    screenshot_ladder_label()
