// Shift + arrow = exactly one degree per press (real key events through input.js, live loop).
const { chromium } = require('playwright'); const path = require('path');
(async () => {
    const b = await chromium.launch(), page = await b.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR', e.stack));
    await page.goto('file://' + path.resolve(__dirname, '../../index.html'));
    await page.waitForTimeout(1500);
    await page.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'seatrials' })); resetGame(); startRace(); state.race.status = 'racing'; });
    await page.waitForTimeout(500);
    const hdg = () => page.evaluate(() => state.boats.find(b => b.isPlayer).heading * 180 / Math.PI);
    const freeze = () => page.evaluate(() => { const p = state.boats.find(b => b.isPlayer); p.speed = 0; p._ref = p.heading; });
    const out = [];
    for (const [label, keys] of [['Shift+Right x1', ['ArrowRight']], ['Shift+Left x3', ['ArrowLeft', 'ArrowLeft', 'ArrowLeft']], ['Shift+D x2', ['d', 'd']]]) {
        await page.waitForTimeout(200);
        const h0 = await hdg();
        await page.keyboard.down('Shift');
        for (const k of keys) { await page.keyboard.press(k); await page.waitForTimeout(80); }
        await page.waitForTimeout(150);
        await page.keyboard.up('Shift');
        const h1 = await hdg();
        let d = ((h1 - h0 + 540) % 360) - 180;
        out.push({ label, turnedDeg: +d.toFixed(3) });
    }
    console.table(out); await b.close();
})();
