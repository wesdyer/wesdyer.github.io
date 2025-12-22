
import os
from playwright.sync_api import sync_playwright

def test_regatta_no_spinnaker():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()

        # Determine the absolute path to the file
        filepath = os.path.abspath("regatta/index.html")
        page.goto(f"file://{filepath}")

        # Check if #spinnaker-status is gone
        spinnaker_status = page.locator("#spinnaker-status")
        if spinnaker_status.count() > 0:
            print("FAILED: #spinnaker-status element still exists")
        else:
            print("PASSED: #spinnaker-status element is gone")

        # Check if instruction is gone
        content = page.content()
        if "Toggle Spinnaker" in content:
            print("FAILED: 'Toggle Spinnaker' instruction text found")
        else:
            print("PASSED: 'Toggle Spinnaker' instruction text is gone")

        # Check for console errors
        page.on("console", lambda msg: print(f"CONSOLE: {msg.text}"))

        # Wait a bit to ensure script runs without error
        page.wait_for_timeout(1000)

        browser.close()

if __name__ == "__main__":
    test_regatta_no_spinnaker()
