from playwright.sync_api import sync_playwright
import re

def verify_penalty():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            # Navigate to the game
            page.goto("http://localhost:8080/regatta/index.html")

            # Wait for game to load
            page.wait_for_selector("#gameCanvas")

            # Click start race button to enter racing state
            page.locator("#start-race-btn").click()

            # Inject JS to trigger penalty on player
            # We access the first boat (player) and trigger penalty
            page.evaluate("""
                if (state.boats.length > 0) {
                    triggerPenalty(state.boats[0]);
                }
            """)

            # Wait for message to appear
            message_locator = page.locator("#hud-message")
            message_locator.wait_for()

            # Check message text
            message_text = message_locator.text_content()
            print(f"Message text: {message_text}")

            if "10s" in message_text:
                print("Verification Passed: Message contains '10s'")
            else:
                print("Verification Failed: Message does not contain '10s'")

            # Verify internal state
            timer_value = page.evaluate("state.boats[0].raceState.penaltyTimer")
            print(f"Penalty Timer Value: {timer_value}")

            if timer_value <= 10.0 and timer_value > 0:
                 print("Verification Passed: Timer is <= 10.0")
            else:
                 print("Verification Failed: Timer is not <= 10.0")

            # Take screenshot
            page.screenshot(path="verification/penalty_verification.png")

        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_penalty()
