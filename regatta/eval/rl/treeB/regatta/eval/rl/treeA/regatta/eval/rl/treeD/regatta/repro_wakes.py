
from playwright.sync_api import sync_playwright
import os

def check_wakes():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()

        filepath = os.path.abspath('regatta/index.html')
        page.goto(f'file://{filepath}')

        # Wait for game to initialize
        page.wait_for_timeout(2000)

        # Check race status
        status = page.evaluate('window.state.race.status')
        print(f"Race status: {status}")

        # Check particles count (specifically wakes)
        particles = page.evaluate("window.state.particles.filter(p => p.type === 'wake' || p.type === 'wake-wave').length")
        print(f"Wake particles count: {particles}")

        if status == 'waiting' and particles > 0:
            print("FAIL: Wakes are being generated in waiting state.")
        elif status == 'waiting' and particles == 0:
            print("PASS: No wakes in waiting state.")
        else:
            print("Unknown state.")

        browser.close()

if __name__ == '__main__':
    check_wakes()
