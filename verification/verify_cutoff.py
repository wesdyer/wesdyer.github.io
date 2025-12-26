from playwright.sync_api import sync_playwright, expect
import os

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 1280, 'height': 720})
        page = context.new_page()

        # Load the game
        path = os.path.abspath("regatta/index.html")
        page.goto(f"file://{path}")

        # Wait for game to initialize
        page.wait_for_timeout(1000)

        print("Manipulating game state to trigger cutoff...")
        page.evaluate("""
            window.state.race.status = 'racing';
            window.state.race.timer = 601;
            window.state.paused = false;
        """)

        try:
            expect(page.locator("#results-overlay")).to_be_visible(timeout=5000)
            print("Results overlay appeared.")
        except:
            print("Results overlay did not appear.")
            page.evaluate("showResults()")

        page.wait_for_timeout(1000)

        # Take screenshot
        page.screenshot(path="verification/cutoff_results_white.png")

        rows = page.locator(".res-row")
        count = rows.count()

        found_dns = False
        correct_color = True

        for i in range(count):
            row = rows.nth(i)
            time_el = row.locator(".res-time")
            time_text = time_el.text_content()

            if "DNS" in time_text:
                found_dns = True
                # Check class
                # We expect text-white, and NOT text-red-400
                classes = time_el.get_attribute("class")
                print(f"DNS Row Classes: {classes}")

                if "text-white" not in classes:
                    print("FAILURE: text-white class missing!")
                    correct_color = False
                if "text-red-400" in classes:
                    print("FAILURE: text-red-400 class present!")
                    correct_color = False

        if found_dns and correct_color:
            print("VERIFICATION SUCCESSFUL: DNS found with correct white text styling.")
        else:
            print("VERIFICATION FAILED.")

        browser.close()

if __name__ == "__main__":
    run()
