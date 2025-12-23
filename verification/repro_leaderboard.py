import playwright.sync_api
from playwright.sync_api import sync_playwright
import os
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Determine absolute path to index.html
        cwd = os.getcwd()
        file_path = f"file://{cwd}/regatta/index.html"

        print(f"Loading {file_path}")
        page.goto(file_path)

        # Wait for game to initialize
        page.wait_for_timeout(1000)

        print("Setting up test scenario...")
        setup_script = """
        () => {
            state.paused = true;
            state.race.status = 'racing'; // Ensure leaderboard is shown
            state.boats = [];

            // Create Boat A (Player)
            const b1 = new Boat(0, true, 0, 0, "Boat A");
            state.boats.push(b1);

            // Create Boat B (AI)
            const b2 = new Boat(1, false, 0, 0, "Boat B");
            state.boats.push(b2);

            // Initialize leaderboard rows
            updateLeaderboard();
        }
        """
        page.evaluate(setup_script)

        # Verify rows exist
        # Wait a small amount for DOM to potentially update if it was async (it's not, but good measure)
        page.wait_for_timeout(100)

        rows_count = page.locator(".lb-row").count()
        print(f"Rows count: {rows_count}")
        if rows_count != 2:
            print("Error: Expected 2 rows")
            # debug
            status = page.evaluate("state.race.status")
            print(f"Race status: {status}")
            lb_hidden = page.evaluate("UI.leaderboard.classList.contains('hidden')")
            print(f"Leaderboard hidden: {lb_hidden}")
            browser.close()
            return

        # Scenario 1: Boat A is ahead
        print("Scenario 1: Boat A leads")
        page.evaluate("""
        () => {
            const b1 = state.boats[0];
            const b2 = state.boats[1];
            b1.raceState.leg = 1; b1.x = 1000; b1.y = 1000;
            b2.raceState.leg = 1; b2.x = 0; b2.y = 0;
            updateLeaderboard();
        }
        """)

        # Scenario 2: Boat B takes the lead (Rank Swap)
        print("Scenario 2: Boat B takes the lead (Rank Swap)")
        page.evaluate("""
        () => {
            const b1 = state.boats[0];
            const b2 = state.boats[1];
            b2.x = 2000; b2.y = 2000; // B moves ahead
            updateLeaderboard();
        }
        """)

        classes_a = page.evaluate("UI.boatRows[0].className")
        classes_b = page.evaluate("UI.boatRows[1].className")

        print(f"Boat A classes: {classes_a}")
        print(f"Boat B classes: {classes_b}")

        has_highlight_a = "row-highlight" in classes_a
        has_highlight_b = "row-highlight" in classes_b

        print(f"Boat A has highlight: {has_highlight_a}")
        print(f"Boat B has highlight: {has_highlight_b}")

        if has_highlight_a or has_highlight_b:
            print("SUCCESS: Highlight detected on rank change.")
        else:
            print("FAILURE: Highlight NOT detected on rank change.")

        browser.close()

if __name__ == "__main__":
    run()
