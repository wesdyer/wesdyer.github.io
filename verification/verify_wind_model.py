import asyncio
from playwright.async_api import async_playwright
import math
import os

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        # Determine absolute path
        cwd = os.getcwd()
        url = f"file://{cwd}/regatta/index.html"
        print(f"Loading {url}")

        await page.goto(url)

        # 1. Check Pre-Race Overlay Labels
        print("Checking Pre-Race Overlay...")
        try:
            wind_var = await page.evaluate("UI.prWindVar.textContent")
            print(f"Wind Conditions Text: {wind_var}")
            # Expected format: "Shifty • Moderate • Active" or similar
            if "•" in wind_var:
                print("SUCCESS: New condition labels detected.")
            else:
                print("WARNING: Condition labels might be old or empty.")
        except Exception as e:
            print(f"Error checking overlay: {e}")

        # 2. Start Race
        print("Starting Race...")
        await page.evaluate("startRace()")

        # 3. Monitor Wind Oscillation
        print("Monitoring Wind Dynamics (5 seconds)...")

        wind_history = []
        for i in range(10):
            await asyncio.sleep(0.5)
            data = await page.evaluate("""() => {
                return {
                    time: state.time,
                    dir: state.wind.direction,
                    speed: state.wind.speed,
                    baseDir: state.wind.baseDirection,
                    baseSpeed: state.wind.baseSpeed,
                    gustCount: state.gusts.length
                }
            }""")
            wind_history.append(data)
            print(f"T={data['time']:.2f} | Dir={data['dir']:.4f} (Base={data['baseDir']:.4f}) | Speed={data['speed']:.2f} (Base={data['baseSpeed']:.2f}) | Gusts={data['gustCount']}")

        # Analysis
        dirs = [d['dir'] for d in wind_history]
        speeds = [d['speed'] for d in wind_history]

        dir_range = max(dirs) - min(dirs)
        speed_range = max(speeds) - min(speeds)

        print(f"Direction Range: {dir_range:.4f} rad")
        print(f"Speed Range: {speed_range:.2f} kn")

        if dir_range > 0 and speed_range > 0:
             print("SUCCESS: Wind is dynamic (varying over time).")
        else:
             print("FAILURE: Wind appears static.")

        # 4. Check Gust Movement
        print("Checking Gust Movement...")
        gust_sample = await page.evaluate("state.gusts.length > 0 ? {x: state.gusts[0].x, y: state.gusts[0].y} : null")

        if gust_sample:
            await asyncio.sleep(1.0)
            gust_sample_later = await page.evaluate("state.gusts.length > 0 ? {x: state.gusts[0].x, y: state.gusts[0].y} : null")

            dx = gust_sample_later['x'] - gust_sample['x']
            dy = gust_sample_later['y'] - gust_sample['y']
            dist = math.sqrt(dx*dx + dy*dy)
            print(f"Gust moved {dist:.2f} units in 1s.")
            if dist > 0:
                 print("SUCCESS: Gusts are moving.")
            else:
                 print("FAILURE: Gusts are stationary.")
        else:
            print("WARNING: No gusts found to track.")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
