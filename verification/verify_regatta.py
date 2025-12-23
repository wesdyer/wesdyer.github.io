
from playwright.sync_api import sync_playwright
import os

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        # Determine path
        cwd = os.getcwd()
        path = f'file://{cwd}/regatta/index.html'
        print(f'Navigating to {path}')

        page.goto(path)

        # Wait for game to initialize
        page.wait_for_timeout(2000)

        # Take screenshot
        page.screenshot(path='verification/regatta.png')
        print('Screenshot taken')

        browser.close()

if __name__ == '__main__':
    run()
