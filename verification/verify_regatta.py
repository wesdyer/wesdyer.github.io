
from playwright.sync_api import sync_playwright, expect
import time

def verify_regatta_ai(page):
    # Navigate to the game
    page.goto("http://localhost:8080/regatta/")

    # Wait for the game to load
    page.wait_for_selector("#gameCanvas")

    # Start the race - Use exact locator to avoid ambiguity
    # There is a "Start Race" button in the overlay
    # <button id="start-race-btn" ...>
    page.click("#start-race-btn")

    # Wait a bit for the race to start and AI to move
    time.sleep(2)

    # Verify boats exist in state
    boats_count = page.evaluate("state.boats.length")
    print(f"Boats count: {boats_count}")

    if boats_count < 10:
        raise Exception("Not enough boats spawned")

    # Verify AI boats are moving (speed > 0 eventually)
    # Check boat 1 (AI)
    # Initial speed is 0, they should accelerate
    time.sleep(3)

    ai_speed = page.evaluate("state.boats[1].speed")
    print(f"AI Boat 1 Speed: {ai_speed}")

    # Check that 'stats' property is gone or strictly default
    stats_exist = page.evaluate("!!state.boats[1].stats")
    print(f"AI Boat 1 stats exist: {stats_exist}")

    if stats_exist:
        print("FAIL: AI stats still exist!")
        # Let's see what's in it
        stats = page.evaluate("JSON.stringify(state.boats[1].stats)")
        print(f"Stats content: {stats}")
    else:
        print("SUCCESS: AI stats removed.")

    # Screenshot
    page.screenshot(path="verification/regatta_ai.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            verify_regatta_ai(page)
        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()
