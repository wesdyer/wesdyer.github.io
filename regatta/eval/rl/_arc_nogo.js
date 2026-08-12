// IS THE RULER ASKING FOR A COURSE THE BOAT CANNOT SAIL? (2026-08-11, arctic)
//
// `_leg1_where`: the last two bands of arctic's leg 1 — the granite-isle approach
// and the rounding arc — carry 87.5 s of the leg's 142.7 s gap (61%), with an
// odometer ratio of 2.88x/2.13x and 23.0 s of the leg's 41.0 s of head-to-wind
// time inside them. A boat that is stopped head to wind on a rounding is not
// being blocked by ice; it is being STEERED there.
//
// `getNavigationTarget` follows THE RULER — the DMC leg path, "grid-routed around
// static land, tangent in, the checked rounding arc at a radius proven navigable,
// tangent out" — and chases a carrot a few lengths down it. Nothing in
// `roundingArc` or in the follower knows where the wind is. So if part of the arc
// lies inside the no-go, the ruler asks for a heading the polar answers with zero
// knots, and a boat that follows it faithfully parks.
//
// This walks the compiled leg paths and reports the TWA of the PATH TANGENT at
// every step against the local wind: what fraction of each leg's ruler is
// unsailable, and where. It is a property of the course and the wind only — no
// bots, no seeds — so it is the cheapest possible test of the hypothesis.
//
// usage: node _arc_nogo.js <venue> <tree> [trials]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'arctic';
const ROOT = path.join(__dirname, process.argv[3] || 'treeARCB');
const TRIALS = parseInt(process.argv[4]) || 3;

(async () => {
    const br = await chromium.launch(); const p = await br.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await p.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });

    for (let t = 0; t < TRIALS; t++) {
        const r = await p.evaluate((seed) => {
            window.evalHarness.seed = seed; window.resetGame(); window.startRace();
            const out = [];
            const legs = state.course.dmc && state.course.dmc.legs;
            if (!legs) return out;
            for (let L = 0; L < legs.length; L++) {
                const lg = legs[L];
                if (!lg || !lg.pts || lg.pts.length < 3) continue;
                const bands = 10, per = [];
                for (let b = 0; b < bands; b++) per.push({ n: 0, nogo: 0, tight: 0, twaSum: 0, worst: 9 });
                let acc = 0;
                const total = lg.length || 1;
                for (let i = 1; i < lg.pts.length; i++) {
                    const a = lg.pts[i - 1], c = lg.pts[i];
                    const seg = Math.hypot(c.x - a.x, c.y - a.y);
                    const steps = Math.max(1, Math.ceil(seg / 25));
                    for (let s = 0; s < steps; s++) {
                        const f = s / steps;
                        const x = a.x + (c.x - a.x) * f, y = a.y + (c.y - a.y) * f;
                        const hd = Math.atan2(c.x - a.x, -(c.y - a.y));
                        const wd = getWindAt(x, y).direction;
                        let d = hd - wd; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
                        const twa = Math.abs(d);
                        const bi = Math.min(bands - 1, Math.floor(bands * (acc + seg * f) / total));
                        const P = per[bi];
                        P.n++; P.twaSum += twa;
                        if (twa < 0.62) P.nogo++;          // inside the no-go: polar is ~0
                        if (twa < 0.75) P.tight++;         // at or inside close-hauled
                        if (twa < P.worst) P.worst = twa;
                    }
                    acc += seg;
                }
                out.push({ leg: L, len: Math.round(total), per });
            }
            return out;
        }, 9100 + t);

        console.log(`\n=== ${VENUE.toUpperCase()} seed ${9100 + t}: TWA OF THE RULER ITSELF ===`);
        for (const L of r) {
            const tot = L.per.reduce((a, x) => a + x.n, 0) || 1;
            const ng = L.per.reduce((a, x) => a + x.nogo, 0), tg = L.per.reduce((a, x) => a + x.tight, 0);
            console.log(`  leg ${L.leg}  len ${L.len}u   INSIDE THE NO-GO ${(100 * ng / tot).toFixed(1)}%   at-or-inside close-hauled ${(100 * tg / tot).toFixed(1)}%`);
            if (ng > 0 || tg > 0) {
                console.log(`     band:  ` + L.per.map((x, i) => `${i * 10}-${i * 10 + 10}:${(100 * x.nogo / (x.n || 1)).toFixed(0)}%`).join('  '));
                console.log(`     min |TWA| by band: ` + L.per.map(x => (x.worst * 180 / Math.PI).toFixed(0)).join(' '));
            }
        }
    }
    await br.close();
})();
