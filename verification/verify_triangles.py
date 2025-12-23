from playwright.sync_api import sync_playwright
import math
import time
import os

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Emulate a typical desktop screen
        context = browser.new_context(viewport={'width': 1280, 'height': 720})
        page = context.new_page()

        # Load the regatta game directly
        # Ensure we point to the correct file path.
        cwd = os.getcwd()
        page.goto(f"file://{cwd}/regatta/index.html")

        # Wait for game to initialize
        page.wait_for_timeout(1000)

        # Force a conflict scenario via browser console evaluation
        # We need to ensure game is running and we can manipulate state
        page.evaluate("""() => {
            // Unpause if paused
            if (state.paused) togglePause(false);

            // Set up Player (Boat 0)
            const p = state.boats[0];
            p.x = 0;
            p.y = 0;
            p.heading = Math.PI / 2; // East (90 deg)
            p.boomSide = 1; // Starboard side? Wind is 0 (North).
                            // Heading 90 (East). Wind from Left (Port side relative to boat).
                            // Boom should be on Starboard (Right) side.
                            // boomSide > 0 is Left Boom?? Let's check logic.
                            // In script.js: boomSide > 0 => Left Boom => Starboard Tack? No.
                            // Main sheet is on Starboard -> Boom is on Port?
                            // Standard: Starboard Tack = Wind from Starboard side. Boom on Port side.
                            // Port Tack = Wind from Port side. Boom on Starboard side.
                            // Code: t1 = b1.boomSide > 0 ? 1 : -1;
                            // If boomSide > 0 (Left), t1 = 1.
                            // If t1 === 1 => Starboard wins?
                            // Rule 10: Starboard (Right of Way) vs Port (Give Way).
                            // So t1=1 must be Starboard Tack.
                            // So boomSide > 0 (Left Boom) corresponds to Starboard Tack.
            p.boomSide = -1; // Right Boom (Port Tack)
                             // Heading 90 (East). Wind 0 (North). Wind hits Port side. Boat is on Port Tack.
                             // Boom should be on Starboard (Right) side (-1).
                             // So p.boomSide = -1. This means t1 = -1 (Port Tack).

            // Set up Boat 1 (AI)
            const b1 = state.boats[1];
            b1.x = 200; // 200 units East
            b1.y = 0;
            b1.heading = -Math.PI / 2; // West (270 deg)
            b1.boomSide = 1; // Left Boom (Starboard Tack)
                             // Heading 270. Wind 0. Wind hits Starboard side. Boat on Starboard Tack.
                             // Boom on Port side (Left).
                             // So b1.boomSide = 1. This means t2 = 1 (Starboard Tack).

            // Reset velocities to approach
            p.velocity = { x: 5, y: 0 }; // Moving East
            b1.velocity = { x: -5, y: 0 }; // Moving West
            p.speed = 5;
            b1.speed = 5;

            // They are 200 units apart, head on.
            // Port (p) vs Starboard (b1).
            // Starboard (b1) has ROW.
            // Player (p) is Give Way.

            // Expected:
            // b1 (Winner/Starboard) gets Green Triangle pointing to p.
            // p (Loser/Port) gets Red Triangle pointing to b1.

            // Also ensure Nav Aids are ON
            state.showNavAids = true;
            settings.penaltiesEnabled = true;

            // Force Update to detect conflict
            // isConflictSoon checks dist < 80 OR (time < 10s AND cpa < 120).
            // Distance 200. CPA 0. Time = 200 / 10 = 20s.
            // Wait, speed 5 units/frame? Or units/sec?
            // updateBoat uses timeScale.
            // Let's set boats closer to trigger dist check or CPA check quickly.
            b1.x = 150;
        }""")

        # Wait a bit for the game loop to process (rendering happens in loop)
        page.wait_for_timeout(500)

        # Take screenshot
        os.makedirs("verification", exist_ok=True)
        screenshot_path = os.path.join("verification", "triangles.png")
        page.screenshot(path=screenshot_path)
        print(f"Screenshot saved to {screenshot_path}")

if __name__ == "__main__":
    run()
