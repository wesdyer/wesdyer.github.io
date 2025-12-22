
import sys
import os
from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()

        # Determine absolute path to the file
        repo_root = os.getcwd()
        file_url = f"file://{repo_root}/regatta/index.html"

        print(f"Navigating to {file_url}")
        page.goto(file_url)

        # Wait for the game to initialize
        page.wait_for_timeout(1000)

        # Check initial state
        initial_speed = page.evaluate("state.boat.speed")
        print(f"Initial speed: {initial_speed}")

        # Move boat to boundary and set speed
        print("Moving boat outside boundary...")
        page.evaluate("""
            const b = state.course.boundary;
            // Move just outside radius
            state.boat.x = b.x + b.radius + 10;
            state.boat.y = b.y;
            state.boat.speed = 10; // Set some speed
            state.race.penalty = false; // Ensure no penalty initially
        """)

        # Wait for a few frames to let the update loop process the boundary check
        page.wait_for_timeout(500)

        # Check if speed was reset and penalty triggered
        speed = page.evaluate("state.boat.speed")
        penalty = page.evaluate("state.race.penalty")

        print(f"Speed after boundary collision: {speed}")
        print(f"Penalty state: {penalty}")

        if speed == 0 and penalty:
            print("Verified: Penalty triggered and speed reset to 0.")
        else:
            print("Observation: Penalty NOT triggered or speed NOT reset.")

        browser.close()

if __name__ == "__main__":
    run()
