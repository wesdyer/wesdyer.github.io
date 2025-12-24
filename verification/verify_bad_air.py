
import os
from playwright.sync_api import sync_playwright, expect

def test_bad_air(page):
    # Get absolute path
    cwd = os.getcwd()
    url = f"file://{cwd}/regatta/index.html"

    print(f"Navigating to {url}")
    page.goto(url)

    # Wait for game state to be ready
    page.wait_for_function("window.state && window.state.boats && window.state.boats.length > 0")

    # Setup test scenario
    result = page.evaluate("""() => {
        // Reset
        resetGame();

        // Setup Wind
        state.wind.baseDirection = 0;
        state.wind.direction = 0;
        state.wind.baseSpeed = 10;
        state.wind.speed = 10;

        // Setup Boats
        // Boat 1 (AI) - Leader
        const leader = state.boats[1]; // First AI
        leader.x = 0;
        leader.y = 0;
        leader.heading = 0;
        leader.speed = 5;

        // Boat 0 (Player) - Follower
        const player = state.boats[0];
        player.x = 0;
        player.y = 50; // 50 units behind (downwind is +Y for windDir 0? No, windDir 0 is FROM North. Flow is South (0, 1). So +Y is downwind.)
        // Verify flow vector
        // wx = -sin(0) = 0. wy = cos(0) = 1.
        // dx = 0 - 0 = 0. dy = 50 - 0 = 50.
        // dDown = 0*0 + 50*1 = 50. Correct.

        player.heading = 0;
        player.speed = 5;

        // Force update to calculate physics
        // We need to run updateBoat for player to update badAirIntensity
        // We can just call updateBoat directly or wait for loop.
        // Let's call updateBoat logic manually for the player against the leader.

        // Actually, just let the game loop run for a bit?
        // But we want deterministic check.
        // Let's call updateBoat(player, 0.016) a few times.

        // Wait, updateBoat uses state.boats to check others.
        // So we just need to ensure positions are set.

        return true;
    }""")

    # Wait a bit for the game loop to process
    page.wait_for_timeout(500)

    # Check intensity
    intensity = page.evaluate("state.boats[0].badAirIntensity")
    print(f"Bad Air Intensity: {intensity}")

    # Expected: ~0.84
    # If old code: ~0.69
    if intensity > 0.8:
        print("PASS: Intensity is high (> 0.8)")
    else:
        print("FAIL: Intensity is too low")

    page.screenshot(path="verification/bad_air.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            test_bad_air(page)
        finally:
            browser.close()
