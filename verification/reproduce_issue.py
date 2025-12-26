
import asyncio
from playwright.async_api import async_playwright
import math

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        # Determine absolute path to index.html
        import os
        repo_root = os.getcwd()
        url = f"file://{repo_root}/regatta/index.html"

        await page.goto(url)

        # Wait for game to initialize
        await page.wait_for_timeout(1000)

        # Helper to get state
        async def get_state():
            return await page.evaluate("() => { return { wind: state.wind, boats: state.boats.map(b => ({x:b.x, y:b.y})), course: state.course }; }")

        state1 = await get_state()
        wd1 = state1['wind']['direction']
        print(f"Initial Wind Direction: {wd1}")

        # Change wind direction via UI
        # Value 2 is East (if N=0). 0=N, 1=NE, 2=E...
        # Let's set to '2' (East) which is PI/2 = 1.57 rad.
        # Trigger input event
        await page.evaluate("""() => {
            const slider = document.getElementById('conf-wind-direction');
            slider.value = 2;
            slider.dispatchEvent(new Event('input'));
        }""")

        await page.wait_for_timeout(500)

        state2 = await get_state()
        wd2 = state2['wind']['direction']
        print(f"New Wind Direction: {wd2}")

        # Check if boats moved
        boats1 = state1['boats']
        boats2 = state2['boats']

        moved = False
        for i in range(len(boats1)):
            dx = boats1[i]['x'] - boats2[i]['x']
            dy = boats1[i]['y'] - boats2[i]['y']
            if abs(dx) > 1 or abs(dy) > 1:
                moved = True
                break

        if not moved:
            print("FAILURE: Boats did not move after changing wind direction.")
            # Check if they are in valid position relative to NEW wind
            # New Wind is East (PI/2). From East. Blowing West.
            # Start line should be N-S.
            # Boats should be West of the line (Downwind).

            # Marks
            marks = state2['course']['marks']
            m0 = marks[0]
            m1 = marks[1]
            cx = (m0['x'] + m1['x']) / 2
            cy = (m0['y'] + m1['y']) / 2

            # Wind From East (PI/2). ux=1, uy=0.
            # Upwind is East. Downwind is West (-1, 0).
            # Boats should be roughly x < cx.

            b0 = boats2[0]
            print(f"Boat 0 pos: ({b0['x']:.2f}, {b0['y']:.2f})")
            print(f"Start Center: ({cx:.2f}, {cy:.2f})")

            dx = b0['x'] - cx
            dy = b0['y'] - cy
            print(f"Vector from center: ({dx:.2f}, {dy:.2f})")

            # Calculate alignment with Downwind Vector
            # If wind is PI/2 (90 deg), Downwind is 270 deg (West).
            # We expect dx to be negative.

        else:
            print("SUCCESS: Boats moved.")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
