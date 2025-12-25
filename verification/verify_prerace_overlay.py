from playwright.sync_api import sync_playwright
import os

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Determine absolute path to regatta/index.html
        cwd = os.getcwd()
        file_url = f"file://{cwd}/regatta/index.html"

        print(f"Navigating to {file_url}")
        page.goto(file_url)

        # Wait for the pre-race overlay to be visible
        overlay = page.locator("#pre-race-overlay")
        if overlay.is_visible():
            print("Pre-race overlay is visible.")
        else:
            print("Pre-race overlay is NOT visible.")

        # Check for competitor cards
        cards = page.locator("#pr-competitors-grid > div")
        count = cards.count()
        print(f"Found {count} competitor cards.")

        if count > 0:
            first_card = cards.first
            img_container = first_card.locator("div.w-full.h-64.relative.overflow-hidden")

            if img_container.count() > 0:
                print("Image container found.")
                # Check children of img container
                # Get inner HTML to inspect structure
                inner_html = img_container.inner_html()
                print(f"Image Container Inner HTML: {inner_html}")

                # Check for overlay
                # We are looking for a div with 'absolute inset-0 z-10' or similar
                overlays = img_container.locator("div.absolute.inset-0")
                print(f"Found {overlays.count()} overlay divs in the first card.")
            else:
                print("Image container NOT found in the first card.")

        browser.close()

if __name__ == "__main__":
    run()
