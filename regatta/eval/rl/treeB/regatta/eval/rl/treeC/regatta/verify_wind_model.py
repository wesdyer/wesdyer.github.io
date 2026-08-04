
import sys
import os
import json
import time

# Add repo root to path to verify if needed (though not using local modules much)
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from playwright.sync_api import sync_playwright

def verify_wind_model():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Load the game
        file_path = os.path.abspath('regatta/index.html')
        page.goto(f'file://{file_path}')

        # Wait for game to init
        page.wait_for_timeout(1000)

        # Get conditions
        conditions = page.evaluate("window.state.race.conditions")
        print(f"Race Conditions: {json.dumps(conditions, indent=2)}")

        # Start Race (to trigger loop properly if needed, though loop runs in waiting)
        # Verify Wind Updates over time
        print("Sampling global wind over 5 seconds...")
        samples = []
        for i in range(10):
            w = page.evaluate("window.state.wind")
            samples.append(w)
            page.wait_for_timeout(500)

        print("Wind Samples:")
        for s in samples:
            print(f"T={s.get('time', '?')} Speed={s['speed']:.2f} Dir={s['direction']:.4f}")

        # Verify Gusts
        gusts = page.evaluate("window.state.gusts")
        print(f"Active Gusts: {len(gusts)}")
        if len(gusts) > 0:
            print(f"Sample Gust 0: {gusts[0]}")

        # Verify Local Wind Calculation
        # Pick a point near a gust if possible, or just random
        local_wind = page.evaluate("getWindAt(0,0)")
        print(f"Local Wind at 0,0: Speed={local_wind['speed']:.2f} Dir={local_wind['direction']:.4f}")

        # Check UI Text
        ui_text = page.evaluate("document.getElementById('pr-wind-var').textContent")
        print(f"UI Description: {ui_text}")

        browser.close()

if __name__ == "__main__":
    verify_wind_model()
