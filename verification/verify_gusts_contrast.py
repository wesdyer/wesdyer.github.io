import os
from playwright.sync_api import sync_playwright

def verify_gusts():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 1280, 'height': 720})
        page = context.new_page()

        # Get absolute path to regatta/index.html
        cwd = os.getcwd()
        file_path = f"file://{os.path.join(cwd, 'regatta/index.html')}"

        page.goto(file_path)

        # Wait for game to init
        page.wait_for_timeout(1000)

        # Inject Gusts and Lulls via evaluate
        page.evaluate("""
            () => {
                // Clear existing
                state.gusts = [];

                // Add a strong Gust in the middle
                const g1 = new Gust();
                g1.x = 0; g1.y = 1800; // Center screen roughly (camera is at 0, 2000 approx)
                g1.rx = 600; g1.ry = 400;
                g1.maxRadius = 600;
                g1.rotation = 0.2;
                g1.type = 'gust';
                g1.intensity = 1.0;
                state.gusts.push(g1);

                // Add a strong Lull nearby
                const g2 = new Gust();
                g2.x = 800; g2.y = 1500;
                g2.rx = 500; g2.ry = 500;
                g2.maxRadius = 500;
                g2.type = 'lull';
                g2.intensity = 1.0;
                state.gusts.push(g2);

                // Pause to keep them there
                state.paused = true;

                // Move camera to see them
                state.camera.x = 400;
                state.camera.y = 1600;

                // Force redraw
                draw();
            }
        """)

        # Wait a bit for rendering
        page.wait_for_timeout(500)

        # Take Screenshot
        os.makedirs("verification", exist_ok=True)
        screenshot_path = "verification/gusts_final.png"
        page.screenshot(path=screenshot_path)
        print(f"Screenshot saved to {screenshot_path}")

        browser.close()

if __name__ == "__main__":
    verify_gusts()
