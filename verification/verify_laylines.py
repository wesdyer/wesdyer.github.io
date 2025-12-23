from playwright.sync_api import sync_playwright
import os

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Use valid browser context for consistent rendering
        context = browser.new_context(viewport={"width": 1280, "height": 720})
        page = context.new_page()

        # Determine absolute path to index.html
        cwd = os.getcwd()
        url = f"file://{cwd}/regatta/index.html"
        print(f"Navigating to {url}")

        page.goto(url)

        # Wait for canvas to be present
        page.wait_for_selector("#gameCanvas")

        # Ensure Navaids are ON (default is true, but check)
        # We can evaluate state directly
        page.evaluate("state.showNavAids = true;")

        # Force a specific state where we can see the Start Line Laylines clearly
        # Leg 0 is Start. Laylines target Marks 0, 1.
        # Move boat to a position where laylines are visible
        # Marks 0 and 1 are at (0,0) +/- width.
        # Actually in initCourse:
        # { x: -rx * gateWidth/2, y: -ry * gateWidth/2, type: "start" }
        # { x: rx * gateWidth/2, y: ry * gateWidth/2, type: "start" }
        # Laylines extend 45 deg from wind.
        # We want to see the intersection with the mark.

        # Let us zoom in or center camera on Mark 0
        page.evaluate("""
            const m = state.course.marks[0];
            state.camera.x = m.x;
            state.camera.y = m.y;
            state.camera.target = "custom"; // unlock from boat
            state.camera.rotation = 0; // North up
        """)

        # Wait a bit for render
        page.wait_for_timeout(1000)

        page.screenshot(path="verification/laylines_start.png")
        print("Screenshot saved to verification/laylines_start.png")

        browser.close()

if __name__ == "__main__":
    run()
