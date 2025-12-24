import time
import os
from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.goto("file://" + os.path.realpath("regatta/index.html"))

        # Setup state
        page.evaluate("""() => {
            state.race.status = 'racing';
            state.wind.baseSpeed = 10;
            state.wind.speed = 10;
            state.wind.baseDirection = 0;
            state.wind.direction = 0; // North

            const p = state.boats[0];
            p.x = 0; p.y = 0;
            p.heading = 0;

            // Move an AI boat upwind to create bad air
            if (state.boats.length > 1) {
                const ai = state.boats[1];
                ai.x = 0; ai.y = -100;
                ai.heading = 0;
                ai.raceState.finished = false;
                ai.speed = 0;
                ai.opacity = 1;
            }

            // Create massive gust to ensure effective wind > base wind even with bad air
            state.gusts = [{
                type: 'gust', x: 0, y: 0,
                vx: 0, vy: 0,
                radiusX: 1000, radiusY: 1000,
                maxRadiusX: 1000, maxRadiusY: 1000,
                rotation: 0,
                speedDelta: 20, // Huge gust (+20kn)
                dirDelta: 0,
                duration: 9999, age: 10
            }];

            // Force redraw logic will happen on next frame
        }""")

        time.sleep(2) # Wait for frames

        # Check class
        classes = page.locator("#hud-wind-speed").get_attribute("class")
        text = page.locator("#hud-wind-speed").text_content()

        print(f"Classes: {classes}")
        print(f"Text: {text}")

        # Take screenshot of the HUD area (top right)
        # We can just take full screenshot, it's fine.
        page.screenshot(path="verification/verification.png")

        browser.close()

if __name__ == "__main__":
    run()
