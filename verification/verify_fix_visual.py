from playwright.sync_api import sync_playwright
import os

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()

        file_path = os.path.abspath("regatta/index.html")
        page.goto(f"file://{file_path}")

        page.wait_for_function("window.state && window.state.boats && window.state.boats.length > 0")

        # Manually force finish and update leaderboard
        page.evaluate("""
            window.state.race.status = 'racing';
            const player = window.state.boats[0];
            player.raceState.leg = 5;
            player.raceState.finished = true;
            player.raceState.finishTime = 1000;

            // Force update leaderboard
            window.updateLeaderboard();
        """)

        # Take a screenshot of the leaderboard area
        # We need to make sure the leaderboard is visible.
        # It is absolutely positioned at top-24 left-4.

        page.screenshot(path="verification/leaderboard_fix.png")

        browser.close()

if __name__ == "__main__":
    run()
