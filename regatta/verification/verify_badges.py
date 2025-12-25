import os
import sys
from playwright.sync_api import sync_playwright

def verify_badges():
    print("Starting badge verification...")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Load the page
        url = f"file://{os.path.abspath('regatta/index.html')}"
        print(f"Loading {url}")
        page.goto(url)

        # Wait for the overlay to be visible
        try:
            page.wait_for_selector("#pre-race-overlay", timeout=5000)
        except Exception as e:
            print("Timeout waiting for overlay")
            browser.close()
            sys.exit(1)

        # Wait for grid to populate
        page.wait_for_selector("#pr-competitors-grid > div", timeout=5000)

        badges = page.locator("#pr-competitors-grid > div")
        count = badges.count()
        print(f"Found {count} badges.")

        if count > 0:
            first_badge = badges.first
            img_container = first_badge.locator("div.relative.overflow-hidden").first

            # Get Computed Styles
            badge_height = first_badge.evaluate("el => el.getBoundingClientRect().height")
            img_height = img_container.evaluate("el => el.getBoundingClientRect().height")

            print(f"Badge Height: {badge_height}px")
            print(f"Image Container Height: {img_height}px")

            # Check expectations
            # h-48 (12rem) = 192px (Before)
            # h-96 (24rem) = 384px (Target)
            # h-32 (8rem) = 128px (Image Before)
            # h-64 (16rem) = 256px (Image Target)

            # Allow some pixel diff due to font rendering or padding if relevant, but height is usually fixed by class
            if badge_height > 200:
                print("SUCCESS: Badge is taller than original 192px.")
            else:
                print("FAIL: Badge is still small.")

            if img_height > 130:
                print("SUCCESS: Image container is taller than original 128px.")
            else:
                print("FAIL: Image container is still small.")

        page.screenshot(path="regatta/verification/badges_verified.png")
        print("Screenshot saved to regatta/verification/badges_verified.png")
        browser.close()

if __name__ == "__main__":
    verify_badges()
