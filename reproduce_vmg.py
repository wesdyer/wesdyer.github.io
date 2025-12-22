import re
from playwright.sync_api import sync_playwright
import os
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Load the page
        url = f"file://{os.path.realpath('regatta/index.html')}"
        page.goto(url)

        # Wait for the game to initialize
        page.wait_for_timeout(1000)

        # Modify state to ensure negative VMG
        # access state directly
        page.evaluate("""
            state.wind.direction = 0;
            state.boat.heading = Math.PI;
            state.boat.speed = 1.0;
        """)

        # Wait for UI update (it runs every 10 frames)
        page.wait_for_timeout(500)

        # Check the VMG value
        vmg_element = page.locator("#hud-vmg")
        vmg_text = vmg_element.text_content()

        print(f"VMG Text: {vmg_text}")

        browser.close()

if __name__ == "__main__":
    run()
