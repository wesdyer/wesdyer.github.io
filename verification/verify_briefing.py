from playwright.sync_api import sync_playwright
import os
import time

def verify_briefing():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Load the page
        url = "file://" + os.path.realpath("regatta/index.html")
        page.goto(url)

        # Wait for pre-race overlay
        overlay = page.locator("#pre-race-overlay")
        overlay.wait_for(state="visible", timeout=5000)

        # Check competitor grid
        grid = page.locator("#pr-competitors-grid")
        grid.wait_for(state="visible")

        # Get the first competitor card
        first_card = grid.locator("div.bg-slate-900\/40").first

        # Get inner text
        text = first_card.inner_text()
        print(f"Card text: {text}")

        # Check for stats
        has_stats = "Handling:" in text
        print(f"Has stats: {has_stats}")

        # Check for description class
        desc_el = first_card.locator("div.text-xs.text-slate-300.italic")
        desc_classes = desc_el.get_attribute("class")
        print(f"Description classes: {desc_classes}")

        is_truncated = "truncate" in desc_classes
        print(f"Is truncated: {is_truncated}")

        page.screenshot(path="verification/briefing_after.png")

        browser.close()

if __name__ == "__main__":
    verify_briefing()
