
import os
import time
from playwright.sync_api import sync_playwright, expect

def run_verification():
    file_path = os.path.abspath("regatta/index.html")
    file_url = f"file://{file_path}"

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto(file_url)

        # Wait for the game to initialize
        page.wait_for_function("window.state && window.state.boats && window.state.boats.length > 0")

        # Force a reset and capture state immediately to verify initial conditions
        # We assume the user action 'resetGame()' sets the initial state correctly.
        # We need to grab the state BEFORE the next animation frame updates it too much.
        state = page.evaluate("""() => {
            window.state.paused = true; // Pause to prevent physics updates
            window.resetGame();
            return window.state;
        }""")

        wind_direction = state['wind']['direction']
        boats = state['boats']

        print(f"Wind Direction: {wind_direction}")

        all_ok = True

        for i, boat in enumerate(boats):
            speed = boat['speed']
            heading = boat['heading']

            # Check speed is 0
            if abs(speed) > 0.001:
                print(f"Boat {i} ({boat.get('name')}) has non-zero speed: {speed}")
                all_ok = False

            # Check heading is close to wind direction
            # Normalize angles for comparison
            diff = abs(heading - wind_direction)
            if diff > 6.28: diff -= 6.28

            # Should be exact since we paused immediately/grabbed state
            if diff > 0.0001:
                 print(f"Boat {i} ({boat.get('name')}) is not head to wind. Heading: {heading}, Wind: {wind_direction}, Diff: {diff}")
                 all_ok = False

        if all_ok:
            print("VERIFICATION PASSED: All boats start head to wind with zero speed.")
        else:
            print("VERIFICATION FAILED")
            exit(1)

        browser.close()

if __name__ == "__main__":
    run_verification()
