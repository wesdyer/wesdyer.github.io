// WHAT DOES SAILING NEAR ICE ACTUALLY COST? The router's `narrow` hint prices
// water inside PAD=8 cells (400u) of ice as if it were a contact-ridden
// channel — up to +50% time at the human's own 200u berth. The physics slows
// a boat only on CONTACT and via avoidance deflection, so the honest tax is
// measurable: per racing frame of a SOLO bot, bin by clearance (distance-to-
// blocked-cell via the live stamped grid's clearance field) and report speed
// vs polar target, deflection share, and contact share per band.
//   node _arc_lossclr.js <tree> [seeds...]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const ROOT = path.join(__dirname, process.argv[2] || 'treeCMB');
const SEEDS = process.argv.slice(3).length ? process.argv.slice(3).map(Number) : [9400, 9401, 9402];
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    await page.evaluate((v) => localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })), 'arctic');
    const agg = {};   // band -> {t, slow, defl, contact, spdSum, polSum, odo}
    for (const seed of SEEDS) {
        const r = await page.evaluate(async (seed) => {
            window.evalHarness.seed = seed; window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            // SOLO: keep one bot, park the rest + player far away
            const bots = state.boats.filter(b => !b.isPlayer);
            const solo = bots[0];
            for (const o of state.boats) if (o !== solo) {
                o.x = 1e6; o.y = 1e6; o.raceState.finished = true; o.fadeTimer = 0;
            }
            const bands = {}; // key: clearance cells (0..9, 9=9+)
            const dt = 1 / 60;
            let lastX = solo.x, lastY = solo.y;
            for (let it = 0; it < 60 * 940; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                const t = state.race.status === 'racing' ? state.race.timer : -state.race.timer;
                if (t > 900) break;
                if (state.race.status !== 'racing') continue;
                if (solo.raceState.finished) break;
                if (solo.raceState.leg < 1) { lastX = solo.x; lastY = solo.y; continue; }
                if (it % 6 !== 0) continue;   // 10 Hz
                const g = state.course.botGrid;
                if (!g) continue;
                if (!g._clear && window.SailCheck) g._clear = window.SailCheck.clearanceField(g);
                const cc = g.cell(solo.x, solo.y);
                const clr = g.at(cc[0], cc[1]) ? Math.min(9, g._clear[cc[1] * g.n + cc[0]]) : 0;
                const w = getWindAt(solo.x, solo.y);
                const twa = Math.abs(normalizeAngle(solo.heading - w.direction));
                const pol = getTargetSpeed(twa, false, w.speed) * 15; // u/s
                const spd = solo.speed * 60;
                const c = solo.controller;
                const defl = c && Math.abs(c.lastAvoidDeviation || 0) > 0.1 ? 1 : 0;
                const contact = (c && c.iceEscapeTimer > 0) ? 1 : 0;
                const odo = Math.hypot(solo.x - lastX, solo.y - lastY);
                lastX = solo.x; lastY = solo.y;
                const k = String(clr);
                if (!bands[k]) bands[k] = { t: 0, slow: 0, defl: 0, contact: 0, spdSum: 0, polSum: 0, odo: 0 };
                const B = bands[k];
                B.t += 0.1; B.spdSum += spd; B.polSum += Math.max(1, pol);
                if (pol > 1 && spd < 0.5 * pol) B.slow += 0.1;
                B.defl += defl * 0.1; B.contact += contact * 0.1; B.odo += odo;
            }
            return { bands, fin: solo.raceState.finished ? solo.raceState.finishTime : null };
        }, seed);
        console.log(`seed ${seed}: fin ${r.fin && r.fin.toFixed ? r.fin.toFixed(0) : r.fin}`);
        for (const k of Object.keys(r.bands)) {
            if (!agg[k]) agg[k] = { t: 0, slow: 0, defl: 0, contact: 0, spdSum: 0, polSum: 0, odo: 0 };
            for (const f of Object.keys(r.bands[k])) agg[k][f] += r.bands[k][f];
        }
    }
    console.log('\nclr(cells~50u)   time_s   %time   spd/polar   %slow(<50%)   %deflected   %contact-latch');
    const tot = Object.values(agg).reduce((p, b) => p + b.t, 0);
    for (const k of Object.keys(agg).sort((a, b) => +a - +b)) {
        const B = agg[k];
        const n = B.t / 0.1;
        console.log(String(k).padStart(3),
            String(B.t.toFixed(0)).padStart(11),
            ((100 * B.t / tot).toFixed(1) + '%').padStart(8),
            (B.spdSum / Math.max(1, B.polSum)).toFixed(2).padStart(10),
            ((100 * B.slow / B.t).toFixed(1) + '%').padStart(12),
            ((100 * B.defl / B.t).toFixed(1) + '%').padStart(12),
            ((100 * B.contact / B.t).toFixed(1) + '%').padStart(14));
    }
    await browser.close();
})();
