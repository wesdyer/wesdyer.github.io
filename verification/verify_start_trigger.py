from playwright.sync_api import sync_playwright
import os

def verify_briefing_changes():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        url = "file://" + os.path.realpath("regatta/index.html")
        page.goto(url)

        # 1. Verify Text Change
        page.locator("text=Click Start to Begin").wait_for(state="visible", timeout=2000)
        print("Verified 'Click Start to Begin' text.")
        page.screenshot(path="verification/briefing_final.png")

        # 2. Verify Description Truncation
        grid = page.locator("#pr-competitors-grid")
        grid.wait_for(state="visible")

        # Check all cards for word count
        cards = grid.locator("div.bg-slate-900\/40").all()
        for i, card in enumerate(cards):
            desc_el = card.locator("div.text-xs.text-slate-300.italic")
            text = desc_el.inner_text()
            word_count = len(text.split())
            print(f"Card {i} word count: {word_count} ({text})")
            if word_count > 10:
                print(f"FAIL: Card {i} has {word_count} words.")
                exit(1)
        print("Verified all descriptions <= 10 words.")

        # 3. Verify Key Press does NOT start race
        page.keyboard.press("Space")
        page.wait_for_timeout(1000) # Wait a sec

        # Check if overlay is still visible
        overlay = page.locator("#pre-race-overlay")
        if not overlay.is_visible():
             print("FAIL: Key press started the race (overlay hidden).")
             exit(1)
        print("Verified Key press did NOT start race.")

        # 4. Verify Click DOES start race
        page.locator("#start-race-btn").click()
        page.wait_for_timeout(1000)

        if overlay.is_visible():
             print("FAIL: Click did NOT start the race.")
             exit(1)
        print("Verified Click started the race.")

        browser.close()

if __name__ == "__main__":
    verify_briefing_changes()
