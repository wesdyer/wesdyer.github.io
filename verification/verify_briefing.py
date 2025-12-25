from playwright.sync_api import sync_playwright

def verify_briefing():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        # Navigate to the page
        page.goto("http://localhost:8000/regatta/index.html")

        # Click start to trigger any necessary init (though the briefing is usually the first screen)
        # Actually, in regatta, the pre-race overlay (Briefing) is shown by default or after clicking start?
        # Looking at script.js: `state.race.status = 'waiting'` and `setupPreRaceOverlay()` is called at end of init.
        # So it should be visible immediately.

        # Wait for the overlay to be visible
        page.wait_for_selector("#pre-race-overlay")

        # Take a screenshot of the briefing screen
        page.screenshot(path="verification/briefing_screen.png")

        browser.close()

if __name__ == "__main__":
    verify_briefing()
