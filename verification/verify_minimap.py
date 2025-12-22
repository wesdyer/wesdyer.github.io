import os
from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()

        # Get absolute path to regatta/index.html
        repo_root = os.getcwd()
        file_path = os.path.join(repo_root, 'regatta/index.html')
        url = f'file://{file_path}'

        print(f"Navigating to {url}")
        page.goto(url)

        # Wait for canvas to be present
        page.wait_for_selector('#minimap')

        # Wait a bit for the game loop to run and draw something
        page.wait_for_timeout(1000)

        # Take screenshot of the minimap
        minimap = page.locator('#minimap')
        screenshot_path = os.path.join(repo_root, 'verification', 'minimap_after.png')
        minimap.screenshot(path=screenshot_path)
        print(f"Screenshot saved to {screenshot_path}")

        browser.close()

if __name__ == "__main__":
    run()
