from playwright.sync_api import sync_playwright, expect
import os

def verify_favicon(page):
    # Go to the local server
    page.goto("http://localhost:8000/regatta/index.html")

    # Locate the link tag
    icon_link = page.locator('link[rel="icon"]')

    # Check that it exists
    expect(icon_link).to_have_count(1)

    # Get attributes
    href = icon_link.get_attribute("href")
    mime_type = icon_link.get_attribute("type")

    print(f"Favicon HREF: {href}")
    print(f"Favicon Type: {mime_type}")

    assert "salty-crew-yacht-club-burgee.png" in href
    assert mime_type == "image/png"

    # Take a screenshot of the page just to satisfy the workflow
    # Note: This won't show the favicon in the browser tab UI
    page.screenshot(path="verification/regatta_with_favicon.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        try:
            verify_favicon(page)
            print("Verification successful!")
        except Exception as e:
            print(f"Verification failed: {e}")
            exit(1)
        finally:
            browser.close()
