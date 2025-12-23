from playwright.sync_api import sync_playwright
import os

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        filepath = os.path.abspath("regatta/index.html")
        page.goto(f"file://{filepath}")

        page.wait_for_selector("#hud-leg-times")

        # Simulate a completed Start leg and active Leg 1
        page.evaluate("""
            state.race.status = 'racing';
            state.race.leg = 1;
            state.race.startLegDuration = 30.5; // Took 30.5s to cross
            state.race.legTopSpeeds[0] = 12.5;
            state.race.legDistances[0] = 500;

            // Current Leg 1 stats
            state.race.legTopSpeeds[1] = 15.2;
            state.race.legDistances[1] = 1200;
            state.race.legStartTime = state.race.timer - 60; // 1 min into leg

            // Force redraw
            draw();
        """)

        page.screenshot(path="verification/hud_stats_leg1.png")

        browser.close()

if __name__ == "__main__":
    run()
