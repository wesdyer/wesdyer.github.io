// CAN THE ROUTER SEE THE BAYOU'S FOREST? (2026-08-10, the swamp push.)
//
// Gatorgrass emits **2051 hard prop colliders** — cypress trunks (contactR 7),
// knees (8), deadheads (10), driftlogs (5), shacks (28-44) — because the merge
// added their kinds to PROP_KINDS and `compileVenueDoc` turns every known hard
// fixed prop into a hidden collider shape. Physics stops a boat dead on each one.
//
// THE PRECEDENT THIS IS AIMED AT: on lagoon (CP1, 2026-08-08) **32 of 37 coral
// heads blocked ZERO grid cells** while physics stopped boats dead on them — the
// router was routing straight through obstacles it could not see. That was fixed
// for the grid the bots route on by stamping hard props as walls
// (`script.js:20824-20833`). But a stamp only helps if the obstacle is big enough
// to CLAIM a cell: an r=5 driftlog inside a coarse cell either vanishes (router
// blind, boat grinds) or claims the whole cell (router over-avoids). With 2051 of
// them the aggregate matters enormously, and swamp is the first venue where the
// prop count is in the thousands.
//
//   node _swamp_props.js [tree] [venue]
//
// Reports: grid geometry, the blocked-cell histogram over every `.hit` shape, and
// how much of the venue's water the forest removes. A large ZERO-CELL population
// means the router is blind and the fix is upstream of any helm behaviour.
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const ROOT = path.join(__dirname, process.argv[2] || 'treeHD11');
const VENUE = process.argv[3] || 'swamp';

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const r = await page.evaluate(() => {
        window.evalHarness.seed = 4300;
        window.resetGame(); window.startRace();
        for (let i = 0; i < 120; i++) window.update(1 / 60);   // let the grid build
        const g = state.course.botGrid;
        const isles = state.course.islands || [];
        const hits = isles.filter(i => /\.hit$/.test(i.id || ''));
        const authored = isles.filter(i => !/\.hit$/.test(i.id || ''));
        // cell size in world units
        const [x0, y0] = g.world(0, 0), [x1, y1] = g.world(1, 1);
        const cw = Math.abs(x1 - x0), ch = Math.abs(y1 - y0);
        // ⚠️ DO NOT ASSUME CENTRE SAMPLING. `noSubsample` is passed only on icy
        // venues, so swamp's grid may mark a cell blocked from a SUBSAMPLE — in
        // which case a prop can claim a cell whose centre lies outside it, and a
        // centre-inside test would under-count. Build the counterfactual grid
        // WITHOUT the forest and diff: the cells that differ are exactly what the
        // props contribute, whatever the sampling rule.
        const fixed = state.course._gridFixed || [];
        const noProps = fixed.filter(s => !/\.hit$/.test(s.id || ''));
        const gB = window.SailCheck.buildGrid(noProps, state.course.boundary, null, null);
        let claimed = 0;
        const claimedSet = new Set();
        for (let j = 0; j < g.n; j++) for (let i = 0; i < g.n; i++) {
            if (!g.at(i, j) && gB.at(i, j)) { claimed++; claimedSet.add(j * g.n + i); }
        }
        // per-prop: does the forest claim ANY cell near this prop?
        const hist = {}; let zero = 0; const radii = {};
        for (const h of hits) {
            const R = h.radius || 0;
            radii[Math.round(R)] = (radii[Math.round(R)] || 0) + 1;
            const span = Math.ceil((R + Math.max(cw, ch)) / Math.min(cw, ch)) + 1;
            const c0 = g.cell(h.x, h.y);
            let blocked = 0;
            for (let dy = -span; dy <= span; dy++) for (let dx = -span; dx <= span; dx++) {
                const ci = c0[0] + dx, cj = c0[1] + dy;
                if (ci < 0 || cj < 0 || ci >= g.n || cj >= g.n) continue;
                if (claimedSet.has(cj * g.n + ci)) blocked++;
            }
            if (blocked === 0) zero++;
            hist[Math.min(blocked, 6)] = (hist[Math.min(blocked, 6)] || 0) + 1;
        }
        const openB = (() => { let o = 0; for (let j = 0; j < gB.n; j++) for (let i = 0; i < gB.n; i++) if (gB.at(i, j)) o++; return o; })();
        // total sailable cells, for the "how much water does the forest remove" figure
        let open = 0, closed = 0;
        for (let j = 0; j < g.n; j++) for (let i = 0; i < g.n; i++) (g.at(i, j) ? open++ : closed++);
        return { n: g.n, cw, ch, nIsl: isles.length, nHit: hits.length, nAuth: authored.length,
                 zero, hist, radii, open, closed, claimed, openB };
    });
    await browser.close();
    console.log(`\n=== ${VENUE.toUpperCase()} PROP FOREST vs THE ROUTER GRID (${path.basename(ROOT)}) ===`);
    console.log(`grid ${r.n} x ${r.n}   cell ${r.cw.toFixed(1)}u x ${r.ch.toFixed(1)}u`);
    console.log(`islands ${r.nIsl}  =  ${r.nAuth} authored  +  ${r.nHit} hidden prop colliders`);
    console.log(`sailable cells ${r.open} / ${r.open + r.closed} (${(100 * r.open / (r.open + r.closed)).toFixed(1)}%)`);
    console.log(`⭐ cells the FOREST actually claims (grid-with minus grid-without): ${r.claimed}`);
    console.log(`   sailable without the forest ${r.openB}  ->  with it ${r.open}   (${(100 * r.claimed / r.openB).toFixed(2)}% of open water removed)`);
    console.log(`\nprop collider radii: ${Object.entries(r.radii).sort((a, b) => a[0] - b[0]).map(([k, v]) => `r${k}:${v}`).join('  ')}`);
    console.log(`⭐ BLOCKING ZERO GRID CELLS: ${r.zero} / ${r.nHit}  (${(100 * r.zero / r.nHit).toFixed(0)}%)`);
    console.log(`   cells blocked per prop: ${Object.entries(r.hist).sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k === '6' ? '6+' : k}:${v}`).join('  ')}`);
    console.log(`\n  → a large ZERO population means physics stops boats on obstacles the ROUTER`);
    console.log(`    cannot see (the lagoon CP1 failure, at 55x the object count).`);
    console.log(`  → cell >> prop radius also means a SEEN prop over-claims: the wall is`);
    console.log(`    ${(r.cw / 2).toFixed(0)}u+ where the trunk is 7u. Both directions are wrong.`);
})();
