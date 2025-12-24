
import os
from playwright.sync_api import sync_playwright, expect

def verify_regatta_assets():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Create a context to allow local file access if needed (though file:// works by default)
        context = browser.new_context()
        page = context.new_page()

        # Get absolute path to index.html
        cwd = os.getcwd()
        url = f"file://{cwd}/regatta/index.html"
        print(f"Navigating to {url}")

        page.goto(url)

        # 1. Verify Burgee Image (loaded from assets/images)
        # The burgee is used in the UI logo and link icon.
        # Let's check the main logo image.
        burgee_locator = page.locator('img[alt="SCYC Burgee"]')
        expect(burgee_locator).to_be_visible()

        # Check src attribute contains correct path
        # Note: browser might resolve to absolute file path, so check suffix
        src = burgee_locator.get_attribute("src")
        print(f"Burgee src: {src}")
        if "assets/images/salty-crew-yacht-club-burgee.png" not in src:
             print("WARNING: Burgee src does not match expected relative path suffix.")

        # Verify it actually loaded (naturalWidth > 0)
        is_loaded = page.evaluate("document.querySelector('img[alt=\"SCYC Burgee\"]').naturalWidth > 0")
        print(f"Burgee loaded: {is_loaded}")
        assert is_loaded, "Burgee image failed to load."

        # 2. Verify Boat Images (Pre-race overlay)
        # The pre-race overlay shows competitor list with images.
        # Wait for overlay to be visible (it's visible by default on load)
        expect(page.locator("#pre-race-overlay")).to_be_visible()

        # Check first competitor image
        # Selector: #pr-competitors-grid img
        competitor_img = page.locator("#pr-competitors-grid img").first
        expect(competitor_img).to_be_visible()

        comp_src = competitor_img.get_attribute("src")
        print(f"Competitor src: {comp_src}")
        if "assets/images/" not in comp_src:
             print("WARNING: Competitor src does not contain assets/images/ path.")

        is_comp_loaded = competitor_img.evaluate("node => node.naturalWidth > 0")
        print(f"Competitor image loaded: {is_comp_loaded}")
        assert is_comp_loaded, "Competitor image failed to load."

        # 3. Screenshot
        screenshot_path = os.path.join(cwd, "verification", "regatta_verification.png")
        page.screenshot(path=screenshot_path)
        print(f"Screenshot saved to {screenshot_path}")

        browser.close()

if __name__ == "__main__":
    verify_regatta_assets()
