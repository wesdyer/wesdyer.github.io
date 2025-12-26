
import asyncio
from playwright.async_api import async_playwright
import math
import os

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        # Determine absolute path to index.html
        cwd = os.getcwd()
        url = f"file://{cwd}/regatta/index.html"

        print(f"Loading {url}")
        await page.goto(url)

        # Wait for game to init
        await page.wait_for_function("window.state && window.state.boats && window.state.boats.length > 0")

        # Setup Test Scenario
        print("Setting up test scenario...")
        await page.evaluate("""
            () => {
                // Force Wind to North (0)
                state.wind.baseDirection = 0;
                state.wind.direction = 0;
                state.wind.speed = 15;
                state.race.conditions = { gustiness: 0, shiftiness: 0, density: 0 };

                // Re-init course aligned with North wind
                // marks[0] = (-275, 0), marks[1] = (275, 0)
                // Start/Finish is at y=0.
                initCourse();

                state.race.status = 'racing';

                // Configure AI Boat (index 1)
                const boat = state.boats[1];
                boat.raceState.leg = 4; // Finish Leg
                boat.raceState.finished = false;

                // Position boat PAST the finish line (Downwind is +Y)
                // Finish is at y=0. Boat at y=200 is 200 units past.
                // Center X is 0.
                boat.x = 0;
                boat.y = 200;

                // Heading: Facing South (Downwind, 180 deg = PI)
                boat.heading = Math.PI;
                boat.speed = 5.0;

                // Reset controller
                boat.controller = new BotController(boat);

                // Disable other boats to avoid collision noise
                for(let b of state.boats) {
                    if (b !== boat) {
                        b.x = 10000;
                        b.y = 10000;
                    }
                }
            }
        """)

        # Trace Loop
        print("Tracking AI boat...")
        positions = []
        headings = []
        targets = []

        for i in range(50): # 5 seconds
            data = await page.evaluate("""
                () => {
                    const b = state.boats[1];
                    const t = b.controller.getNavigationTarget();
                    return { x: b.x, y: b.y, h: b.heading, tx: t.x, ty: t.y };
                }
            """)
            positions.append((data['x'], data['y']))
            headings.append(data['h'])
            targets.append((data['tx'], data['ty']))

            # Print status every second (10 frames)
            if i % 10 == 0:
                print(f"T={i*0.1:.1f}s | Pos: ({data['x']:.1f}, {data['y']:.1f}) | H: {data['h']:.2f} | Target: ({data['tx']:.1f}, {data['ty']:.1f})")

            await asyncio.sleep(0.1)

        await browser.close()

        # Analysis
        start_pos = positions[0]
        end_pos = positions[-1]
        dist_moved = math.sqrt((end_pos[0]-start_pos[0])**2 + (end_pos[1]-start_pos[1])**2)

        # Calculate bounding box
        min_x = min(p[0] for p in positions)
        max_x = max(p[0] for p in positions)
        min_y = min(p[1] for p in positions)
        max_y = max(p[1] for p in positions)

        width = max_x - min_x
        height = max_y - min_y

        print(f"Total Distance Moved (net): {dist_moved:.1f}")
        print(f"Bounding Box: {width:.1f} x {height:.1f}")
        print(f"Final Target: {targets[-1]}")

        # Check if stuck in circles
        # If bounding box is small but headings changed a lot?
        # Or if target is effectively the boat's position.

        # If target is (0,0) (Center of Gate), and boat is at (0, 200).
        # Target Y is 0. Boat Y is 200.
        # It should sail Upwind (North).
        # If it circles, maybe it's constantly tacking?

        # If target is (0,0), and boat is at (0, 200).
        # Angle to target is atan2(0-0, -(0-200)) = atan2(0, 200) = 0 (North).
        # Wind is North (0).
        # Boat is sailing Upwind.
        # It should tack.

        if width < 100 and height < 100:
             print("STATUS: STUCK/CIRCLING (Small movement area)")
        else:
             print("STATUS: MOVING (Likely recovered)")

if __name__ == "__main__":
    asyncio.run(run())
