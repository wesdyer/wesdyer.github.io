
import os
from playwright.sync_api import sync_playwright, expect

def test_hug_portrait(page):
    # Construct absolute path to index.html
    cwd = os.getcwd()
    file_path = f"file://{cwd}/regatta/index.html"

    print(f"Navigating to {file_path}")
    page.goto(file_path)

    # Wait for the game to initialize
    page.wait_for_function("window.state && window.state.boats.length > 0")

    # Manipulate state to show leaderboard and ensure Hug is visible
    page.evaluate("""
        () => {
            // Force race status to 'racing' so leaderboard updates run and remove 'hidden' class
            window.state.race.status = 'racing';

            // Force an update
            window.updateLeaderboard();
        }
    """)

    # Wait for leaderboard to be visible
    leaderboard = page.locator("#leaderboard")
    expect(leaderboard).to_be_visible()

    # Find the row with 'Hug'
    hug_row = page.locator(".lb-row", has_text="Hug")
    expect(hug_row).to_be_visible()

    # Find the image within that row
    hug_img = hug_row.locator("img")
    expect(hug_img).to_have_attribute("src", "hug.png")

    # Take a screenshot of the Hug row specifically
    hug_row.screenshot(path="verification/hug_row_screenshot.png")

    # Take a screenshot of the whole leaderboard for context
    leaderboard.screenshot(path="verification/leaderboard_screenshot.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            test_hug_portrait(page)
            print("Verification script finished successfully.")
        except Exception as e:
            print(f"Verification script failed: {e}")
        finally:
            browser.close()
