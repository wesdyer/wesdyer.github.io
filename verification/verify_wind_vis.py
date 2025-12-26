import re
from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()

    # Load the game using file:// protocol
    # Need absolute path
    import os
    pwd = os.getcwd()
    url = f"file://{pwd}/regatta/index.html"

    print(f"Loading {url}")
    page.goto(url)

    # Wait for canvas
    page.wait_for_selector("#gameCanvas")

    # Start race to get dynamic wind
    start_btn = page.get_by_role("button", name="Start Race")
    if start_btn.is_visible():
        start_btn.click()

    # Wait a bit for gusts to move
    page.wait_for_timeout(3000)

    # Take screenshot
    page.screenshot(path="verification/verification.png")
    print("Screenshot saved to verification/verification.png")

    # We can also evaluate state to check gusts
    gusts = page.evaluate("window.state.gusts")
    print(f"Active gusts: {len(gusts)}")
    if len(gusts) > 0:
        g0 = gusts[0]
        print(f"Gust 0: moveSpeedFactor={g0.get('moveSpeedFactor')}, rotation={g0.get('rotation')}")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
