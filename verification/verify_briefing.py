import re
from playwright.sync_api import sync_playwright

def verify_briefing():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Navigate to the game via localhost
        page.goto("http://localhost:8000/regatta/index.html")

        # Wait for pre-race overlay
        page.wait_for_selector("#pre-race-overlay")

        # Wait for competitors grid to populate
        grid = page.locator("#pr-competitors-grid")
        grid.wait_for()

        # Wait for at least one card
        page.wait_for_selector("#pr-competitors-grid > div", state="visible")

        cards = page.locator("#pr-competitors-grid > div").all()
        print(f"Checking {len(cards)} cards...")

        truncated_by_js = 0
        has_line_clamp = True

        for i, card in enumerate(cards):
             desc_locator = card.locator(".italic")
             text = desc_locator.text_content()
             classes = desc_locator.get_attribute("class")

             # Check for class
             if "line-clamp-2" not in classes:
                 has_line_clamp = False
                 print(f"Card {i} missing line-clamp-2 class: {classes}")

             # Check if text looks like it was JS truncated (ends in "...")
             # Note: full text might end in "...", but unlikely for all of them.
             # And specifically "..." attached to a word usually.
             # We can also check if text length > 10 words.

             words = text.split()
             if len(words) > 10:
                 pass # Good, we allowed more words!

             # If it ends with "..." and is short, it might be suspicious if we expected full text.
             # But let's rely on the class presence and the fact that we see longer strings.
             if len(words) > 10:
                 print(f"Card {i} has {len(words)} words. (Verified > 10)")

        if has_line_clamp:
            print("Verified: All cards have 'line-clamp-2' class.")
        else:
            print("Verification Failed: Some cards missing 'line-clamp-2'.")

        browser.close()

if __name__ == "__main__":
    verify_briefing()
