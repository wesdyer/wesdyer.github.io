import os
import time
from playwright.sync_api import sync_playwright

def verify_start_time_hud():
    # Get absolute path to the file
    file_path = os.path.abspath("regatta/index.html")
    file_url = f"file://{file_path}"

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()

        print(f"Navigating to {file_url}...")
        page.goto(file_url)

        # Wait for page to load and script to initialize
        page.wait_for_selector("#gameCanvas")

        print("Injecting test state...")
        # Inject state to simulate a race in progress with a start time and some leg times
        # Trying without window. prefix for state, assuming it is in scope
        try:
            page.evaluate("""
                // If state is not on window, we hope it's in the global scope accessible here
                // But Playwright evaluate wraps in a function, so global consts might be accessible if we are in the same context?
                // Actually, let's try to find it.

                // If state is const in top level script, it is not on window.
                // But we can assign it to window if we can access it.

                // Let's try direct access.
                state.race.status = 'racing';
                state.race.startLegDuration = 2.5; // 2.5 seconds
                state.race.legTimes = [65.5, 125.75]; // Leg 1: 1:05.500, Leg 2: 2:05.750
                state.race.leg = 3;
            """)
        except Exception as e:
            print(f"Direct access failed: {e}")
            print("Attempting to rely on global exposure or checking if we need another approach.")
            # If this fails, we can't easily modify the state from outside without source modification.
            return


        # Wait a bit for the draw loop to update the UI (runs every ~16ms, UI updates every 10 frames = ~160ms)
        time.sleep(1.0)

        # Check the HUD content
        leg_times_html = page.inner_html("#hud-leg-times")
        print(f"HUD Content:\n{leg_times_html}")

        # Verify "Start" is present and formatted correctly
        if "Start: 0:02.500" in leg_times_html:
            print("SUCCESS: 'Start' time is correctly displayed.")
        else:
            print("FAILURE: 'Start' time missing or incorrect.")

        # Verify Leg 1 is present
        if "Leg 1: 1:05.500" in leg_times_html:
             print("SUCCESS: 'Leg 1' time is correctly displayed.")
        else:
             print("FAILURE: 'Leg 1' time missing or incorrect.")

        # Verify Leg 2 is present
        if "Leg 2: 2:05.750" in leg_times_html:
             print("SUCCESS: 'Leg 2' time is correctly displayed.")
        else:
             print("FAILURE: 'Leg 2' time missing or incorrect.")

        # Take a screenshot for manual verification if needed
        os.makedirs("verification", exist_ok=True)
        page.screenshot(path="verification/hud_check.png")
        print("Screenshot saved to verification/hud_check.png")

        browser.close()

if __name__ == "__main__":
    verify_start_time_hud()
