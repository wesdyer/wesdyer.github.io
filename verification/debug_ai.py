
import asyncio
from playwright.async_api import async_playwright
import os
import math

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        file_path = os.path.abspath("regatta/index.html")
        await page.goto(f"file://{file_path}")

        # Inject detailed test
        result = await page.evaluate("""
            (() => {
                state.paused = true;
                state.boats = [];
                // Create boat at (-300, -4200)
                let b = new Boat(1, false, -300, -4200, "TestBot");
                state.boats.push(b);
                b.raceState.leg = 1;
                b.raceState.isRounding = true;

                state.wind.baseDirection = 0;
                state.wind.direction = 0;
                initCourse();

                // Debug Marks
                const marks = state.course.marks;
                const m2 = marks[2]; // (-275, -4000)
                const m3 = marks[3]; // (275, -4000)

                // Run Update
                updateAI(b, 0.1);

                // Recalculate Expected values for New Logic
                // indices [2, 3]
                // Dist to m2: (-275 - -300)^2 + (-4000 - -4200)^2 = 25^2 + 200^2 = 625 + 40000 = 40625.
                // Dist to m3: (275 - -300)^2 + ... = 575^2 + 200^2.
                // TargetMark = m2.
                // Center = (0, -4000).
                // vx = -275 - 0 = -275. vy = 0.
                // TargetX = -275 + -275 = -550. TargetY = -4000.
                // dx = -550 - -300 = -250.
                // dy = -4000 - -4200 = 200.
                // angle = atan2(-250, -200).

                return {
                    boatX: b.x,
                    boatY: b.y,
                    isRounding: b.raceState.isRounding,
                    targetHeading: b.ai.targetHeading,
                    m2x: m2.x,
                    m2y: m2.y,
                    calcAngle: Math.atan2(-250, -200)
                };
            })()
        """)

        print(f"Boat: ({result['boatX']}, {result['boatY']})")
        print(f"IsRounding: {result['isRounding']}")
        print(f"Target Heading: {result['targetHeading']}")
        print(f"Calc Angle (New Logic): {result['calcAngle']}")

        th = result['targetHeading']
        calc = result['calcAngle']
        diff = abs(th - calc)
        # Normalize diff
        while diff > math.pi: diff -= 2*math.pi
        while diff < -math.pi: diff += 2*math.pi

        print(f"Difference: {diff}")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
