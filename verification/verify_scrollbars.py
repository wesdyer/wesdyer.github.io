from playwright.sync_api import sync_playwright

def verify_scrollbars():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Navigate to the file
        import os
        url = f"file://{os.path.abspath('regatta/index.html')}"
        page.goto(url)

        # Wait for potential rendering
        page.wait_for_timeout(1000)

        # Check computed style for webkit-scrollbar on body (difficult via API, usually inferred)
        # But we can check if scrollWidth > clientWidth and if scrollbars are visible?
        # Actually, user wants "no scroll bars shown".
        # We can take a screenshot of the whole page and also inspect specific elements if they have content overflow.

        # The pre-race overlay is visible by default or shortly after load?
        # Based on index.html, #pre-race-overlay is visible.
        # It has columns with overflow-y-auto.
        # Let's try to populate them or see if they have content.

        # Take a screenshot
        page.screenshot(path="verification/regatta_scrollbar_check.png")

        # We can also evaluate JS to check if the style rule exists
        style_check = page.evaluate("""() => {
            const sheets = document.styleSheets;
            let hasHideScrollbar = false;
            for (let i = 0; i < sheets.length; i++) {
                try {
                    const rules = sheets[i].cssRules;
                    for (let j = 0; j < rules.length; j++) {
                        if (rules[j].selectorText === '::-webkit-scrollbar' && rules[j].style.display === 'none') {
                            hasHideScrollbar = true;
                        }
                    }
                } catch(e) {}
            }
            return hasHideScrollbar;
        }""")

        print(f"Hide scrollbar rule found: {style_check}")

        browser.close()

if __name__ == "__main__":
    verify_scrollbars()
