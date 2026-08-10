// IS HER LINE THROUGH THIS POCKET ON THE ROUTER'S GRAPH? (2026-08-10, generalised)
//
// The swamp version of this question (`_swamp_pockets`) found sub4 refusing 10.8%
// of her own track. Redrock's leg3-sub0 asks it again and more sharply: it is
// +26.5 s/boat (57% of leg 3, ~14% of the whole venue gap), its dominant state is
// **landAhead 54% with armed only 7%** — so the fleet is creeping at 36 u/s
// because its grid probe reports land ahead, through water SHE crosses at 83 u/s.
//
// If a large share of her track sits on cells the router calls unsailable, the
// fleet's slow line is not a worse CHOICE but the best of a smaller SET, and no
// amount of route pricing reaches it. If her track is clean, the map is fine and
// the creep belongs to execution — which is where the clearance-bar dose-response
// says to look.
//
//   node _pocket_admit.js <venue> <trajFpPrefix> <tree> <cx> <cy> <radius> [more cx cy r ...]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'redrock';
const ROOT = path.join(__dirname, process.argv[3] || 'treeDB3');
const args = process.argv.slice(4).map(Number);
const POCKETS = [];
for (let i = 0; i + 2 < args.length + 1; i += 3) {
    if (args[i + 2] === undefined) break;
    POCKETS.push([args[i], args[i + 1], args[i + 2]]);
}

(async () => {
    const dir = path.join(__dirname, 'traj');
    const laps = [];
    for (const f of fs.readdirSync(dir).filter(f => f.startsWith('traj_' + VENUE + '_')).sort()) {
        const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
        if (!j.format) continue;                       // schema-1 laps carry no format
        const F = j.format, I = n => F.indexOf(n);
        laps.push(j.samples.filter(r => r[I('leg')] >= 1).map(r => [r[I('x')], r[I('y')], r[I('spd')] * 60]));
    }
    if (!laps.length) { console.log(`no schema-2 laps for ${VENUE} — cannot compare her line`); }

    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await page.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });

    const out = await page.evaluate(({ POCKETS, laps }) => {
        window.evalHarness.seed = 9400; window.resetGame(); window.startRace();
        for (let i = 0; i < 120; i++) window.update(1 / 60);
        const g = state.course.botGrid;
        const res = [];
        for (const [cx, cy, R] of POCKETS) {
            let open = 0, closed = 0;
            const c0 = g.cell(cx - R, cy - R), c1 = g.cell(cx + R, cy + R);
            for (let j = c0[1]; j <= c1[1]; j++) for (let i = c0[0]; i <= c1[0]; i++) {
                const [wx, wy] = g.world(i, j);
                if (Math.hypot(wx - cx, wy - cy) > R) continue;
                if (g.at(i, j)) open++; else closed++;
            }
            let hn = 0, hb = 0, hv = 0;
            for (const L of laps) for (const [x, y, v] of L) {
                if (Math.hypot(x - cx, y - cy) > R) continue;
                hn++; hv += v; const c = g.cell(x, y); if (!g.at(c[0], c[1])) hb++;
            }
            // how much of the pocket's water is within CLEARANCE of something?
            res.push({ cx, cy, R, open, closed, hn, hb, hv });
        }
        return res;
    }, { POCKETS, laps });
    await browser.close();

    console.log(`\n=== ${VENUE.toUpperCase()} POCKET ADMISSION (${path.basename(ROOT)}) ===`);
    console.log(`pocket            cells open/total  blocked   HER samples  on UNSAILABLE  her mean u/s`);
    for (const r of out) {
        const tot = r.open + r.closed;
        console.log(`(${String(r.cx).padStart(6)},${String(r.cy).padStart(6)}) r${String(r.R).padEnd(4)} ` +
            `${String(r.open).padStart(5)}/${String(tot).padEnd(5)} ${(100 * r.closed / tot).toFixed(0).padStart(5)}%   ` +
            `${String(r.hn).padStart(7)}       ${r.hn ? (100 * r.hb / r.hn).toFixed(1) + '%' : '  -  '}        ${r.hn ? (r.hv / r.hn).toFixed(0) : '-'}`);
    }
    console.log(`\n  → her track on UNSAILABLE cells = admission (a smaller SET, not a worse choice).`);
    console.log(`  → her track clean but the fleet creeping = EXECUTION, and the clearance-bar`);
    console.log(`    dose-response already says do not re-price the map for that.`);
})();
