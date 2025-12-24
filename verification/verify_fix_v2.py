
from playwright.sync_api import Page, expect, sync_playwright
import time
import os

def test_speed_colors_v2(page: Page):
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

        // Scenario 1: Large Gust (Difference > 0.1)
        // Should color WIND SPEED Green, but BOAT SPEED White.
        state.gusts = [];
        state.gusts.push({
            x: 0, y: 0,
            radiusX: 500, radiusY: 500,
            rotation: 0,
            speedDelta: 0.15, // > 0.1
            dirDelta: 0,
            age: 0,
            duration: 1000,
            vx: 0, vy: 0,
            maxRadiusX: 500, maxRadiusY: 500
        });
        state.paused = false;
    """)
    time.sleep(1.0)
    page.evaluate("state.paused = true;")

    # Check Player HUD
    # #hud-speed: Should be white (or lack color classes)
    speed_classes = page.evaluate("document.getElementById('hud-speed').className")
    # #hud-wind-speed: Should be Green
    wind_classes = page.evaluate("document.getElementById('hud-wind-speed').className")

    print(f"HUD Speed Classes (Should have white, NO green): {speed_classes}")
    print(f"HUD Wind Speed Classes (Should have green): {wind_classes}")

    if 'text-green-400' in speed_classes:
        print("FAIL: Boat Speed became Green (Should be White)")
    elif 'text-white' in speed_classes:
        print("PASS: Boat Speed is White")

    if 'text-green-400' in wind_classes:
        print("PASS: Wind Speed is Green")
    else:
        print("FAIL: Wind Speed is NOT Green (Should be)")

    # Verify Competitor Indicator (Draw call writes canvas, hard to verify classes)
    # But code analysis shows we removed the logic.

    page.screenshot(path="verification/verification_v2.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            test_speed_colors_v2(page)
        finally:
            browser.close()
