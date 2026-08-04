from playwright.sync_api import sync_playwright
import os
import sys

def test_rules():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        # Load local file
        cwd = os.getcwd()
        page.goto(f"file://{cwd}/regatta/index.html")

        # Wait for rules
        try:
            page.wait_for_function("() => window.Rules", timeout=5000)
        except:
            print("Rules object not found on window!")
            sys.exit(1)

        # Define Helper to run scenarios
        result = page.evaluate("""() => {
            const res = [];
            const Rules = window.Rules;

            // Mock Boats
            const createBoat = (id, x, y, heading, boomSide) => ({
                id, x, y, heading, boomSide,
                raceState: { leg: 1, finished: false, isTacking: false, inZone: false },
                velocity: {x:0, y:0}, speed: 5,
                colors: {hull: '#fff'}
            });

            // Scenario 1: Rule 10 (Starboard ROW)
            // Wind 0 (North).
            // B1: Heading -PI/2 (West). Boom 1 (Left). Starboard Tack.
            // B2: Heading PI/2 (East). Boom -1 (Right). Port Tack.
            {
                window.state.wind = { direction: 0, speed: 10 };
                const b1 = createBoat(1, 0, 0, -Math.PI/2, 1);
                const b2 = createBoat(2, 100, 0, Math.PI/2, -1);
                const eval = Rules.evaluate(b1, b2);
                res.push({
                    name: "Rule 10 Starboard vs Port",
                    passed: eval.rowBoat && eval.rowBoat.id === 1 && eval.rule === "Rule 10",
                    detail: { rule: eval.rule, reason: eval.reason, row: eval.rowBoat ? eval.rowBoat.id : null }
                });
            }

            // Scenario 2: Rule 11 (Windward/Leeward)
            // Wind 0. Both Starboard Tack (Heading West).
            // B1 (Leeward) at 0,0.
            // B2 (Windward) at 50,0 (Right of B1).
            // Wind from Right (Starboard). Right is Windward.
            // So B2 is Windward. B1 is Leeward.
            {
                const b1 = createBoat(1, 0, 0, -Math.PI/2, 1);
                const b2 = createBoat(2, 50, 0, -Math.PI/2, 1); // Right of B1
                // Check Tack
                // const t1 = Rules.getTack(b1); // 1 (Starboard)
                const eval = Rules.evaluate(b1, b2);
                res.push({
                    name: "Rule 11 Leeward ROW",
                    passed: eval.rowBoat && eval.rowBoat.id === 1 && eval.rule === "Rule 11",
                    detail: { rule: eval.rule, reason: eval.reason, row: eval.rowBoat ? eval.rowBoat.id : null }
                });
            }

            // Scenario 3: Rule 13 (Tacking)
            {
                const b1 = createBoat(1, 0, 0, 0, 1);
                b1.raceState.isTacking = true;
                const b2 = createBoat(2, 100, 0, 0, 1);
                const eval = Rules.evaluate(b1, b2);
                res.push({
                    name: "Rule 13 Tacking keeps clear",
                    passed: eval.rowBoat && eval.rowBoat.id === 2 && eval.rule === "Rule 13",
                    detail: { rule: eval.rule, reason: eval.reason, row: eval.rowBoat ? eval.rowBoat.id : null }
                });
            }

            // Scenario 4: Rule 18 (Zone Entry - Clear Ahead)
            // Mark at 0,0.
            // B1 enters zone (dist 160). B2 outside (dist 200).
            // B2 Clear Astern of B1.
            {
                window.state.course = { marks: [{x:0, y:0}, {x:0,y:0}, {x:0,y:0}, {x:0,y:0}] };
                window.state.time = 100;

                const b1 = createBoat(1, 0, 160, 0, 1); // 160 from mark (0,0)
                const b2 = createBoat(2, 0, 200, 0, 1); // 200 from mark

                // Initialize Interactions (needed for Zone Latching)
                // We need to clear previous interactions for IDs 1 and 2
                Rules.interactions = {};

                window.state.boats = [b1, b2];
                Rules.update(0.1);

                const eval = Rules.evaluate(b1, b2);
                res.push({
                    name: "Rule 18 Clear Ahead (Zone Entry)",
                    passed: eval.rowBoat && eval.rowBoat.id === 1 && eval.rule === "Rule 18",
                    detail: { rule: eval.rule, reason: eval.reason, row: eval.rowBoat ? eval.rowBoat.id : null }
                });
            }

            return res;
        }""")

        for r in result:
            print(f"{r['name']}: {'PASS' if r['passed'] else 'FAIL'} - {r['detail']}")
            if not r['passed']:
                sys.exit(1)

if __name__ == "__main__":
    test_rules()
