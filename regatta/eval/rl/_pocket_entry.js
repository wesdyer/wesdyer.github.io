// GLOW POCKET ENTRY GEOMETRY (2026-08-21, wedge push brief 1c): 48% of
// glowtide's wedge entries land in one ~600u pocket. For every boat that
// ENTERS the pocket box on a racing leg: entry pose, role/risk/dev, the
// nearest rival's range and SIDE (relative bearing sign — was she pushed
// in from the outside?), and whether she wedges (sub-1kt >= 3s) inside
// within 15s. Census: pass-throughs vs wedgers, and the rival geometry
// that separates them.
//   node _pocket_entry.js <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 4;
const SEED0 = parseInt(process.argv[3]) || 9400;
const ROOT = path.join(__dirname, process.argv[4] || 'treeGWE');
const BOX = { x0: -450, x1: 150, y0: -1950, y1: -1050 };
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'glowtide' })); });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const all = [];
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const rows = await page.evaluate(async ({ seed, BOX }) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(b => b.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
            const inBox = (x, y) => x >= BOX.x0 && x <= BOX.x1 && y >= BOX.y0 && y <= BOX.y1;
            const st = new Map();   // id -> {in, entry, slowT, wedged}
            const out = [];
            const dt = 1 / 60; let it = 0;
            while (it < 900 * 60) {
                if (state.race.status === 'racing' && state.boats.every(bb => bb.isPlayer || bb.raceState.finished)) break;
                update(dt); it++;
                if (state.race.status !== 'racing' || (it % 3)) continue;
                for (const bt of state.boats) {
                    if (bt.isPlayer || bt.raceState.finished || bt.raceState.leg < 1) continue;
                    let s = st.get(bt.id) || { in: false, entry: null, slowT: 0 };
                    const now = inBox(bt.x, bt.y);
                    if (now && !s.in) {
                        // ENTRY: capture the geometry
                        const c = bt.controller || {};
                        let rng = Infinity, rb = null;
                        for (const ob of state.boats) {
                            if (ob === bt || ob.isPlayer || ob.raceState.finished) continue;
                            const d = Math.hypot(ob.x - bt.x, ob.y - bt.y);
                            if (d < rng) { rng = d; rb = ob; }
                        }
                        let relBrgDeg = null;
                        if (rb) {
                            const brg = Math.atan2(rb.x - bt.x, -(rb.y - bt.y));
                            let rel = (brg - bt.heading) % (Math.PI * 2);
                            if (rel > Math.PI) rel -= Math.PI * 2;
                            if (rel < -Math.PI) rel += Math.PI * 2;
                            relBrgDeg = Math.round(rel * 57.3);
                        }
                        s.entry = { t: +state.race.timer.toFixed(1), leg: bt.raceState.leg,
                                    hDeg: Math.round(((bt.heading * 57.3) % 360 + 360) % 360),
                                    kt: +(bt.speed * 4).toFixed(1),
                                    role: c.avoidanceRole || '-',
                                    dev: Math.round((c.lastAvoidDeviation || 0) * 57.3),
                                    rng: rng === Infinity ? null : Math.round(rng),
                                    relBrgDeg,
                                    n: bt.name };
                        s.entryIt = it; s.slowT = 0; s.wedged = false;
                    }
                    if (now && s.entry) {
                        const slowNow = (bt.speed * 4) < 1.0;
                        s.slowT = slowNow ? s.slowT + 3 / 60 : 0;
                        if (s.slowT >= 3) s.wedged = true;
                    }
                    if (!now && s.in && s.entry) {
                        out.push({ ...s.entry, wedged: s.wedged ? 1 : 0,
                                   dwellS: +((it - s.entryIt) / 60).toFixed(1) });
                        s.entry = null;
                    }
                    s.in = now;
                    st.set(bt.id, s);
                }
            }
            for (const [id, s] of st) if (s.in && s.entry)
                out.push({ ...s.entry, wedged: s.wedged ? 1 : 0, dwellS: null });
            return out;
        }, { seed, BOX });
        for (const r of rows) { r.seed = seed; all.push(r); }
        console.log(`seed ${seed}: ${rows.length} pocket entries, ${rows.filter(r => r.wedged).length} wedged`);
    }
    await browser.close();
    const w = all.filter(r => r.wedged), p = all.filter(r => !r.wedged);
    console.log(`\n${all.length} pocket entries — ${w.length} wedge (${(100 * w.length / all.length).toFixed(0)}%), ${p.length} pass through`);
    const q = (a, pp) => { a = [...a].sort((x, y) => x - y); return a[Math.floor(a.length * pp)]; };
    const line = (tag, g) => {
        if (!g.length) return;
        console.log(`${tag}: n=${g.length} entry-kt med ${q(g.map(r => r.kt), .5)} | dev>2° at entry: ${g.filter(r => r.dev > 2).length} | rival<200u: ${g.filter(r => r.rng != null && r.rng < 200).length} | dwell med ${q(g.map(r => r.dwellS).filter(x => x != null), .5)}s`);
    };
    line('WEDGERS ', w);
    line('PASSERS ', p);
    const sides = w.filter(r => r.relBrgDeg != null && r.rng < 300);
    console.log('wedgers with rival<300 at entry:', sides.length,
        '| rival on the OUTSIDE (|relBrg|>90°, pushing her in):', sides.filter(r => Math.abs(r.relBrgDeg) > 90).length);
    fs.writeFileSync(path.join(__dirname, '_pocket_glow.json'), JSON.stringify(all));
    console.log('rows → _pocket_glow.json');
})();
