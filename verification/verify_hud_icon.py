from playwright.sync_api import sync_playwright

def verify_hud_icon(page):
    # Navigate to the file directly
    page.goto("file:///app/regatta/index.html")

    # Wait for the HUD to be visible
    # The wind speed label has id 'hud-wind-speed-label'
    label = page.locator('#hud-wind-speed-label')
    label.wait_for()

    # Find the parent container of the label
    # The parent is the div we modified: class="flex items-center gap-1 bg-slate-800/80 px-2 py-0.5 rounded-full border border-slate-600/50"
    container = label.locator('xpath=..')

    # Check if there is an SVG inside this container
    svg = container.locator('svg')

    count = svg.count()
    print(f"SVG count in wind speed container: {count}")

    if count == 0:
        print("SUCCESS: Wind icon is gone.")
    else:
        print("FAILURE: Wind icon is still present.")

    # Take a screenshot of the HUD area
    # The HUD container is roughly top right
    page.screenshot(path="verification/hud_verification.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            verify_hud_icon(page)
        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()
