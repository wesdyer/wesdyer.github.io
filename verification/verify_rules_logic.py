from playwright.sync_api import sync_playwright
import os

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Determine absolute path to index.html
        path = os.path.abspath("regatta/index.html")
        page.goto(f"file://{path}")

        # Wait for game to initialize
        page.wait_for_timeout(1000)

        # Inject scenario: Two boats on collision course (Port/Starboard)
        # Boat 0 (Player) as Stand-On (Starboard)
        # Boat 1 (AI) as Give-Way (Port)

        page.evaluate("""
            () => {
                // Reset game first
                resetGame();
                state.race.status = 'racing';

                const b1 = state.boats[0]; // Player
                const b2 = state.boats[1]; // AI

                // Position them
                b1.x = 0; b1.y = 0;
                b2.x = 200; b2.y = 200;

                // Wind from North (0)
                state.wind.direction = 0;

                // B1 heading NW (315 deg, -45). Starboard Tack.
                b1.heading = 315 * Math.PI / 180;
                b1.boomSide = 1;
                b1.speed = 1.0;

                // B2 heading NE (45 deg). Port Tack.
                b2.heading = 45 * Math.PI / 180;
                b2.boomSide = -1;
                b2.speed = 1.0;

                // They are converging.
                // Right of Way Check
                const row = getRightOfWay(b1, b2);
                window._rowResult = (row === b1) ? 'Player' : 'AI';

                // Force Update AI for B2 to see if it avoids
                // We need to advance time slightly to let avoidance kick in
                // But updateAI uses state.boats, so just calling update(0.1) is better
            }
        """)

        row_result = page.evaluate("window._rowResult")
        print(f"ROW Check (Port/Starboard): {row_result}")

        if row_result != 'Player':
            print("FAILED: Player (Starboard) should have ROW over AI (Port)")
        else:
            print("PASSED: Player (Starboard) has ROW")

        # Test Rule 11 (Windward/Leeward)
        page.evaluate("""
            () => {
                const b1 = state.boats[0]; // Leeward
                const b2 = state.boats[1]; // Windward

                b1.x = 0; b1.y = 0;
                b2.x = 50; b2.y = 0; // B2 is to the right (East)

                state.wind.direction = 0; // Wind from North

                // Both on Starboard Tack (Heading West, Boom Left? No Boom Right)
                // Heading 270 (West). Wind from Right. Starboard.
                b1.heading = 270 * Math.PI / 180;
                b2.heading = 270 * Math.PI / 180;
                b1.boomSide = 1;
                b2.boomSide = 1;

                // Wind is N. Upwind is N. Right is E.
                // B2 is East of B1. So B2 is Windward. B1 is Leeward.
                // Leeward (B1) has ROW.

                const row = getRightOfWay(b1, b2);
                window._rowResult = (row === b1) ? 'Player' : 'AI';
            }
        """)

        row_result = page.evaluate("window._rowResult")
        print(f"ROW Check (Rule 11): {row_result}")

        if row_result != 'Player':
            print("FAILED: Player (Leeward) should have ROW over AI (Windward)")
        else:
            print("PASSED: Player (Leeward) has ROW")

        browser.close()

if __name__ == "__main__":
    run()
