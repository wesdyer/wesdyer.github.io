from playwright.sync_api import sync_playwright
import time

def verify_regatta_finish():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Create context with higher resolution for clear screenshot
        context = browser.new_context(viewport={'width': 1920, 'height': 1080})
        page = context.new_page()

        # 1. Load the game
        page.goto("file:///app/regatta/index.html")
        page.wait_for_load_state("networkidle")

        # 2. Inject state to force finish
        # We need to simulate the player finishing.
        print("Forcing player finish...")
        page.evaluate("""
            state.race.status = 'racing';
            const p = state.boats[0];
            p.raceState.leg = 5;
            p.raceState.finished = true;
            p.raceState.finishTime = 300.5; // 5:00.5
            p.raceState.legDistances = [500, 4000, 4000, 4000, 4000]; // Dummy data
            p.raceState.legTopSpeeds = [8, 12, 10, 11, 9];
            p.raceState.legManeuvers = [1, 2, 0, 3, 1];
            p.raceState.totalPenalties = 1;

            // Advance time to trigger fade out
            // fadeTimer starts at 10. We need it to go < 0.
            p.fadeTimer = -1;

            // Trigger update to allow camera switch logic to run
            // The game loop is running, so it should pick this up next frame
        """)

        # 3. Wait a moment for game loop to process state changes (camera switch, results show)
        time.sleep(2)

        # 4. Verify Results Overlay is visible
        print("Checking for results overlay...")
        results = page.locator("#results-overlay")
        if results.is_visible():
            print("Results overlay visible.")
        else:
            print("Results overlay NOT visible.")

        # 5. Take Screenshot
        page.screenshot(path="verification/regatta_results.png")
        print("Screenshot saved to verification/regatta_results.png")

        browser.close()

if __name__ == "__main__":
    verify_regatta_finish()
