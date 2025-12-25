from playwright.sync_api import sync_playwright, expect
import time
import os

def verify_results():
    with sync_playwright() as p:
        # Use a mobile-like viewport or desktop
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 800})

        # Determine absolute path to index.html
        cwd = os.getcwd()
        url = f"file://{cwd}/regatta/index.html"
        page.goto(url)

        # Inject state to force results overlay
        page.evaluate("""
            const state = window.state;
            const UI = window.UI;
            const settings = { hullColor: '#f1f5f9', spinnakerColor: '#ef4444' }; // default

            // Mock boats
            state.boats = [
                {
                    id: 0,
                    isPlayer: true,
                    name: "Player",
                    colors: { hull: '#000000', spinnaker: '#ffff00' }, // Dark hull, light spin
                    raceState: {
                        finished: true,
                        finishTime: 124.5,
                        legTopSpeeds: [12.5, 15.2],
                        legDistances: [500, 1500],
                        legSpeedSums: [1000, 3000],
                        totalPenalties: 0
                    },
                    speed: 0
                },
                {
                    id: 1,
                    isPlayer: false,
                    name: "Bixby",  // Real Name
                    colors: { hull: '#0046ff', spinnaker: '#FFD400' }, // Blue
                    raceState: {
                        finished: true,
                        finishTime: 126.2,
                        legTopSpeeds: [11.5, 14.8],
                        legDistances: [500, 1500],
                        legSpeedSums: [900, 2800],
                        totalPenalties: 1
                    },
                    speed: 0
                },
                {
                    id: 2,
                    isPlayer: false,
                    name: "Bruce", // Real Name
                    colors: { hull: '#121212', spinnaker: '#ff0606' }, // Dark hull
                    raceState: {
                        finished: true,
                        finishTime: 130.0,
                        legTopSpeeds: [13.0, 16.0],
                        legDistances: [500, 1500],
                        legSpeedSums: [950, 2900],
                        totalPenalties: 0
                    },
                    speed: 0
                },
                {
                    id: 3,
                    isPlayer: false,
                    name: "Skim", // Real Name
                    colors: { hull: '#8FD3FF', spinnaker: '#FF2D95' }, // Light Blue
                    raceState: {
                        finished: false,
                        finishTime: 0,
                        legTopSpeeds: [12.0, 15.0],
                        legDistances: [400, 1200],
                        legSpeedSums: [800, 2400],
                        totalPenalties: 0
                    },
                    speed: 5
                }
            ];

            state.race.timer = 140.0;
            state.race.status = 'finished';

            // Force show results
            window.showResults = (window.showResults || (() => {})); // Ensure exists
            const overlay = document.getElementById('results-overlay');
            overlay.classList.remove('hidden');

            // Call render
            // Since showResults is internal in script.js scope but updateLeaderboard calls it if overlay visible...
            // Or we can try to trigger it via loop if we can access it.
            // Actually `showResults` was exposed globally in my script patch? No.
            // But `updateLeaderboard` is exposed. And `updateLeaderboard` calls `showResults` if overlay visible.
            window.updateLeaderboard();
        """)

        time.sleep(1) # Wait for render

        # Take screenshot
        output_path = "regatta/verification/results_v4.png"
        page.screenshot(path=output_path)
        print(f"Screenshot saved to {output_path}")

        browser.close()

if __name__ == "__main__":
    verify_results()
