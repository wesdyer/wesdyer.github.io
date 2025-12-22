
import os
import sys
from playwright.sync_api import sync_playwright

def verify_mines():
    # Get absolute path to the file
    file_path = os.path.abspath("mines/index.html")
    file_url = f"file://{file_path}"

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        failures = 0
        iterations = 20

        print(f"Running {iterations} iterations...")

        for i in range(iterations):
            page.goto(file_url)

            # Wait for grid to be ready
            page.wait_for_selector(".grid")

            # Calculate center index for Medium difficulty (16x16)
            # Center is approx row 8, col 8. Index = 8*16 + 8 = 136
            # Just picking a safe middle index.
            # Medium is default for desktop (headless is usually desktop size).
            # But let's check current difficulty or force it.
            # The script sets default based on width.

            # Let's force Medium just in case
            page.get_by_text("Medium").click()

            # Click a cell near the middle. 16x16 = 256 cells.
            # Row 7, Col 7 => 7*16 + 7 = 119.
            cell_id = "119"

            cell = page.locator(f"id={cell_id}")
            cell.click()

            # Check 'data' attribute
            data_val = cell.get_attribute("data")

            if data_val != "0":
                print(f"Iteration {i+1}: Failed. Cell data is '{data_val}'")
                failures += 1
            # else:
            #    print(f"Iteration {i+1}: Success.")

        print(f"Verification complete. Failures: {failures}/{iterations}")

        browser.close()

        if failures > 0:
            sys.exit(1)
        else:
            sys.exit(0)

if __name__ == "__main__":
    verify_mines()
