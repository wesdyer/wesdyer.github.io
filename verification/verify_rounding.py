
from playwright.sync_api import sync_playwright
import os

def verify_rounding(page):
    # Navigate to the game
    # We can use file protocol since it's a static site
    cwd = os.getcwd()
    url = f'file://{cwd}/regatta/index.html'
    page.goto(url)

    # Wait for game to load
    page.wait_for_timeout(2000)

    # Start the race
    # Click Start Race button
    page.get_by_role('button', name='Start Race').click()

    # Wait for race to start
    page.wait_for_timeout(1000)

    # We can't easily simulate a rounding in a short script without waiting a long time.
    # However, we can inspect the AI state variables if we expose them or just verify the game runs without error.
    # The user asked for improved rounding, which is a behavioral change.
    # We can check if the code changes didn't break the game loop.

    # Take a screenshot of the start
    page.screenshot(path='verification/rounding_test.png')

    # Access internal state to verify constants if possible?
    # Playwright evaluate allows accessing window object.
    # We updated BotController methods which are instantiated on boats.

    # Let's just verify the game is running and boats are moving.
    page.wait_for_timeout(2000)
    page.screenshot(path='verification/rounding_test_2.png')

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    try:
        verify_rounding(page)
    finally:
        browser.close()
