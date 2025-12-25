from playwright.sync_api import sync_playwright
import time
import math

def verify_stability():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto("http://localhost:8000/regatta/index.html")

        # Start Race - Target the specific button ID to avoid ambiguity
        page.locator("#start-race-btn").click()

        # Wait for game loop to run a bit
        time.sleep(1)

        # Collect state samples
        samples = []
        for _ in range(20):
            # Sample every 50ms
            data = page.evaluate("""() => {
                return {
                    windDir: state.wind.direction,
                    windSpeed: state.wind.speed,
                    laylineWindDir: state.layline ? state.layline.windDir : null,
                    laylineUp: state.layline ? state.layline.upwindTWA : null,
                    laylineDown: state.layline ? state.layline.downwindTWA : null
                }
            }""")
            samples.append(data)
            time.sleep(0.05)

        browser.close()

        # Analyze samples
        wind_dirs = [s['windDir'] for s in samples]

        # Check if wind direction is smooth (no high freq jitter)
        # Calculate differences between consecutive frames
        diffs = []
        for i in range(1, len(wind_dirs)):
            diffs.append(abs(wind_dirs[i] - wind_dirs[i-1]))

        max_diff = max(diffs) if diffs else 0
        avg_diff = sum(diffs) / len(diffs) if diffs else 0

        print(f"Max Wind Dir Change per 50ms: {max_diff:.6f} rad")
        print(f"Avg Wind Dir Change per 50ms: {avg_diff:.6f} rad")

        # Ensure layline state exists
        if samples[0]['laylineWindDir'] is None:
            print("FAIL: state.layline is undefined")
        else:
            print("PASS: state.layline exists")
            print(f"Layline Upwind TWA: {samples[0]['laylineUp']:.4f}")
            print(f"Layline Downwind TWA: {samples[0]['laylineDown']:.4f}")

if __name__ == "__main__":
    verify_stability()
