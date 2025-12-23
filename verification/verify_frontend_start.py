
import os
from playwright.sync_api import sync_playwright

def verify_frontend_start():
    file_path = os.path.abspath("regatta/index.html")
    file_url = f"file://{file_path}"
    screenshot_path = os.path.abspath("verification/start_conditions.png")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto(file_url)

        # Wait for initialization
        page.wait_for_function("window.state && window.state.boats && window.state.boats.length > 0")

        # Reset game to ensure clean state and pause immediately to capture initial frame
        page.evaluate("""() => {
            window.resetGame();
            window.state.paused = true;
            window.draw(); // Force a draw call to update canvas with new state
        }""")

        # Take screenshot
        page.screenshot(path=screenshot_path)
        print(f"Screenshot saved to {screenshot_path}")

        browser.close()

if __name__ == "__main__":
    verify_frontend_start()
