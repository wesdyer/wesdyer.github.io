from playwright.sync_api import sync_playwright
import os

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1280, 'height': 800})

        # Navigate to index.html
        path = os.path.abspath("regatta/index.html")
        page.goto(f"file://{path}")

        # Wait for overlay
        page.wait_for_selector("#pre-race-overlay")

        # Screenshot Initial State
        page.screenshot(path="verification/step1_initial.png")
        print("Initial screenshot taken.")

        # Interact with sliders using JS evaluation because fill doesn't work well with range inputs
        # Wind Strength -> Max
        page.evaluate("document.getElementById('conf-wind-strength').value = 1.0")
        page.dispatch_event("#conf-wind-strength", "input")

        # Puff Frequency -> Min
        page.evaluate("document.getElementById('conf-puff-frequency').value = 0.0")
        page.dispatch_event("#conf-puff-frequency", "input")

        # Course Legs -> 2
        page.evaluate("document.getElementById('conf-course-legs').value = 2")
        page.dispatch_event("#conf-course-legs", "input")

        # Screenshot Updated State
        page.screenshot(path="verification/step2_updated.png")
        print("Updated screenshot taken.")

        # Verify text description changed (simple check)
        desc = page.text_content("#conf-description")
        print(f"Description: {desc}")

        # Verify Course Vals
        legs = page.text_content("#val-course-legs")
        print(f"Legs: {legs}")

        browser.close()

if __name__ == "__main__":
    run()
