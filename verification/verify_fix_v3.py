
from playwright.sync_api import Page, expect, sync_playwright
import time
import os

def test_speed_colors_v3(page: Page):
    cwd = os.getcwd()
    file_url = f"file://{cwd}/regatta/index.html"
    page.goto(file_url)
    page.wait_for_selector("#hud-speed")

    # Override for deterministic state
    page.evaluate("""
        state.paused = true;
        state.boats[0].x = 0;
        state.boats[0].y = 0;
        state.wind.direction = 0;
        state.wind.speed = 10;

        // Scenario 2: Large Lull (Loss > 0.1)
        // Should color WIND SPEED Red, and BOAT SPEED White.
        state.gusts = [];
        state.gusts.push({
            x: 0, y: 0,
            radiusX: 500, radiusY: 500,
            rotation: 0,
            speedDelta: -0.15, // Loss > 0.1 (Value < -0.1)
            dirDelta: 0,
            age: 100, // Age must be < duration, and lifeFade must be > 0.
            // lifeFade = min(age/5, 1) * min((duration-age)/5, 1).
            // 100/5 = 20 (clamped to 1). (1000-100)/5 = 180 (clamped to 1).
            // So Intensity = 1.0.
            duration: 1000,
            vx: 0, vy: 0,
            maxRadiusX: 500, maxRadiusY: 500
        });

        // Force update? No, we will just unpause for a moment or rely on state injection being enough
        // IF we call draw manually? No we can't.
        // Unpause briefly.
        state.paused = false;
    """)
    time.sleep(1.0)
    page.evaluate("state.paused = true;")

    # Check Player HUD
    speed_classes = page.evaluate("document.getElementById('hud-speed').className")
    wind_classes = page.evaluate("document.getElementById('hud-wind-speed').className")

    print(f"HUD Speed Classes (Should have white, NO red): {speed_classes}")
    print(f"HUD Wind Speed Classes (Should have red): {wind_classes}")

    if 'text-red-400' in speed_classes:
        # Note: Penalty triggers red too, but we haven't triggered penalty.
        print("FAIL: Boat Speed became Red (Should be White)")
    elif 'text-white' in speed_classes:
        print("PASS: Boat Speed is White")

    if 'text-red-400' in wind_classes:
        print("PASS: Wind Speed is Red")
    else:
        print("FAIL: Wind Speed is NOT Red (Should be)")

    page.screenshot(path="verification/verification_v3.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            test_speed_colors_v3(page)
        finally:
            browser.close()
