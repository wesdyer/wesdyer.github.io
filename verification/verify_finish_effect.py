from playwright.sync_api import sync_playwright
import time
import os

def run():
    print("Starting verification...")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        cwd = os.getcwd()
        url = f"file://{cwd}/regatta/index.html"
        print(f"Navigating to {url}")
        page.goto(url)
        time.sleep(2)

        print("Injecting state...")
        page.evaluate("""
            state.boat.x = 0;
            state.boat.y = 150;
            state.camera.x = 0;
            state.camera.y = 0;
            state.camera.target = 'none';
            state.wind.direction = 0;

            state.course.marks[0].x = -200;
            state.course.marks[0].y = 0;
            state.course.marks[1].x = 200;
            state.course.marks[1].y = 0;

            state.race.status = 'finished';
            state.race.leg = 5;

            if (window.confetti) {
                console.log("Firing confetti");
                window.confetti({
                    particleCount: 500,
                    spread: 160,
                    origin: { y: 0.6 },
                    zIndex: 9999
                });
            } else {
                console.error("Confetti not found");
            }
        """)

        time.sleep(0.3)

        output_path = "verification/finish_line_green_confetti.png"
        page.screenshot(path=output_path)
        print(f"Screenshot saved to {output_path}")
        browser.close()

if __name__ == "__main__":
    run()
