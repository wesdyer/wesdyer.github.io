import time
import os
from playwright.sync_api import sync_playwright

def verify_particles_removed():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        cwd = os.getcwd()
        page.goto(f"file://{cwd}/regatta/index.html")

        # Wait for game to init
        page.wait_for_function("window.state && window.state.race")

        # Enable current via UI if not enabled
        page.evaluate("""
            if (UI.confCurrentEnable) {
                if (!UI.confCurrentEnable.checked) {
                    UI.confCurrentEnable.click();
                }
                // Ensure speed is high enough to spawn particles
                if (UI.confCurrentSpeed) {
                    UI.confCurrentSpeed.value = "5.0";
                    UI.confCurrentSpeed.dispatchEvent(new Event('input'));
                }
            }
        """)

        # Wait for particles to spawn
        print("Waiting for particles...")
        has_particles = False
        for i in range(20):
            count = page.evaluate("state.particles.filter(p => p.type === 'current' || p.type === 'mark-wake').length")
            if count > 0:
                print(f"Particles spawned: {count}")
                has_particles = True
                break
            time.sleep(0.5)

        if not has_particles:
            print("No particles spawned automatically. Forcing one for test.")
            page.evaluate("state.particles.push({type: 'current', life: 1.0, x:0, y:0})")

        particles_before = page.evaluate("state.particles.filter(p => p.type === 'current' || p.type === 'mark-wake').length")
        print(f"Particles before disable: {particles_before}")

        # Screenshot before
        page.screenshot(path="verification/before_disable.png")

        # Disable current
        print("Disabling current...")
        page.evaluate("if (UI.confCurrentEnable && UI.confCurrentEnable.checked) UI.confCurrentEnable.click()")

        # Check immediately
        particles_after = page.evaluate("state.particles.filter(p => p.type === 'current' || p.type === 'mark-wake').length")
        print(f"Particles after disable: {particles_after}")

        # Screenshot after
        page.screenshot(path="verification/after_disable.png")

        if particles_after > 0:
            print("FAIL: Particles persisted.")
        else:
            print("SUCCESS: Particles removed.")

        browser.close()

if __name__ == "__main__":
    verify_particles_removed()
