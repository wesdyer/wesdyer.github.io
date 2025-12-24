from playwright.sync_api import sync_playwright
import os

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Determine the absolute path to regatta/index.html
        cwd = os.getcwd()
        file_path = os.path.join(cwd, 'regatta/index.html')
        url = f'file://{file_path}'

        print(f"Navigating to {url}")
        page.goto(url)

        # Wait for canvas to load
        page.wait_for_selector('#gameCanvas', state='visible')

        # Access game state to force spawn a lull
        # We need to ensure game is running and we can see gusts/lulls
        # Let's override state.gusts to have one big lull right in front of camera

        page.evaluate("""
            state.race.status = 'racing';
            state.race.timer = 100;
            state.camera.x = 0;
            state.camera.y = 0;
            state.camera.rotation = 0;

            // Clear existing gusts
            state.gusts = [];

            // Create a Lull centered at (0,0)
            state.gusts.push({
                type: 'lull',
                x: 0,
                y: 0,
                vx: 0,
                vy: 0,
                radiusX: 800,
                radiusY: 400,
                rotation: 0,
                speedDelta: -5,
                dirDelta: 0,
                duration: 9999,
                age: 10 // Make it visible (fade in complete)
            });

            // Force redraw immediately if possible, but loop is running
        """)

        # Wait a brief moment for next frame
        page.wait_for_timeout(500)

        # Take screenshot
        screenshot_path = 'verification/lull_verification.png'
        page.screenshot(path=screenshot_path)
        print(f"Screenshot saved to {screenshot_path}")

        browser.close()

if __name__ == "__main__":
    run()
