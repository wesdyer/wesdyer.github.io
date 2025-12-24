
import asyncio
import math
from playwright.async_api import async_playwright
import os

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        # Get absolute path to regatta/index.html
        cwd = os.getcwd()
        url = f"file://{cwd}/regatta/index.html"

        print(f"Navigating to {url}")
        await page.goto(url)

        # Wait for gusts to spawn
        print("Waiting for gusts...")
        await page.wait_for_function("() => window.state && window.state.gusts && window.state.gusts.length > 0")

        # Get wind direction and gust rotation
        data = await page.evaluate("""() => {
            const windDir = window.state.wind.direction;
            const gusts = window.state.gusts;
            // Filter out gusts that might have wrapped around or something, though default ones are fresh
            const rotations = gusts.map(g => g.rotation);
            return { windDir, rotations };
        }""")

        wind_dir = data['windDir']
        rotations = data['rotations']

        print(f"Wind Direction: {wind_dir}")
        print(f"Gust Rotations: {rotations}")

        # Check alignment
        # Current behavior: rotation == windDir
        # Desired behavior: rotation == windDir + PI/2

        for rot in rotations:
            diff = abs(rot - wind_dir)
            # Normalize diff to -PI..PI
            while diff > math.pi: diff -= 2*math.pi
            while diff < -math.pi: diff += 2*math.pi

            print(f"Diff: {diff}")

            if abs(diff) < 0.001:
                print("Gust is currently aligned with wind direction value (Perpendicular visual)")
            elif abs(abs(diff) - math.pi/2) < 0.001:
                print("Gust is rotated 90 degrees relative to wind direction value (Parallel visual)")
            else:
                print(f"Gust has some other alignment: {diff}")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
