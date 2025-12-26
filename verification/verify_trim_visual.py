
from playwright.sync_api import sync_playwright
import os

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 1280, 'height': 720})
        page = context.new_page()

        # Load the game
        filepath = os.path.abspath("regatta/index.html")
        page.goto(f"file://{filepath}")

        # Wait for initialization
        page.wait_for_timeout(1000)

        # Evaluate logic to setup scene
        page.evaluate("""() => {
            // Setup stable conditions
            state.paused = true;
            state.race.status = 'racing';
            state.gusts = [];
            state.race.conditions = { gustiness: 0, shiftiness: 0, strengthBias: 1, dirBias: 0 };
            state.wind.baseSpeed = 10;
            state.wind.speed = 10;
            state.wind.direction = 0; // Wind from North

            // Setup Player Boat
            const boat = state.boats[0];
            boat.isPlayer = true;
            boat.manualTrim = false; // Auto trim

            // Set Heading for TWA 45 (Starboard Tack: Heading -45 deg)
            boat.heading = -Math.PI / 4;

            // Set Speed
            boat.speed = 1.75;

            // Position
            boat.x = 0;
            boat.y = 0;
            state.camera.x = 0;
            state.camera.y = 0;
            state.camera.rotation = boat.heading; // Heading up
            state.camera.mode = 'heading';

            // Calculate trim
            updateBoat(boat, 0.1);
        }""")

        # Render frame
        page.evaluate("draw()")

        # Screenshot
        page.screenshot(path="verification/trim_verification.png")

        browser.close()

if __name__ == "__main__":
    run()
