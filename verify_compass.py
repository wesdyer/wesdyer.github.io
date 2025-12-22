import re
from playwright.sync_api import sync_playwright
import time
import math

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        # Use absolute path
        page.goto("file:///app/regatta/index.html")

        # Helper to get rotation
        def get_rotation(selector):
            transform = page.evaluate(f"document.querySelector('{selector}').style.transform")
            # transform format: "rotate(Xrad)" or "rotate(Xdeg)" or matrix
            # script.js sets it as `rotate(${val}rad)`
            if not transform:
                return 0.0
            match = re.search(r"rotate\(([\d\.-]+)rad\)", transform)
            if match:
                return float(match.group(1))
            return transform

        # Initial state
        compass_rot = get_rotation("#hud-compass-rose")
        wind_rot = get_rotation("#hud-wind-arrow")
        print(f"Initial Compass Rotation: {compass_rot}")
        print(f"Initial Wind Arrow Rotation: {wind_rot}")

        # Turn the boat
        print("Turning boat...")
        page.keyboard.down("ArrowRight")
        # wait a bit for turn to happen (update loop needs to run)
        time.sleep(1)
        page.keyboard.up("ArrowRight")

        # Check again
        new_compass_rot = get_rotation("#hud-compass-rose")
        new_wind_rot = get_rotation("#hud-wind-arrow")
        print(f"New Compass Rotation: {new_compass_rot}")
        print(f"New Wind Arrow Rotation: {new_wind_rot}")

        if new_compass_rot == compass_rot:
            print("FAIL: Compass rotation did not change.")
        else:
            print("SUCCESS: Compass rotation changed.")

        browser.close()

if __name__ == "__main__":
    run()
