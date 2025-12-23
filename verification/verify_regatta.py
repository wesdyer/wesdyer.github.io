
import os
from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()

    # Load the page
    url = f"file://{os.path.abspath('regatta/index.html')}"
    print(f"Loading {url}")
    page.goto(url)

    # Wait for game to initialize
    page.wait_for_timeout(1000)

    # Ensure Nav Aids are ON (default is true, but let's confirm via settings if needed, or just assume default)
    # Check if nav aids are enabled in state
    nav_aids_on = page.evaluate("state.showNavAids")
    print(f"Nav Aids On: {nav_aids_on}")

    # Force the boat to be close to the waypoint/start line and in Leg 0
    # The original logic hid text if leg==0 AND dist < 200.
    # We want to verify that text shows even if dist < 200.
    # We will modify the state directly to simulate this condition.

    page.evaluate("""
        state.race.status = 'prestart';
        state.boats[0].raceState.leg = 0;
        state.boats[0].raceState.nextWaypoint.dist = 50; // Set distance to 50m (previously hidden)
        // Force a redraw call if needed, but loop is running.
    """)

    # Wait for a frame or two
    page.wait_for_timeout(500)

    # Take screenshot
    screenshot_path = "verification/regatta_waypoint_text.png"
    page.screenshot(path=screenshot_path)
    print(f"Screenshot saved to {screenshot_path}")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
