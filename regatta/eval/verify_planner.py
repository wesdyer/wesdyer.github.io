
import sys
import os
import time
from playwright.sync_api import sync_playwright

def run_test():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Use absolute path
        page = browser.new_page()
        file_path = os.path.abspath("regatta/index.html")
        page.goto(f"file://{file_path}")

        # Wait for game to load
        time.sleep(2)

        # Inject test scenario
        page.evaluate("""
            // 1. Force Debug Mode
            settings.debugMode = true;
            settings.navAids = true;

            // 2. Setup Scenario
            // Reset game first to clear state
            resetGame();
            state.race.status = 'racing';
            state.race.timer = 0;

            // Clear existing islands
            state.course.islands = [];

            // Setup Boat
            const boat = state.boats[0]; // Player boat (or use AI boat 1 for test?)
            // Let's use an AI boat to test AI behavior
            const aiBoat = state.boats[1];

            // Move Player out of way
            boat.x = -5000; boat.y = -5000;

            // Position AI
            aiBoat.x = 0;
            aiBoat.y = 0;
            aiBoat.heading = 0; // Heading North (Up)
            aiBoat.speed = 0.5; // Moving
            aiBoat.raceState.leg = 1; // Treat as racing leg (to target next gate)

            // Setup Target (Upwind Gate)
            // Original logic targets midpoint of Marks 2,3 for Leg 1
            state.course.marks[2].x = -50; state.course.marks[2].y = -2000;
            state.course.marks[3].x = 50;  state.course.marks[3].y = -2000;

            // Create Obstacle Island directly in path
            // Boat at 0,0. Target at 0,-2000. Island at 0,-1000.
            const isl = {
                x: 0, y: -1000,
                radius: 200,
                vertices: [],
                vegVertices: [],
                trees: [],
                rocks: []
            };
            // Create circular polygon
            for(let i=0; i<16; i++) {
                const th = i/16 * Math.PI*2;
                isl.vertices.push({ x: isl.x + Math.cos(th)*200, y: isl.y + Math.sin(th)*200 });
            }
            state.course.islands.push(isl);

            // Force Wind from West (90 deg / PI/2) so we are reaching
            // If wind is North (0), we would tack. Reaching is simpler to verify basic pathfinding first.
            state.wind.baseDirection = Math.PI / 2;
            state.wind.direction = Math.PI / 2;
            state.wind.speed = 10;

            // Force AI update
            // Ensure controller exists (lazy init in updateAI)
            if (!aiBoat.controller) {
                aiBoat.controller = new BotController(aiBoat);
            }
            aiBoat.controller.update(0.1);
        """)

        print("Scenario initialized.")

        # Run simulation for 200 frames (approx 3-4 seconds)
        for i in range(10):
            page.evaluate("loop(performance.now())")
            # Log boat pos
            pos = page.evaluate("({x: state.boats[1].x, y: state.boats[1].y, h: state.boats[1].heading})")
            # Log path
            path_len = page.evaluate("state.boats[1].controller.currentPath.length")
            print(f"Step {i}: Pos ({pos['x']:.1f}, {pos['y']:.1f}) Heading {pos['h']:.2f} PathLen {path_len}")

            # Check if planner created a path
            if i == 0 and path_len == 0:
                print("FAILURE: No path generated!")

            time.sleep(0.1)

        # Take screenshot
        page.screenshot(path="regatta/eval/planner_test.png")
        print("Screenshot saved to regatta/eval/planner_test.png")

        # Verify avoidance
        # Boat should be steering around the island.
        # Initial heading was 0. Target is 0,-2000. Island at 0,-1000.
        # Planner should route left or right.
        # If right: x > 0. If left: x < 0.

        final_pos = page.evaluate("state.boats[1].x")
        print(f"Final X deviation: {final_pos}")

        if abs(final_pos) < 10:
             print("WARNING: Boat didn't deviate much. Might be hitting island.")
        else:
             print("SUCCESS: Boat deviated from straight line.")

        browser.close()

if __name__ == "__main__":
    run_test()
