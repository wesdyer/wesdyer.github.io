// inMaskWater's spatial index (game/core.js, PT-046) is exact: on every venue, a seeded spread of points over
// the arena and several margins, asked of inMaskWater and of inMaskWaterRef (the plain walk over every land
// shape), must agree every time. Points are packed densely near coasts too, where the answer flips.
//   node regatta/eval/_mask_index_check.js [venue ...]
const { chromium } = require('playwright');
const path = require('path');
const ROOT = process.env.ROOT || path.resolve(__dirname, '../..');
const VENUES = process.argv.slice(2).length ? process.argv.slice(2) : ['bay', 'lake', 'lagoon', 'swamp', 'river', 'ocean', 'redrock', 'glowtide', 'arctic', 'otter', 'flats', 'volcanic', 'seatrials'];
(async () => {
    const b = await chromium.launch(); const p = await b.newPage();
    await p.goto('file://' + ROOT + '/regatta/index.html');
    await p.waitForFunction(() => window.state && typeof selectVenue === 'function');
    let bad = 0;
    for (const v of VENUES) {
        const r = await p.evaluate((v) => {
            resetGame(); settings.venue = v; selectVenue(v); loadVenueWorld();
            let s = 4242; const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
            const ex = Arena.extent(state.course.boundary), land = state.course.landShapes || [];
            const M = [0, 5, 40, 150, 600];
            let n = 0, diff = 0, tA = 0, tB = 0;
            const ask = (x, y) => { for (const m of M) { let t = performance.now(); const a = inMaskWater(x, y, m); tA += performance.now() - t; t = performance.now(); const c = inMaskWaterRef(x, y, m); tB += performance.now() - t; n++; if (a !== c) diff++; } };
            for (let i = 0; i < 20000; i++) ask(ex.minX + rnd() * (ex.maxX - ex.minX), ex.minY + rnd() * (ex.maxY - ex.minY));
            for (let i = 0; i < 20000 && land.length; i++) {         // on and about the coasts
                const isl = land[Math.floor(rnd() * land.length)], V = isl.vertices, q = V[Math.floor(rnd() * V.length)];
                ask(q.x + (rnd() - 0.5) * 120, q.y + (rnd() - 0.5) * 120);
            }
            return { venue: state.course.venueKey, shapes: land.length, n, diff, ms: Math.round(tA), ref: Math.round(tB) };
        }, v);
        const ok = r.diff === 0 && r.venue === v; if (!ok) bad++;
        console.log(`${ok ? 'ok  ' : 'FAIL'} ${v.padEnd(10)} ${String(r.shapes).padStart(5)} shapes  ${r.n} queries, ${r.diff} differ   ${r.ref} -> ${r.ms} ms`);
    }
    console.log(bad ? `FAIL — ${bad} venue(s) differ` : 'PASS — every answer identical');
    await b.close(); process.exit(bad ? 1 : 0);
})();
