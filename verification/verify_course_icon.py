from playwright.sync_api import sync_playwright
import os

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Navigate to the file
        file_path = os.path.abspath("regatta/index.html")
        page.goto(f"file://{file_path}")

        # Wait for the pre-race overlay to be visible (it should be by default)
        page.wait_for_selector("#pre-race-overlay")

        # Take a screenshot of the Course Card specifically
        # The course card is the second h2 in the left column usually, or I can select by text
        course_header = page.locator("h2", has_text="The Course")

        # Take a screenshot of the header specifically to verify the icon
        course_header.screenshot(path="verification/course_icon_header.png")

        # Also take a screenshot of the whole card
        card = course_header.locator("..")
        card.screenshot(path="verification/course_card.png")

        # Take a screenshot of the entire overlay for context
        page.locator("#pre-race-overlay").screenshot(path="verification/pre_race_overlay.png")

        browser.close()

if __name__ == "__main__":
    run()
