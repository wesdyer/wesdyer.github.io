import pytest
from playwright.sync_api import sync_playwright, expect
import os

def test_penalty_duration():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        context = browser.new_context()
        page = context.new_page()

        # Path to index.html
        filepath = os.path.abspath("regatta/index.html")
        page.goto(f"file://{filepath}")

        # Wait for game to initialize (state object to be available)
        page.wait_for_function("() => window.state && window.state.boats.length > 0")

        # Start the race (click start button) to get out of 'waiting' state
        # The 'Start Race' button is #start-race-btn
        page.click("#start-race-btn")

        # Enable penalties and trigger one
        penalty_info = page.evaluate("""() => {
            // Ensure penalties are enabled
            settings.penaltiesEnabled = true;

            const player = state.boats[0];

            // Trigger penalty
            triggerPenalty(player);

            return {
                timer: player.raceState.penaltyTimer,
                penalty: player.raceState.penalty,
                message: UI.message ? UI.message.textContent : null
            };
        }""")

        print(f"Penalty Timer: {penalty_info['timer']}")
        print(f"Message: {penalty_info['message']}")

        browser.close()

        return penalty_info

if __name__ == "__main__":
    test_penalty_duration()
