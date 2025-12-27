from playwright.sync_api import sync_playwright, Page, expect
import os

def run_sim(page: Page):
    # Navigate to the game
    page.goto("http://localhost:8080/regatta/index.html")

    # Wait for game to load
    page.wait_for_selector("#gameCanvas")

    # Inject Current
    page.evaluate("""
        state.race.conditions.current = { speed: 3.0, direction: Math.PI / 2 }; // 3 knots East (pushes Right)
        state.wind.speed = 10;
        state.wind.direction = 0; // North

        // Reset boats to start
        resetGame();

        // Setup a test case: Boat at (0, 1000) aiming for Mark at (0, 0) (North)
        // Current pushes Right. Boat must aim Left.

        // Override AI update to force only our logic test
        // We will just log the Strategic Heading output for a dummy boat
    """)

    # Check if AI crabs
    # We'll invoke getStrategicHeading manually on a test boat
    result = page.evaluate("""
        (() => {
            const boat = new Boat(99, false, 0, 1000, "TestBot");
            boat.heading = 0;
            boat.speed = 1.25; // 5 knots
            const ctrl = new BotController(boat);

            // Target is (0, 0)
            // Current is East (Right).
            // Boat must steer West (Left, negative angle).

            const heading = ctrl.getStrategicHeading({x: 0, y: 0});
            return heading;
        })()
    """)

    print(f"Calculated Heading: {result}")

    # Expected: Negative angle (steer left to fight right current)
    if result < -0.1:
        print("PASS: AI is crabbing against current.")
    else:
        print("FAIL: AI is not crabbing effectively.")

    # Screenshot
    page.screenshot(path="verification/ai_current_test.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            run_sim(page)
        finally:
            browser.close()
