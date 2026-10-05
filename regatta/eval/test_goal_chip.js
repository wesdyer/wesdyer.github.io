// GOAL CHIP SIZE — the off-screen goal chip stays chip-sized after the clock is reset (PT-102).
//
//   node regatta/eval/test_goal_chip.js
//
// The chip pulses ×1.25 when a leg starts, stamped with state.time. A race stamped it, the
// School reset the clock under it, and the negative age scaled the chip ~10× across the screen.
//   stale      a pulse stamped 30 s in the future draws the chip at ×1 (no pulse)
//   fresh      a pulse stamped now still draws ×1.25, and one 1 s old ×1
//   restart    restartRace clears the stamp
//   school     a gate's two buoys projecting to one edge point draw ONE chip, the nearer distance
const { chromium } = require('playwright');
const path = require('path');

let fails = 0;
const check = (name, ok, detail) => {
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
    if (!ok) fails++;
};

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
    const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.addInitScript(() => localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'bay', musicEnabled: false, soundEnabled: false, bgSoundEnabled: false })));
    await page.goto('file://' + path.resolve('regatta/index.html'));
    await page.waitForFunction(() => typeof state !== 'undefined' && state.boats && state.boats.length > 0, null, { timeout: 30000 });

    const r = await page.evaluate(() => {
        // A recording context: the scale the chip applies, and the labels it writes.
        const rec = () => {
            const c = document.createElement('canvas'); c.width = 1200; c.height = 800;
            const ctx = c.getContext('2d'), log = { scales: [], labels: [] };
            const sc = ctx.scale.bind(ctx), ft = ctx.fillText.bind(ctx);
            ctx.scale = (a, b) => { log.scales.push(a); sc(a, b); };
            ctx.fillText = (t, x, y) => { log.labels.push(String(t)); ft(t, x, y); };
            return { ctx, log };
        };
        const scaleAt = (stampAhead) => {
            state._goalPulseT = state.time + stampAhead;
            const { ctx, log } = rec();
            drawMarkEdgeIndicator(ctx, 600, 40, '220m', 'starboard', 0);
            return log.scales[0];
        };
        const out = {};
        state.time = 0;
        out.stale = scaleAt(30);
        out.fresh = scaleAt(0);
        out.old = scaleAt(-1);
        state._goalPulseT = 300; state._goalLegSeen = 3;
        restartRace();
        out.restart = [state._goalPulseT, state._goalLegSeen];
        // The School's gate: two buoys, both off the top edge, 30 px apart there.
        state._goalPulseT = null;
        const { ctx, log } = rec();
        const fake = { s: { buoys: [{ on: true, p: { x: 0, y: -1270 } }, { on: true, p: { x: 0, y: -1430 } }] }, dist: School.dist };
        const p0 = state.boats[0]; const keep = { x: p0.x, y: p0.y }; p0.x = 0; p0.y = 0;
        let n = 0;
        School.drawEdgeIndicators.call(fake, ctx, (wx, wy) => ({ x: 600 + wx * 0.02 + (wy < -1300 ? 30 : 0), y: 40, onScreen: false }), 0, null,
            () => ({ x: 0, y: 0, inView: false }));
        p0.x = keep.x; p0.y = keep.y;
        out.schoolChips = log.labels;
        return out;
    });
    check('a pulse stamped in the future draws the chip at ×1', r.stale === 1, `scale ${r.stale}`);
    check('a fresh pulse still swells the chip ×1.25', Math.abs(r.fresh - 1.25) < 1e-9, `scale ${r.fresh}`);
    check('a pulse 1 s old is over', r.old === 1, `scale ${r.old}`);
    check('restartRace clears the stamp', r.restart[0] == null && r.restart[1] == null, JSON.stringify(r.restart));
    check('a gate\'s two buoys at one edge point draw one chip, the nearer distance',
        r.schoolChips.length === 1 && r.schoolChips[0] === '254m', JSON.stringify(r.schoolChips));
    check('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));

    await browser.close();
    console.log(fails ? `FAIL — ${fails} failure(s)` : 'PASS — 0 failure(s)');
    process.exit(fails ? 1 : 0);
})();
