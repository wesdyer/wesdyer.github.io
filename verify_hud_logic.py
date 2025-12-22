import re
import math
from playwright.sync_api import sync_playwright

def get_rotation(page, selector):
    transform = page.evaluate(f"document.querySelector('{selector}').style.transform")
    # format: rotate(1.23rad)
    if not transform:
        return 0.0
    match = re.search(r"rotate\(([\d\.-]+)rad\)", transform)
    if match:
        return float(match.group(1))
    return 0.0

def verify_hud():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.goto("file:///app/regatta/index.html")
        page.wait_for_timeout(500)

        # STOP the update loop from changing values
        page.evaluate("window.update = function() {}")

        # Set values:
        heading_val = 1.0
        wind_val = 2.0

        print(f"Setting Heading={heading_val}, Wind={wind_val}")
        page.evaluate(f"state.boat.heading = {heading_val}")
        page.evaluate(f"state.wind.direction = {wind_val}")

        # --- Mode: Heading ---
        print("\nTesting Mode: HEADING")
        page.evaluate("state.camera.mode = 'heading'")
        page.evaluate(f"state.camera.rotation = {heading_val}")

        # Call draw to update UI
        page.evaluate("draw();")

        # Checks
        compass_rot = get_rotation(page, "#hud-compass-rose")
        expected_compass = -heading_val

        heading_arrow_rot = get_rotation(page, "#hud-heading-arrow")
        expected_heading_arrow = 0.0

        wind_arrow_inner_rot = get_rotation(page, "#hud-wind-arrow")
        expected_wind_inner = wind_val

        print(f"Compass: Got {compass_rot:.4f}, Expected {expected_compass:.4f}")
        print(f"Heading Arrow: Got {heading_arrow_rot:.4f}, Expected {expected_heading_arrow:.4f}")
        print(f"Wind Arrow Inner: Got {wind_arrow_inner_rot:.4f}, Expected {expected_wind_inner:.4f}")

        assert abs(compass_rot - expected_compass) < 0.01, "Compass Rot Mismatch in Heading Mode"
        assert abs(heading_arrow_rot - expected_heading_arrow) < 0.01, "Heading Arrow Mismatch in Heading Mode"
        assert abs(wind_arrow_inner_rot - expected_wind_inner) < 0.01, "Wind Arrow Mismatch in Heading Mode"

        # --- Mode: North ---
        print("\nTesting Mode: NORTH")
        page.evaluate("state.camera.mode = 'north'")
        page.evaluate("state.camera.rotation = 0")
        page.evaluate("draw();")

        compass_rot = get_rotation(page, "#hud-compass-rose")
        expected_compass = 0.0

        heading_arrow_rot = get_rotation(page, "#hud-heading-arrow")
        expected_heading_arrow = heading_val

        print(f"Compass: Got {compass_rot:.4f}, Expected {expected_compass:.4f}")
        print(f"Heading Arrow: Got {heading_arrow_rot:.4f}, Expected {expected_heading_arrow:.4f}")

        assert abs(compass_rot - expected_compass) < 0.01, "Compass Rot Mismatch in North Mode"
        assert abs(heading_arrow_rot - expected_heading_arrow) < 0.01, "Heading Arrow Mismatch in North Mode"

        # --- Mode: Wind ---
        print("\nTesting Mode: WIND")
        page.evaluate("state.camera.mode = 'wind'")
        page.evaluate(f"state.camera.rotation = {wind_val}")
        page.evaluate("draw();")

        compass_rot = get_rotation(page, "#hud-compass-rose")
        expected_compass = -wind_val

        heading_arrow_rot = get_rotation(page, "#hud-heading-arrow")
        expected_heading_arrow = heading_val - wind_val

        wind_arrow_inner_rot = get_rotation(page, "#hud-wind-arrow")
        total_wind_visual = compass_rot + wind_arrow_inner_rot

        print(f"Compass: Got {compass_rot:.4f}, Expected {expected_compass:.4f}")
        print(f"Heading Arrow: Got {heading_arrow_rot:.4f}, Expected {expected_heading_arrow:.4f}")
        print(f"Total Wind Visual: {total_wind_visual:.4f}, Expected 0.0")

        assert abs(compass_rot - expected_compass) < 0.01, "Compass Rot Mismatch in Wind Mode"
        assert abs(heading_arrow_rot - expected_heading_arrow) < 0.01, "Heading Arrow Mismatch in Wind Mode"
        assert abs(total_wind_visual) < 0.01, "Wind Arrow Visual Mismatch in Wind Mode"

        print("\nAll HUD Tests Passed!")
        browser.close()

if __name__ == "__main__":
    verify_hud()
