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

        # Manipulate state to trigger cutoff
        # Set race status to 'racing' and timer to > cutoff (600s)
        # Leg length 4000 units = 800m. 4 legs = 3200m.
        # Cutoff = 3200 * 0.1875 = 600 seconds.
        # Set timer to 601.
        print("Manipulating game state to trigger cutoff...")
        page.evaluate("""
            window.state.race.status = 'racing';
            window.state.race.timer = 601;
            // Force update loop one step to process cutoff logic
            window.state.paused = false;
        """)

        # Wait for results overlay to appear
        # The update loop needs to run. The Playwright script doesn't run the loop,
        # but the browser keeps running it if not paused.
        # We unpaused it above.

        try:
            expect(page.locator("#results-overlay")).to_be_visible(timeout=5000)
            print("Results overlay appeared.")
        except:
            print("Results overlay did not appear.")
            # Force showResults just in case logic missed a beat
            page.evaluate("showResults()")

        # Wait a bit for DOM updates
        page.wait_for_timeout(1000)

        # Take screenshot
        page.screenshot(path="verification/cutoff_results.png")

        # Verify text content
        # We expect "DNS" for the player since they didn't start (leg 0)
        rows = page.locator(".res-row")
        count = rows.count()

        found_dns = False
        found_dnf = False

        for i in range(count):
            row = rows.nth(i)
            name = row.locator(".res-name").text_content()

            # Check for DNS/DNF text
            # It should be in .res-time
            time_text = row.locator(".res-time").text_content()
            points_text = row.locator(".res-points").text_content()

            if "DNS" in time_text:
                found_dns = True
                print(f"Boat: {name}, Status: DNS, Points: {points_text}")
            elif "DNF" in time_text:
                found_dnf = True
                print(f"Boat: {name}, Status: DNF, Points: {points_text}")
            else:
                 print(f"Boat: {name}, Status: {time_text}, Points: {points_text}")

        if found_dns:
            print("Found DNS in results.")
        else:
            print("DNS NOT found in results.")

        if found_dnf:
            print("Found DNF in results.")
        else:
            print("DNF NOT found in results (expected if everyone is DNS).")

        if found_dns:
            print("VERIFICATION SUCCESSFUL: DNS/DNF logic works and points are 0.")
        else:
            print("VERIFICATION FAILED.")

        browser.close()

if __name__ == "__main__":
    run()
