from playwright.sync_api import sync_playwright
import time
import os

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()

    cwd = os.getcwd()
    page.goto(f"file://{cwd}/regatta/index.html")

    # Setup 3-leg race and warp to finish
    page.evaluate("""
        state.race.totalLegs = 3;
        state.race.legLength = 2000;
        initCourse();
        startRace();
        state.race.status = 'racing';
        state.race.timer = 100;

        const player = state.boats[0];
        player.raceState.leg = 3;
        player.raceState.startTimeDisplay = 100;
        player.raceState.legStartTime = 100;

        // Target Finish Gate (Indices 2, 3 for Odd legs)
        const m1 = state.course.marks[2];
        const m2 = state.course.marks[3];
        const cx = (m1.x + m2.x) / 2;
        const cy = (m1.y + m2.y) / 2;

        player.x = cx;
        player.y = cy + 100;
        player.heading = 0;
        player.speed = 5.0;

        // Hide Results Overlay to see the line
        // We override showResults to do nothing or hide it immediately
        const origShowResults = showResults;
        showResults = function() {
            origShowResults();
            if(UI.resultsOverlay) UI.resultsOverlay.classList.add('hidden');
        };
    """)

    # Run loop to trigger finish logic
    for _ in range(30):
        page.evaluate("update(0.1); draw();")

    # Verify finish state
    indices = page.evaluate("""
        (() => {
            const player = state.boats[0];
            // Access the variable via a temporary modified draw function or just infer from logic?
            // Let's just check the logic expression directly again to confirm context
            if (state.race.status === 'finished' || player.raceState.finished) {
                return (state.race.totalLegs % 2 === 0) ? [0, 1] : [2, 3];
            }
            return null;
        })()
    """)
    print(f"Logic Indices: {indices}")

    # Force camera to look at the upwind gate (Marks 2,3) to verify visual presence of Finish Line
    page.evaluate("""
        const m1 = state.course.marks[2];
        const m2 = state.course.marks[3];
        state.camera.x = (m1.x + m2.x) / 2;
        state.camera.y = (m1.y + m2.y) / 2;
        state.camera.target = 'manual'; // Stop auto-tracking
        draw();
    """)

    page.screenshot(path="verification/finish_line_odd_legs.png")
    browser.close()

with sync_playwright() as playwright:
    run(playwright)
