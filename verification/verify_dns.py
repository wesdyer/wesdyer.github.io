import time
import os
from playwright.sync_api import sync_playwright, expect

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    # Load the page
    page.goto("file://" + os.path.realpath("regatta/index.html"))

    # Wait for game to load
    page.wait_for_timeout(1000)

    # Start the race
    page.click("#start-race-btn")

    # Force timer to near 0 for prestart
    page.evaluate("state.race.timer = 0.5")
    page.wait_for_timeout(1000)

    # Set timer to 599
    page.evaluate("state.race.timer = 599.0")

    # Wait for cutoff (2s)
    page.wait_for_timeout(2000)

    # Take screenshot of results
    page.screenshot(path="verification/verify_dns.png")

    # Check if results overlay is visible
    results = page.locator("#results-overlay")
    expect(results).to_be_visible()

    # Check for DNS text in results
    # The player (Rank 1 potentially if only one?) or in list
    # We expect "DNS" to be visible
    expect(page.get_by_text("DNS")).to_be_visible()

    browser.close()

if __name__ == "__main__":
    with sync_playwright() as playwright:
        run(playwright)
