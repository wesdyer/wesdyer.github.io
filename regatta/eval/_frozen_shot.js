// Eyeball a frozen venue in the editor. node regatta/eval/_frozen_shot.js [venue...]
const { chromium } = require('playwright');
const path = require('path');
(async () => {
    const venues = process.argv.slice(2);
    const browser = await chromium.launch();
    for (const v of (venues.length ? venues : ['seatrials', 'river', 'lake'])) {
        const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
        page.on('pageerror', e => console.error(`  ${v} PAGE ERROR:`, e.message));
        await page.goto('file://' + path.resolve('regatta/editor.html'));
        await page.waitForTimeout(700);
        await page.evaluate((k) => {
            const sel = document.getElementById('venue-select');
            sel.value = k; sel.dispatchEvent(new Event('change'));
        }, v);
        await page.waitForTimeout(900);
        const info = await page.evaluate(() => {
            const A = window.EditorApp, d = A._state().doc;
            return { venue: d && d.venue, land: d && d.shapes.length,
                     marks: d && d.course.marks.length, route: d && d.course.route.length,
                     arena: d && d.world.boundary.poly.length,
                     wind: d && d.wind.regions.length,
                     checks: document.getElementById('checks').textContent.slice(0, 60) };
        });
        console.log(v.padEnd(10), JSON.stringify(info));
        await page.screenshot({ path: `regatta/eval/_frozen_${v}.png` });
        await page.close();
    }
    await browser.close();
})();
