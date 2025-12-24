
from playwright.sync_api import sync_playwright
import time
import os

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        # Load the page
        url = 'file://' + os.path.abspath('regatta/index.html')
        print(f'Loading {url}')
        page.goto(url)

        # Wait for canvas
        page.wait_for_selector('#gameCanvas')

        # Inject code to force spawn gusts for verification
        page.evaluate('''() => {
            // Force create some gusts visible on screen
            const cx = window.state.camera.x;
            const cy = window.state.camera.y;

            // Clear existing
            window.state.gusts = [];

            // Create a visible gust
            window.state.gusts.push({
                type: 'gust',
                x: cx - 200,
                y: cy - 200,
                vx: 0, vy: 0,
                radiusX: 400,
                radiusY: 200,
                rotation: window.state.wind.direction,
                speedDelta: 5,
                dirDelta: 0,
                duration: 999,
                age: 5 // mid-life for max opacity
            });

            // Create a visible lull
            window.state.gusts.push({
                type: 'lull',
                x: cx + 200,
                y: cy + 200,
                vx: 0, vy: 0,
                radiusX: 400,
                radiusY: 200,
                rotation: window.state.wind.direction,
                speedDelta: -5,
                dirDelta: 0,
                duration: 999,
                age: 5
            });

            // Force redraw immediately to ensure they appear
            // (The loop runs constantly so just waiting a frame is enough)
        }''')

        # Wait a bit for render
        time.sleep(1)

        # Screenshot
        path = 'verification/gusts_minimap.png'
        page.screenshot(path=path)
        print(f'Screenshot saved to {path}')

        browser.close()

if __name__ == '__main__':
    run()
