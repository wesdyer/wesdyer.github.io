from playwright.sync_api import sync_playwright, Page
import os

# Define absolute path to the HTML file
html_file_path = "file:///app/regatta/index.html"

def verify_results_screen(page: Page):
    # Navigate to the page
    page.goto(html_file_path)

    # Wait for the game to load (canvas element)
    page.wait_for_selector("#gameCanvas")

    # Inject code to mock the race state and show results
    # We populate state.boats with dummy data and call showResults()
    # We also need to make sure images load, but since they are local, they might be fast.
    # The dummy data uses names that match assets/images/*.png

    setup_script = """
    () => {
        // Pause the game loop to prevent interference
        state.paused = true;

        // Mock Boats
        state.boats = [
            new Boat(0, true, 0, 0, "Player"),
            new Boat(1, false, 0, 0, "Bixby"),
            new Boat(2, false, 0, 0, "Skim"),
            new Boat(3, false, 0, 0, "Wobble")
        ];

        // Configure boats as finished
        state.boats[0].raceState.finished = true;
        state.boats[0].raceState.finishTime = 300.0;
        state.boats[0].lbRank = 0;

        state.boats[1].raceState.finished = true;
        state.boats[1].raceState.finishTime = 305.5;
        state.boats[1].lbRank = 1;
        state.boats[1].colors = { hull: '#0046ff', spinnaker: '#FFD400' }; // Bixby

        state.boats[2].raceState.finished = true;
        state.boats[2].raceState.finishTime = 310.2;
        state.boats[2].lbRank = 2;
        state.boats[2].colors = { hull: '#8FD3FF', spinnaker: '#FF2D95' }; // Skim

        state.boats[3].raceState.finished = false; // DNF
        state.boats[3].raceState.resultStatus = 'DNF';
        state.boats[3].lbRank = 3;
        state.boats[3].colors = { hull: '#FF8C1A', spinnaker: '#00E5FF' }; // Wobble

        // Force show results
        showResults();
    }
    """

    page.evaluate(setup_script)

    # Wait for results overlay to be visible
    page.wait_for_selector("#results-overlay:not(.hidden)")

    # Wait a moment for layout/images
    page.wait_for_timeout(1000)

    # Take screenshot of the results overlay
    # We locate the results list container to focus on the rows
    results_list = page.locator("#results-overlay")
    results_list.screenshot(path="/app/verification/results_screen.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Grant permissions if needed, though file:// usually works
        context = browser.new_context()
        page = context.new_page()
        try:
            verify_results_screen(page)
            print("Verification screenshot captured at /app/verification/results_screen.png")
        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()
