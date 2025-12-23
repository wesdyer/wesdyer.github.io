from playwright.sync_api import sync_playwright

def verify_stats(page):
    # Get absolute path to regatta index
    import os
    file_path = os.path.abspath("regatta/index.html")
    page.goto(f"file://{file_path}")

    print("Verifying initial prestart state...")

    # Check that we are in prestart
    # We can check the timer text color (orange for prestart) or the leg info text
    page.wait_for_selector("#hud-timer")

    # 1. Verify stats are NOT updating during prestart
    # We force some movement and maneuvers via evaluate
    print("Simulating movement in prestart...")
    page.evaluate("""() => {
        // Force speed and maneuvers
        state.boat.speed = 10;
        // Force a maneuver count logic trigger by flipping wind side
        state.boat.heading = state.wind.direction + 0.1;
        state.boat.lastWindSide = -1;
        update(0.1); // Run update to trigger logic
        state.boat.heading = state.wind.direction - 0.1; // Cross wind
        update(0.1);
    }""")

    # Check stats
    stats = page.evaluate("""() => {
        return {
            dist: state.race.legDistances[0],
            speed: state.race.legTopSpeeds[0],
            moves: state.race.legManeuvers[0]
        }
    }""")

    print(f"Prestart Stats: {stats}")

    if stats['dist'] > 0 or stats['speed'] > 0 or stats['moves'] > 0:
        print("FAIL: Stats tracked during prestart!")
    else:
        print("PASS: Stats not tracked during prestart.")

    # 2. Verify stats ARE updating after start
    print("Transitioning to Racing...")
    page.evaluate("""() => {
        state.race.status = 'racing';
        state.race.timer = 1.0;
    }""")

    print("Simulating movement in racing...")
    page.evaluate("""() => {
        state.boat.speed = 10;
        // Trigger maneuver
        state.boat.heading = state.wind.direction + 0.1;
        state.boat.lastWindSide = -1;
        update(0.1);
        state.boat.heading = state.wind.direction - 0.1;
        update(0.1);
    }""")

    stats_racing = page.evaluate("""() => {
        return {
            dist: state.race.legDistances[0],
            speed: state.race.legTopSpeeds[0],
            moves: state.race.legManeuvers[0]
        }
    }""")

    print(f"Racing Stats: {stats_racing}")

    if stats_racing['dist'] > 0 and stats_racing['speed'] > 0 and stats_racing['moves'] > 0:
        print("PASS: Stats tracked during racing.")
    else:
        print("FAIL: Stats NOT tracked during racing!")

    # Take screenshot of HUD showing 0 stats for Start Leg if possible
    # But since we just modified them to be >0, let's reset and show fresh prestart
    page.reload()
    page.screenshot(path="verification/verification_stats.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        try:
            verify_stats(page)
        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()
