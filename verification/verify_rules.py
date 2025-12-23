from playwright.sync_api import sync_playwright
import os

def run_verification():
    file_path = os.path.abspath("regatta/index.html")
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.goto(f"file://{file_path}")

        # Wait for game to init
        page.wait_for_timeout(1000)

        # Take Screenshot of overlay
        page.evaluate("""() => {
            const b1 = state.boats[0];
            const b2 = state.boats[1];
            b1.x = 500; b1.y = 500;
            b2.x = 600; b2.y = 500;
            state.camera.x = 550; state.camera.y = 500;
            state.showNavAids = true;
            settings.penaltiesEnabled = true;

            // Setup collision course to trigger visualization
            state.wind.direction = 0;
            // b1 Starboard (West)
            b1.heading = -Math.PI/2; b1.boomSide = 1;
            // b2 Port (East)
            b2.heading = Math.PI/2; b2.boomSide = -1;

            // Force redraw
            draw();
        }""")
        page.wait_for_timeout(500)
        page.screenshot(path="verification/rules_visual.png")
        print("Screenshot saved to verification/rules_visual.png")

        browser.close()

if __name__ == "__main__":
    run_verification()
