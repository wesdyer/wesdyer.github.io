import os
from playwright.sync_api import sync_playwright

def verify_ui():
    print("Starting verification...")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Load the page
        url = f"file://{os.path.abspath('regatta/index.html')}"
        print(f"Loading {url}")
        page.goto(url)

        # Wait for the overlay to be visible (it should be by default)
        page.wait_for_selector("#pre-race-overlay")

        # 1. Verify Course Icon
        print("Verifying Course Icon...")
        # Finding the course card header
        course_header = page.locator("text=The Course").locator("xpath=..")
        icon_img = course_header.locator("img")

        if icon_img.count() > 0:
            src = icon_img.get_attribute("src")
            if "course-icon.png" in src:
                print("SUCCESS: Course icon is updated to use png.")
            else:
                print(f"FAILURE: Course icon src is {src}")
        else:
            print("FAILURE: Course icon img not found.")

        # 2. Verify Competitor Badges
        print("Verifying Competitor Badges...")
        # Wait for grid to populate
        page.wait_for_selector("#pr-competitors-grid > div")

        badges = page.locator("#pr-competitors-grid > div")
        count = badges.count()
        print(f"Found {count} badges.")

        if count > 0:
            first_badge = badges.first
            # Check for image class - shouldn't have rounded-full on the img tag itself if we changed it
            # My change: img className = "w-full h-full object-cover ..." (no rounded-full)
            # Old was: "w-12 h-12 rounded-full ..."

            img = first_badge.locator("img")
            cls = img.get_attribute("class")
            if "rounded-full" not in cls and "object-cover" in cls and "w-full" in cls:
                print(f"SUCCESS: Badge image styling looks correct: {cls}")
            else:
                print(f"FAILURE: Badge image styling mismatch: {cls}")

            # Check for vertical layout (flex-col)
            badge_cls = first_badge.get_attribute("class")
            if "flex-col" in badge_cls:
                print("SUCCESS: Badge is using vertical layout.")
            else:
                print(f"FAILURE: Badge layout mismatch: {badge_cls}")

        # Screenshot
        page.screenshot(path="verification/race_briefing_updated.png")
        print("Screenshot saved to verification/race_briefing_updated.png")

        browser.close()

if __name__ == "__main__":
    verify_ui()
