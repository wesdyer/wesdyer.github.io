from playwright.sync_api import sync_playwright, expect
import time

def verify_assets():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Navigate to the regatta page
        try:
            page.goto("http://localhost:8000/regatta/index.html")

            # Wait for the burgee image to be loaded (it's critical for branding)
            # The burgee is used in the UI overlay
            burgee = page.locator("img[alt='SCYC Burgee']")
            expect(burgee).to_be_visible()

            # Verify src attribute
            src = burgee.get_attribute("src")
            print(f"Burgee src: {src}")
            if "assets/images/salty-crew-yacht-club-burgee.png" not in src:
                print("FAIL: Burgee image path is incorrect")
            else:
                print("PASS: Burgee image path is correct")

            # Check if JS loaded correctly by checking for game canvas existence
            expect(page.locator("#gameCanvas")).to_be_visible()

            # We can also check if the AI quotes script loaded by checking window object or side effects
            # but usually if script.js runs, it's good.

            # Start Race to trigger more asset loading?
            # Click Start Race button
            start_btn = page.locator("#start-race-btn")
            if start_btn.is_visible():
                start_btn.click()
                print("Clicked Start Race")
                time.sleep(1) # Wait for potential errors or loads

            # Take screenshot
            page.screenshot(path="verification/regatta_assets_verified.png")
            print("Screenshot taken")

        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_assets()
