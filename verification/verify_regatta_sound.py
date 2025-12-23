from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=['--autoplay-policy=no-user-gesture-required'])
        context = browser.new_context(has_touch=True)
        page = context.new_page()

        # Navigate to regatta
        page.goto("http://localhost:8080/regatta/index.html")
        page.wait_for_load_state("networkidle")

        # Ensure Sound object exists
        sound_exists = page.evaluate("typeof Sound !== 'undefined'")
        print(f"Sound object exists: {sound_exists}")

        # Try to call playStart
        # We wrap in try-catch in JS to report error if any
        result = page.evaluate("""
            () => {
                try {
                    // Force enable sound settings first
                    settings.soundEnabled = true;
                    Sound.playStart();
                    return "Success";
                } catch (e) {
                    return "Error: " + e.message;
                }
            }
        """)

        print(f"Sound.playStart() result: {result}")

        # Take a screenshot to verify UI is intact
        page.screenshot(path="verification/regatta_sound_check.png")

        browser.close()

if __name__ == "__main__":
    run()
