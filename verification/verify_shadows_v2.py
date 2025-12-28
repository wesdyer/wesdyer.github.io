from playwright.sync_api import sync_playwright
import time

def verify_shadows():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()

        # Load the game
        page.goto("file:///app/regatta/index.html")

        # Wait for game to initialize
        page.wait_for_selector("#gameCanvas")

        # Inject code to force conditions for visibility
        page.evaluate("""
            // Force random seed for consistency if needed, but we will just set specific conditions

            // 1. Force state to racing to ensure rendering loop is active
            window.state.race.status = 'racing';

            // 2. Clear existing islands and create a specific test layout
            // We want islands in the middle of the screen
            window.state.islands = [];

            // Create a few islands manually
            // Island format: { x, y, vertices: [{x,y}, ...], bounds: {minX, maxX, minY, maxY} }
            // We can use the Island class or just mock the structure if needed.
            // Better to use the existing generator but override the result?
            // Or just manually construct simple islands.

            function createTestIsland(cx, cy, radius) {
                const vertices = [];
                const numPoints = 8;
                for (let i = 0; i < numPoints; i++) {
                    const angle = (i / numPoints) * Math.PI * 2;
                    vertices.push({
                        x: cx + Math.cos(angle) * radius,
                        y: cy + Math.sin(angle) * radius
                    });
                }
                // Calculate bounds
                let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
                vertices.forEach(v => {
                    minX = Math.min(minX, v.x);
                    maxX = Math.max(maxX, v.x);
                    minY = Math.min(minY, v.y);
                    maxY = Math.max(maxY, v.y);
                });

                return {
                    x: cx,
                    y: cy,
                    vertices: vertices,
                    bounds: { minX, maxX, minY, maxY }
                };
            }

            // Place islands near the boat start (approx 0,0 usually, but let's check)
            // Boat usually starts near (0, 300) or similar.
            const player = window.state.boats[0];
            player.x = 0;
            player.y = 0;

            // Create islands nearby
            window.state.islands.push(createTestIsland(0, -200, 50)); // Ahead
            window.state.islands.push(createTestIsland(200, 0, 50));  // Right
            window.state.islands.push(createTestIsland(-200, 0, 50)); // Left

            // 3. Set specific wind direction
            // Wind from North (0 radians, blowing South)
            // Shadows should be below the islands
            window.state.wind.direction = 0;
            window.state.wind.baseSpeed = 15;

            // 4. Reset camera to center on boat
            window.state.camera.x = player.x;
            window.state.camera.y = player.y;
            window.state.camera.rotation = 0; // North up

            // 5. Ensure minimap is drawing
            // (happens automatically in draw loop)
        """)

        # Allow a frame to render
        page.wait_for_timeout(500)

        # Take screenshot of game view
        page.screenshot(path="verification/island_shadows_game_v2.png")

        # Take screenshot of minimap (crop to minimap element if possible, or just full screen)
        # The minimap is a separate canvas #minimap
        minimap = page.locator("#minimap")
        minimap.screenshot(path="verification/island_shadows_minimap_v2.png")

        browser.close()

if __name__ == "__main__":
    verify_shadows()
