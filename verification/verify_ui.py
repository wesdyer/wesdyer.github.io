import playwright.sync_api
from playwright.sync_api import sync_playwright, expect
import os

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        cwd = os.getcwd()
        file_path = f"file://{cwd}/regatta/index.html"
        page.goto(file_path)

        # Setup scenario with racing status so leaderboard is visible
        page.evaluate("""
        () => {
            state.paused = true;
            state.race.status = 'racing';
            state.boats = [];
            const b1 = new Boat(0, true, 0, 0, "Player");
            // Player colors come from settings, no need to set b1.colors
            state.boats.push(b1);

            const b2 = new Boat(1, false, 0, 0, "AI Boat");
            // AI boats have colors set in constructor
            state.boats.push(b2);
            updateLeaderboard();
        }
        """)

        # Make UI visible
        page.locator("#leaderboard").wait_for(state="visible")

        # Scenario: Rank Change
        page.evaluate("""
        () => {
            const b1 = state.boats[0];
            const b2 = state.boats[1];
            // B2 moves ahead
            b2.x = 2000; b2.y = 2000;
            updateLeaderboard();
        }
        """)

        # Take screenshot of the leaderboard area
        lb = page.locator("#leaderboard")
        lb.screenshot(path="verification/leaderboard_visual.png")
        print("Screenshot saved to verification/leaderboard_visual.png")

        browser.close()

if __name__ == "__main__":
    run()
