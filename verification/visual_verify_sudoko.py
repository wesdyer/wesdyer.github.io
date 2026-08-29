
import os
from playwright.sync_api import sync_playwright

def verify_sudoku_visual():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()

        # Construct file URL
        cwd = os.getcwd()
        url = f"file://{cwd}/sudoko/index.html"

        print(f"Navigating to {url}")
        page.goto(url)

        # Wait for board to generate
        page.wait_for_selector(".sudoku-cell")

        # Interact
        # Click a cell (try to find an empty one)
        cells = page.locator(".sudoku-cell")
        count = cells.count()
        empty_found = False

        for i in range(count):
            if cells.nth(i).inner_text().strip() == "":
                cells.nth(i).click()
                empty_found = True
                break

        if empty_found:
            page.keyboard.press("5")

        # Take screenshot
        screenshot_path = "verification/sudoku_screenshot.png"
        page.screenshot(path=screenshot_path)
        print(f"Screenshot saved to {screenshot_path}")

        browser.close()

if __name__ == "__main__":
    verify_sudoku_visual()
