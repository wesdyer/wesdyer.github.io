import os
import time
from playwright.sync_api import sync_playwright

def verify_island_penalty():
    current_dir = os.getcwd()
    app_url = f"file://{current_dir}/regatta/index.html"

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto(app_url)

        # Wait for game to initialize
        page.wait_for_timeout(1000)

        # Setup test scenario via console
        # 1. Start the race logic (to ensure variables are active)
        # 2. Force 'racing' status
        # 3. Create a test island at (500, 500)
        # 4. Place player boat at (500, 500)
        # 5. Clear penalties

        print("Setting up test scenario...")
        setup_script = """
        () => {
            // Force status
            state.race.status = 'racing';

            // Define an island
            state.course.islands = [{
                x: 500,
                y: 500,
                radius: 50,
                vertices: [
                    {x: 450, y: 450},
                    {x: 550, y: 450},
                    {x: 550, y: 550},
                    {x: 450, y: 550}
                ],
                vegVertices: [],
                trees: []
            }];

            // Setup boat inside island
            const boat = state.boats[0];
            boat.x = 500;
            boat.y = 500;
            boat.speed = 5.0; // Ensure moving
            boat.heading = 0;
            boat.raceState.penalty = false;
            boat.raceState.totalPenalties = 0;

            // Enable penalties
            settings.penaltiesEnabled = true;

            console.log("Setup complete. Boat at:", boat.x, boat.y);
            return boat.raceState.totalPenalties;
        }
        """
        initial_penalties = page.evaluate(setup_script)
        print(f"Initial penalties: {initial_penalties}")

        # Run one frame or wait a bit
        print("Running simulation...")
        page.evaluate("() => { loop(performance.now()); }")
        page.wait_for_timeout(200) # Wait for a few frames
        page.evaluate("() => { loop(performance.now() + 100); }")

        # Check penalties
        final_penalties = page.evaluate("() => state.boats[0].raceState.totalPenalties")
        has_penalty = page.evaluate("() => state.boats[0].raceState.penalty")

        print(f"Final penalties: {final_penalties}")
        print(f"Active penalty: {has_penalty}")

        if final_penalties > initial_penalties or has_penalty:
            print("SUCCESS: Penalty triggered by island collision.")
        else:
            print("FAILURE: No penalty triggered.")
            # Debug info
            boat_pos = page.evaluate("() => ({x: state.boats[0].x, y: state.boats[0].y})")
            print(f"Boat final pos: {boat_pos}")

        browser.close()

if __name__ == "__main__":
    verify_island_penalty()
