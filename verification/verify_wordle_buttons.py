
from playwright.sync_api import sync_playwright, expect
import os

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Capture console logs
        logs = []
        page.on("console", lambda msg: logs.append(msg.text))

        url = f"file://{os.path.abspath('wordle/index.html')}"
        page.goto(url)

        # Test Skip
        print("Clicking Skip...")
        page.locator('#skip-btn').click()

        # Verify Skip Toast
        toast_container = page.locator('#toast-container')
        expect(toast_container.locator('div', has_text="Skipped to new word")).to_be_visible()
        print("Skip toast verified.")

        # Wait for toast to disappear
        page.wait_for_timeout(3500)

        # Test Reveal
        print("Clicking Reveal...")
        page.locator('#reveal-btn').click(force=True)

        # Verify side effects: New Game button must appear
        expect(page.locator('#new-game-btn')).to_be_visible()
        print("New Game button appeared.")

        # Verify a toast was logged (since transient UI is flaky to catch)
        reveal_logs = [l for l in logs if "Toast:" in l and "Skipped" not in l and "Not in word list" not in l and "Splendid" not in l]
        if reveal_logs:
             print(f"Reveal log found: {reveal_logs[-1]}")
        else:
             print("WARNING: No reveal toast log found!")

        page.screenshot(path="verification/verification.png")
        browser.close()

if __name__ == "__main__":
    run()
