
import pytest
import re
from playwright.sync_api import sync_playwright, expect
import os
import time

def test_current_indicator_color():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 1280, 'height': 720})
        page = context.new_page()

        file_path = os.path.abspath("regatta/index.html")
        file_url = f"file://{file_path}"

        print(f"Navigating to: {file_url}")
        page.goto(file_url)

        # Wait for the canvas to load
        page.wait_for_selector("#gameCanvas")

        # Enable current via ID since get_by_label might fail on complex HTML structures with hidden inputs
        # The checkbox has id="conf-current-enable"
        page.locator("#conf-current-enable").check()

        # Set speed to max
        page.evaluate("document.getElementById('conf-current-speed').value = '3.0'")
        page.evaluate("document.getElementById('conf-current-speed').dispatchEvent(new Event('input'))")

        # Start Race
        page.locator("#start-race-btn").click()

        # Wait a bit for transition and particles to spawn
        time.sleep(2)

        # Take a screenshot
        screenshot_path = "verification/current_color.png"
        page.screenshot(path=screenshot_path)
        print(f"Screenshot saved to {screenshot_path}")

        browser.close()

if __name__ == "__main__":
    try:
        test_current_indicator_color()
        print("Test script executed successfully.")
    except Exception as e:
        print(f"Test execution failed: {e}")
        exit(1)
