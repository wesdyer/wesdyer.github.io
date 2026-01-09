import re
from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()

        # Load the page
        import os
        filepath = os.path.abspath("wordle/index.html")
        page.goto(f"file://{filepath}")

        # Check buttons exist
        skip_btn = page.locator("#skip-btn")
        reveal_btn = page.locator("#reveal-btn")

        assert skip_btn.is_visible(), "Skip button should be visible"
        assert reveal_btn.is_visible(), "Reveal button should be visible"

        # Type some letters to change state
        page.keyboard.type("crane")
        page.keyboard.press("Enter")

        # Check that grid has letters
        grid = page.locator("#grid")
        first_cell = grid.locator("div").first.locator("div").first
        assert first_cell.text_content() != "", "First cell should contain letter"

        # Click Skip
        skip_btn.click()

        # Check grid is cleared (first cell empty or just empty strings in model)
        # The updateGrid function clears textContent
        # Wait a bit for UI update if async? init is sync.

        first_cell = grid.locator("div").first.locator("div").first
        assert first_cell.text_content() == "", "First cell should be empty after skip"

        # Test Reveal
        reveal_btn.click()

        # Check toast appears
        toast = page.locator("#toast-container > div")
        toast.wait_for(state="visible", timeout=2000)
        assert toast.is_visible(), "Toast should appear after reveal"

        print("Text in toast:", toast.text_content())
        assert len(toast.text_content()) == 5, "Revealed word should be 5 letters"

        browser.close()
        print("Verification passed!")

if __name__ == "__main__":
    run()
