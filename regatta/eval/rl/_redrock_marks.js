// Why Redrock's roundings fail, mark by mark.
//
// test_sailable says three of the four rounding marks have 0 degrees of
// hull-width water around them — a boat cannot get round them at all, so the
// ideal path completes 1 leg of 6 and the venue cannot be baselined. That is a
// verdict, not a fix list. This reports what a fix needs: for each rounding
// mark, how much of the circle is open at a ladder of radii, the nearest
// blocked bearing, and how far the mark would have to move (and which way) to
// find water.
// node _redrock_marks.js [tree] [venue]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const ROOT = path.join(__dirname, process.argv[2] || 'treeA');
const VENUE = process.argv[3] || 'redrock';
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript((v) => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: v }));
    }, VENUE);
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    const r = await page.evaluate((venue) => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue }));
        resetGame();
        const c = state.course;
        const doc = window.VenueDoc.get(venue);
        const fixed = window.VenueDoc.shapes(doc).filter(sh => window.VenueDoc.traits(sh).motion === 'fixed');
        const grid = window.SailCheck.buildGrid(fixed, c.boundary, null);
        const CL = window.SailCheck.CLEARANCE;
        const out = [];
        for (let li = 0; li < (c.route || []).length; li++) {
            const e = c.route[li];
            if (!e || e.kind !== 'round' || !e.mark) continue;
            const m = e.mark;
            const rungs = [];
            for (const R of [m.radius + CL + 8, m.radius + CL + 40, 100, 140, 180, 220, 260, 300, 360, 420]) {
                let open = 0;
                const blocked = [];
                for (let k = 0; k < 72; k++) {
                    const a = (k / 72) * Math.PI * 2;
                    const cc = grid.cell(m.x + Math.cos(a) * R, m.y + Math.sin(a) * R);
                    if (grid.at(cc[0], cc[1])) open++;
                    else blocked.push(Math.round(a * 180 / Math.PI));
                }
                // longest unbroken open run, wrapping
                const ok = [];
                for (let k = 0; k < 72; k++) {
                    const a = (k / 72) * Math.PI * 2;
                    const cc = grid.cell(m.x + Math.cos(a) * R, m.y + Math.sin(a) * R);
                    ok.push(grid.at(cc[0], cc[1]) ? 1 : 0);
                }
                let best = 0, run = 0;
                for (let k = 0; k < 144; k++) { run = ok[k % 72] ? run + 1 : 0; if (run > best) best = run; }
                rungs.push({ R: Math.round(R), openPct: Math.round(100 * open / 72),
                             arcDeg: Math.round(Math.min(best, 72) / 72 * 360) });
            }
            // Nearest open water to the mark centre, and which way
            let near = null;
            for (let rad = 40; rad <= 900 && !near; rad += 20) {
                for (let k = 0; k < 72; k++) {
                    const a = (k / 72) * Math.PI * 2;
                    const cc = grid.cell(m.x + Math.cos(a) * rad, m.y + Math.sin(a) * rad);
                    if (grid.at(cc[0], cc[1])) { near = { d: rad, bearingDeg: Math.round(a * 180 / Math.PI) }; break; }
                }
            }
            // Is the mark itself on land?
            const cm = grid.cell(m.x, m.y);
            out.push({ leg: li, id: e.markId || m.id, x: Math.round(m.x), y: Math.round(m.y),
                       radius: Math.round(m.radius || 0), zone: Math.round(m.zone || 0),
                       side: m.side, onWater: !!grid.at(cm[0], cm[1]), near, rungs });
        }
        return { clearance: CL, cells: grid.nav.reduce((a, b) => a + b, 0), n: grid.n, out };
    }, VENUE);
    console.log(`${VENUE}: grid ${r.n}x${r.n}, ${r.cells} navigable cells, hull clearance ${r.clearance}u\n`);
    for (const m of r.out) {
        console.log(`leg ${m.leg}  mark ${m.id} (${m.side})  at ${m.x},${m.y}  markRadius ${m.radius} zone ${m.zone}`);
        console.log(`   mark centre on water: ${m.onWater ? 'yes' : 'NO — planted in land'}` +
                    (m.near ? `   nearest open water ${m.near.d}u away at bearing ${m.near.bearingDeg}deg` : '   NO open water within 900u'));
        console.log('   radius:  ' + m.rungs.map(x => String(x.R).padStart(5)).join(''));
        console.log('   open%:   ' + m.rungs.map(x => String(x.openPct).padStart(5)).join(''));
        console.log('   bestArc: ' + m.rungs.map(x => String(x.arcDeg).padStart(5)).join('') + '  (deg, longest unbroken)');
        const usable = m.rungs.find(x => x.arcDeg >= 200);
        console.log('   ' + (usable
            ? `ROUNDABLE at radius ${usable.R} (${usable.arcDeg}deg open) — the zone would have to reach it`
            : 'NOT ROUNDABLE at any radius up to 420u'));
        console.log('');
    }
    await browser.close();
})();
