import time
import os
import re
from playwright.sync_api import sync_playwright, expect

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Use a real path to the file
        page_path = os.path.abspath("regatta/index.html")
        page = browser.new_page()
        page.goto(f"file://{page_path}")

        # Locate the burgee image
        # It has alt="SCYC Burgee"
        burgee = page.get_by_alt_text("SCYC Burgee")

        # Check if it has the class
        expect(burgee).to_have_class(re.compile(r"burgee-flutter"))

        # Check computed style for animation
        # We can evaluate js to get computed style
        animation_name = burgee.evaluate("el => getComputedStyle(el).animationName")
        print(f"Animation Name: {animation_name}")

        if "flutter" not in animation_name:
            print("Error: Animation 'flutter' not applied.")
            exit(1)

        # Take a screenshot
        page.screenshot(path="verification/burgee_flutter.png")
        print("Screenshot saved to verification/burgee_flutter.png")

        browser.close()

if __name__ == "__main__":
    run()
