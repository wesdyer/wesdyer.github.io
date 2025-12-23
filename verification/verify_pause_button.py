
from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto("file:///app/regatta/index.html")

    # Wait for the pause button to be visible
    page.wait_for_selector("#pause-button")

    # Take a screenshot
    page.screenshot(path="verification/pause_button_moved.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
