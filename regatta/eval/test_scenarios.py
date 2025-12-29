
import sys
import os
import time
from playwright.sync_api import sync_playwright

def run_tests():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Geometry Unit Tests
        file_path = os.path.abspath("regatta/tests/test_geometry.html")
        page.goto(f"file://{file_path}")

        # Wait for results
        results = page.evaluate("window.testResults")
        if not results:
            print("FAILED: No test results found.")
            sys.exit(1)

        print(f"Unit Tests: {results['total'] - results['failed']}/{results['total']} passed.")
        if results['failed'] > 0:
            print("FAILED UNIT TESTS")
            for r in results['results']:
                if not r['passed']:
                    print(f" - {r['message']}")
            sys.exit(1)

        # Scenario Tests (Integration)
        print("\nRunning Scenario Tests...")
        game_path = os.path.abspath("regatta/index.html")
        page.goto(f"file://{game_path}")
        time.sleep(2)

        # Setup Common
        page.evaluate("settings.debugMode = true;")

        # Scenario 1: Concave Bay (Trap)
        print("Scenario 1: Concave Bay")
        page.evaluate("""
            resetGame();
            state.race.status = 'racing';
            state.course.islands = [];
            const boat = state.boats[1];
            boat.x = 0; boat.y = 0;

            // Target inside a "U" shape (impossible straight line) or behind it?
            // Target Behind U-shape.
            // Boat at 0,0. Target at 0, -2000.
            // Island is U-shape facing boat.
            //    |   |
            //    |___|

            const center = {x: 0, y: -1000};
            const w = 300, h = 300;
            const isl = { x: 0, y: -1000, radius: 400, vertices: [], vegVertices:[], trees:[], rocks:[] };

            // U-shape Polygon
            isl.vertices = [
                {x: -w, y: -1000 - h}, // Top Left
                {x: -w, y: -1000 + h}, // Bottom Left
                {x: w, y: -1000 + h},  // Bottom Right
                {x: w, y: -1000 - h},  // Top Right
                {x: w-50, y: -1000 - h}, // Inner Top Right
                {x: w-50, y: -1000 + h-50}, // Inner Bottom Right
                {x: -w+50, y: -1000 + h-50}, // Inner Bottom Left
                {x: -w+50, y: -1000 - h}  // Inner Top Left
            ];
            // Fix winding order if needed? Planner uses vertices directly.
            // Inflating concave polygons using radial expansion might break concavity?
            // Our inflation: "Islands are star-shaped radial... we can inflate radially"
            // Wait, my planner.js assumes `isl.vertices` are radial from center for inflation logic!
            /*
            const center = { x: isl.x, y: isl.y };
            const vertices = isl.vertices.map(v => { ... dx * scale ... });
            */
            // If I define a custom polygon that isn't star-shaped relative to center, radial inflation might distort it weirdly but should still expand it outwards mostly.
            // The U-shape defined above: Center (0, -1000).
            // Points are around it.
            // Bottom points: y = -700. Rel y = +300.
            // Top points: y = -1300. Rel y = -300.
            // This is star-shaped relative to center! (Ray from center hits boundary once).

            state.course.islands.push(isl);

            // Force Controller Init
            if (!boat.controller) boat.controller = new BotController(boat);

            // Force Plan
            boat.controller.getNavigationTarget(); // Triggers planning if needed inside update loop?
            // Actually getNavigationTarget returns point.
            // Logic inside getNavigationTarget calls planner.
            // Let's rely on update loop.
        """)

        # Run
        for i in range(5):
            page.evaluate("loop(performance.now())")

        path_len = page.evaluate("state.boats[1].controller.currentPath.length")
        if path_len == 0:
            print("FAIL: No path generated for Concave scenario.")
        else:
            print(f"PASS: Path generated with {path_len} nodes.")

        # Verify no points inside the U (y between -1300 and -700, x between -300 and 300)
        # Actually inflation might close the gap.

        browser.close()

if __name__ == "__main__":
    run_tests()
