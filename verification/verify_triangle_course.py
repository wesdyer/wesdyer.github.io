import time
from playwright.sync_api import sync_playwright

def verify_triangle_course():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        # Navigate to the game (assuming hosted locally or file path)
        import os
        cwd = os.getcwd()
        page.goto(f"file://{cwd}/regatta/index.html")

        # Wait for game load
        page.wait_for_timeout(2000)

        # Select Triangle Course
        # Click the Triangle button
        page.click('#course-btn-tri')
        page.wait_for_timeout(500)

        # Verify UI updates
        fmt = page.text_content('#course-format')
        legs = page.text_content('#course-legs')

        print(f"Format: {fmt}, Legs: {legs}")
        if fmt != "Triangle" or legs != "3 + Finish":
            print("FAILED: UI did not update to Triangle settings")
            return

        # Start Race
        page.click('#start-race-btn')
        page.wait_for_timeout(1000)

        # Check internal state via evaluation
        course_type = page.evaluate("window.state.race.courseType")
        marks_count = page.evaluate("window.state.course.marks.length")

        print(f"Course Type: {course_type}")
        print(f"Marks Count: {marks_count}")

        if course_type != 'triangle':
            print("FAILED: state.race.courseType is not 'triangle'")

        if marks_count != 7: # 2 Start, 3 Marks, 2 Finish = 7
            print(f"FAILED: Expected 7 marks for Triangle, got {marks_count}")

        # Verify Mark Positions (Geometry)
        marks = page.evaluate("window.state.course.marks")
        m1 = marks[2] # Windward
        m2 = marks[3] # Reach
        m3 = marks[4] # Leeward

        print(f"Mark 1: ({m1['x']}, {m1['y']})")
        print(f"Mark 2: ({m2['x']}, {m2['y']})")
        print(f"Mark 3: ({m3['x']}, {m3['y']})")

        # Capture Screenshot
        page.screenshot(path="verification/triangle_course.png")
        print("Screenshot saved to verification/triangle_course.png")

        # Simulate race progress (Advance time)
        # We can't easily simulate sailing input, but we can fast forward time and check AI targets?
        # Let's check player's next waypoint
        wp = page.evaluate("window.state.boats[0].raceState.nextWaypoint")
        print(f"Player Next Waypoint: Dist {wp['dist']}")

        browser.close()

if __name__ == "__main__":
    verify_triangle_course()
