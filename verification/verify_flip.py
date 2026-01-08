
from playwright.sync_api import sync_playwright

def verify_wordle_animation():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        page.on("console", lambda msg: print(f"PAGE LOG: {msg.text}"))

        page.goto("http://localhost:8000/wordle/")

        # Wait for initialization
        page.wait_for_timeout(1000)

        # Type a guess (e.g., "WORDS")
        page.keyboard.type("WORDS")
        page.keyboard.press("Enter")

        # Capture state
        # 1. Start of flip (100ms)
        page.wait_for_timeout(100)
        cell1 = page.locator("#grid > div:nth-child(1) > div:nth-child(1)")
        class_100ms = cell1.get_attribute("class")
        print(f"At 100ms: {class_100ms}")

        # 2. End of flip (700ms)
        # We need to wait enough time for the cascading + animation.
        # But for the FIRST cell (index 0), delay is 0. Animation is 600ms. Color change at 300ms.
        page.wait_for_timeout(700)
        class_800ms = cell1.get_attribute("class")
        print(f"At 800ms: {class_800ms}")

        browser.close()

if __name__ == "__main__":
    verify_wordle_animation()
