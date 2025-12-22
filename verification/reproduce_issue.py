from playwright.sync_api import sync_playwright
import os

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()

        # Navigate to the file
        filepath = os.path.abspath("mines/index.html")
        page.goto(f"file://{filepath}")

        # Initial state - 'Medium' should be highlighted
        page.screenshot(path="verification/initial_state.png")
        print("Took initial_state.png")

        # Click 'Easy'
        page.click("text=Easy")

        # Take screenshot - 'Easy' should be highlighted now
        page.screenshot(path="verification/after_clicking_easy.png")
        print("Took after_clicking_easy.png")

        # Click 'Hard'
        page.click("text=Hard")

        # Take screenshot - 'Hard' should be highlighted now
        page.screenshot(path="verification/after_clicking_hard.png")
        print("Took after_clicking_hard.png")

        browser.close()

if __name__ == "__main__":
    run()
