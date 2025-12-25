from playwright.sync_api import sync_playwright, expect
import os

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    # Determine absolute path to index.html
    cwd = os.getcwd()
    url = f"file://{cwd}/regatta/index.html"

    print(f"Loading {url}")
    page.goto(url)

    # Wait for canvas
    page.wait_for_selector("#gameCanvas")

    # Start race to see wind effects
    page.locator("#start-race-btn").click()

    # Wait for race to initialize
    page.wait_for_timeout(2000)

    # Capture state to verify wind values
    wind_data = page.evaluate("""() => {
        return {
            speed: state.wind.speed,
            dir: state.wind.direction,
            gusts: state.gusts.length
        }
    }""")
    print(f"Wind Data: {wind_data}")

    if wind_data['gusts'] > 0:
        print("SUCCESS: Gusts are active.")
    else:
        print("FAILURE: No gusts found.")

    if wind_data['speed'] > 0:
         print("SUCCESS: Wind speed is positive.")

    # Take screenshot of gameplay
    page.screenshot(path="verification/gameplay_wind.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
