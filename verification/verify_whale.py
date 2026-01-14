import os
import threading
import time
from http.server import HTTPServer, SimpleHTTPRequestHandler
from playwright.sync_api import sync_playwright

# Start a simple HTTP server in a thread
def start_server(port=8000):
    os.chdir("whale") # Serve from whale dir
    httpd = HTTPServer(('localhost', port), SimpleHTTPRequestHandler)
    print(f"Serving at port {port}")
    httpd.serve_forever()

def verify_whale():
    # Start server
    server_thread = threading.Thread(target=start_server, daemon=True)
    server_thread.start()

    # Give server time to start
    time.sleep(1)

    url = "http://localhost:8000/index.html"

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()

        # Print all console messages
        page.on("console", lambda msg: print(f"CONSOLE: {msg.text}"))
        page.on("pageerror", lambda exc: print(f"PAGE ERROR: {exc}"))

        print(f"Navigating to {url}")
        page.goto(url)

        # Click start
        print("Clicking start...")
        page.click("#start-btn")

        print("Waiting for canvas...")
        try:
            page.wait_for_selector("canvas", timeout=5000)
            print("Canvas found!")

            # Take screenshot of success
            page.screenshot(path="../verification/whale_success.png")
        except Exception as e:
            print(f"Canvas NOT found: {e}")
            page.screenshot(path="../verification/whale_fail.png")
            exit(1)

        browser.close()

if __name__ == "__main__":
    verify_whale()
