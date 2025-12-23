from playwright.sync_api import sync_playwright, expect
import os

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        # Use absolute path correctly
        path = os.path.abspath("regatta/index.html")
        page.goto(f"file://{path}")

        # 1. Verify "Toggle Penalties F4" in Help
        page.keyboard.press("?")
        expect(page.locator("#help-screen")).to_be_visible()
        expect(page.get_by_text("Toggle Penalties")).to_be_visible()
        expect(page.get_by_text("F4", exact=True)).to_be_visible()
        page.screenshot(path="verification/help_screen.png")
        page.keyboard.press("Escape")

        # 2. Verify "Penalties" in Settings
        page.keyboard.press("F2")
        expect(page.locator("#settings-screen")).to_be_visible()
        # Use exact match or better selector
        expect(page.locator("#settings-screen").get_by_text("Penalties", exact=True)).to_be_visible()
        checkbox = page.locator("#setting-penalties")
        expect(checkbox).to_be_visible()
        expect(checkbox).to_be_checked()
        page.screenshot(path="verification/settings_screen.png")
        page.keyboard.press("Escape")

        # 3. Verify HUD Rules Status and Toggle Logic
        rules_status = page.locator("#hud-rules-status")
        expect(rules_status).to_be_visible()
        expect(rules_status).to_have_text("RULES: ON")

        page.keyboard.press("F4")
        expect(rules_status).to_have_text("RULES: OFF")
        expect(page.locator("#hud-message")).to_have_text("RULES DISABLED")
        page.screenshot(path="verification/hud_toggle_off.png")

        page.keyboard.press("F4")
        expect(rules_status).to_have_text("RULES: ON")
        expect(page.locator("#hud-message")).to_have_text("RULES ENABLED")
        page.screenshot(path="verification/hud_toggle_on.png")

        browser.close()

if __name__ == "__main__":
    run()
