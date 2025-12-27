
import os
import time
from playwright.sync_api import sync_playwright

def verify_characters(page):
    # Get absolute path to index.html
    cwd = os.getcwd()
    file_path = f"file://{cwd}/regatta/index.html"

    page.goto(file_path)

    # Wait for game to initialize
    page.wait_for_timeout(2000)

    # Check if AI_CONFIG is loaded and contains new characters
    ai_config_length = page.evaluate("AI_CONFIG.length")
    print(f"Total AI Config entries: {ai_config_length}")

    # Check for specific new character
    has_bixby = page.evaluate("AI_CONFIG.some(c => c.name === 'Bixby')")
    has_slipstream = page.evaluate("AI_CONFIG.some(c => c.name === 'Slipstream')")

    print(f"Has Bixby: {has_bixby}")
    print(f"Has Slipstream: {has_slipstream}")

    # Check quotes
    has_quotes = page.evaluate("typeof AI_QUOTES !== 'undefined'")
    print(f"AI_QUOTES defined: {has_quotes}")

    if has_quotes:
        bixby_quote = page.evaluate("AI_QUOTES['Bixby'] ? true : false")
        slipstream_quote = page.evaluate("AI_QUOTES['Slipstream'] ? true : false")

        # Check specific quote content to ensure rich quotes are preserved
        bixby_rich = page.evaluate("AI_QUOTES['Bixby'].player_passes_them ? true : false")

        print(f"Has Bixby quotes: {bixby_quote}")
        print(f"Has Bixby rich quotes: {bixby_rich}")
        print(f"Has Slipstream quotes: {slipstream_quote}")

    page.screenshot(path="verification/verification.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            verify_characters(page)
        finally:
            browser.close()
