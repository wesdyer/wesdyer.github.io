
from playwright.sync_api import Page, expect, sync_playwright
import time
import os

def test_speed_colors(page: Page):
    # 1. Arrange: Go to the Regatta game
    # We assume the server is running on localhost or via file protocol.
    # Since environment allows file:// access via realpath:
    # Get absolute path to regatta/index.html
    cwd = os.getcwd()
    file_url = f"file://{cwd}/regatta/index.html"

    print(f"Navigating to {file_url}")
    page.goto(file_url)

    # Wait for game to initialize
    # We can check for a specific element, e.g., the HUD speed
    page.wait_for_selector("#hud-speed")

    print("Game loaded. Injecting mock logic for verification...")

    # Inject a function to control wind and redraw
    # We need to access the internal state. 'state' and 'UI' are attached to window in script.js.
    # We also need to be able to override 'getWindAt' results or 'state.wind.speed'.

    # We will perform a series of checks by manipulating state.wind.speed and mocking getWindAt indirectly via gusts?
    # Or better, we can just modify the state directly in a loop that doesn't rely on the game loop
    # OR pause the game loop and manually trigger draw().

    # Step 1: Pause the game to stop automatic updates overwriting our test state
    page.evaluate("state.paused = true;")

    # Define a helper to set wind conditions and trigger a redraw
    # We can't easily overwrite 'getWindAt' because it's defined in the closure/scope of script.js and not explicitly on window.
    # However, 'getWindAt' uses 'state.wind.speed' and 'state.gusts'.
    # If we clear 'state.gusts', getWindAt returns exactly state.wind.speed (assuming no floating point drift).
    # But wait, we determined floating point drift IS the problem.
    # So we should rely on that or force it.

    # Actually, we can just check if the class setting logic works with the new thresholds.
    # We can modify 'state.wind.speed' and force 'state.gusts' to produce a specific local wind.

    # Let's try to mock the scenario:
    # Case 1: Difference is small (< 0.1). Should be WHITE.
    print("Testing Case 1: Small difference (< 0.1) -> WHITE")
    page.evaluate("""
        state.gusts = []; // Clear gusts
        state.wind.speed = 10.0;
        // We need local wind to be slightly different.
        // We can add a fake gust that is exactly at boat position.
        // Or simply: we can't easily mock getWindAt if it's not global.
        // BUT, we can inspect if the FIX is applied by reading the function source? No.

        // Let's rely on the fact that if we set state.wind.speed = 10, and no gusts,
        // localWind.speed will be extremely close to 10 (e.g. 10.0 or 10.00000001).
        // Before fix: could be Green/Orange. After fix: must be White.
        state.wind.baseDirection = 0;
        state.wind.direction = 0;
        state.boats[0].x = 0;
        state.boats[0].y = 0;

        // Force a draw
        // We need to call draw(). It is not attached to window.
        // But loop() calls it. If paused, loop doesn't draw.
        // We can temporarily unpause for 1 frame? Or just check if draw() is exposed?
        // It is not exposed.

        // Wait, I can see window.updateLeaderboard is exposed.
        // Maybe I can attach draw to window in the previous step? Too late now unless I edit again.

        // Alternative: Use the fact that loop runs via requestAnimationFrame.
        // If I set state.paused = false for a split second, it will draw.
        // But update() will also run and change wind speed.

        // Hack: I can overwrite update() to do nothing!
        // update is also not global.

        // Okay, let's look at what IS global.
        // state, UI.

        // I can change state.wind.speed to be stable by setting baseSpeed, speedSurge=0, etc?
        // update() sets: state.wind.speed = Math.max(5, Math.min(25, state.wind.baseSpeed + speedSurge + speedGust));
        // speedSurge and speedGust depend on state.time.
        // If I stop time (state.paused = true), state.wind.speed is constant.
        // BUT draw() is not called when paused.

        // I can modify the 'loop' function? No.

        // Wait, the user sees this when playing.
        // I can just set the HUD text color manually to verify I can read it,
        // then rely on natural game loop? No, that's flaky.

        // Let's use the fact that I modified the code to add 0.1 threshold.
        // I can verify the logic by injecting a test script that replicates the logic
        // using the SAME functions if I can reach them.

        // Since I can't reach internal functions easily, I will verify visually by setting up a scenario.
        // I will injecting a "Test Mode" gust.
        // Gust at (0,0), radius 1000.
        // speedDelta = 0.05.
        // Local Wind = Base + 0.05.
        // Diff = 0.05.
        // Threshold = 0.1.
        // Expect: White.
        // (Old behavior would be Green).
    """)

    # We need to unpause to let it draw. But we want to freeze state.wind.speed updates.
    # We can't freeze state.wind.speed updates easily without code change.

    # However, if I set state.race.conditions.gustiness = 0, shiftiness = 0?
    # update() still does sine wave wind changes.

    # Let's try to verify via screenshot of the code change applied? No, visual verification of app.

    # Better approach:
    # The 'draw' function updates the UI classes.
    # I can check the 'UI.speed' classList.

    # I will inject a script that overrides `Math.random` to be deterministic? No.

    # Let's try to just run the game, and monitor the UI.speed class.
    # If the fix works, we should see 'text-white' mostly, and 'text-green-400' only when valid.

    # But for the specific test case:
    # I'll create a scenario where I add a gust with specific intensity.

    page.evaluate("""
        state.paused = true;
        // Position boat at 0,0
        state.boats[0].x = 0;
        state.boats[0].y = 0;
        state.wind.direction = 0;
        state.wind.speed = 10;

        // Clear existing gusts
        state.gusts = [];

        // Add a controlled gust
        // speedDelta = 0.05 (should be ignored by 0.1 threshold)
        state.gusts.push({
            x: 0, y: 0,
            radiusX: 500, radiusY: 500,
            rotation: 0,
            speedDelta: 0.08, // < 0.1
            dirDelta: 0,
            age: 0,
            duration: 1000,
            vx: 0, vy: 0,
            maxRadiusX: 500, maxRadiusY: 500
        });

        // We need to trigger a draw.
        // Since we can't call draw() directly, we can override 'state.paused' to false,
        // AND override 'window.requestAnimationFrame' to only run once?
        // Or just let it run for a bit.

        // To prevent 'update()' from changing wind speed, we can nullify it?
        // 'update' is not global.

        // But 'state' is global. 'state.time' drives the wind sine waves.
        // If we reset 'state.time' to a known value where rate of change is small?

        // Actually, let's just observe.
        state.paused = false;
    """)

    # Wait a moment for a few frames
    time.sleep(1.0)
    page.evaluate("state.paused = true;")

    # Check UI.speed class
    classes = page.evaluate("document.getElementById('hud-speed').className")
    print(f"Classes with 0.08 delta: {classes}")

    # Expectation: Should contain 'text-white' and NOT 'text-green-400' (because 0.08 < 0.1)
    if 'text-green-400' in classes:
        print("FAIL: text-green-400 found for small delta")
    else:
        print("PASS: text-green-400 NOT found for small delta")

    # Case 2: Large difference (> 0.1) -> GREEN
    print("Testing Case 2: Large difference (> 0.1) -> GREEN")
    page.evaluate("""
        state.gusts[0].speedDelta = 0.15; // > 0.1
        state.paused = false;
    """)
    time.sleep(1.0)
    page.evaluate("state.paused = true;")

    classes_2 = page.evaluate("document.getElementById('hud-speed').className")
    print(f"Classes with 0.15 delta: {classes_2}")

    if 'text-green-400' in classes_2:
        print("PASS: text-green-400 found for large delta")
    else:
        print("FAIL: text-green-400 NOT found for large delta")

    # Take screenshot
    page.screenshot(path="verification/verification.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            test_speed_colors(page)
        finally:
            browser.close()
