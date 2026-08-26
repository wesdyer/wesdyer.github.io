// SWAMP CORRIDOR GEOMETRY (2026-08-25, the swamp push, P1).
//
// The planned clean line THREADS weed corridors. Before building anything,
// measure the corridors themselves, along BOTH planned lines the boats use:
//   (a) the DMC leg line (the authored ideal),
//   (b) a live grid-router path start->goal (what gridPath actually is).
// Per 50u sample along each path:
//   - clean HALF-WIDTH each side: largest lateral offset (25u steps, to 300u)
//     with every mul >= 0.9 on the way out; also distance to first mul < 0.35
//     (the can't-restart weed).
//   - CHORD TEST: min mul along the straight chord from this sample to the
//     sample LOOK(=420)u further along the path, vs min mul ON the path arc
//     between them. Pure pursuit sails toward the chord; if chords are dirty
//     where the path is clean, route-following geometry is the machine.
// Reports the width distribution, % of path in narrow corridor, and the
// chord-vs-arc weed comparison at LOOK = 250 / 420 / 900.
//
// ⚠️ mul semantics: shoalField returns a MULTIPLIER, 1.0 = clean.
//   node _sw_corridor.js [tree] [venue]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const ROOT = path.join(__dirname, process.argv[2] || 'treeSW0');
const VENUE = process.argv[3] || 'swamp';
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const out = await page.evaluate(() => {
        window.evalHarness.seed = 12345;
        window.resetGame(); window.startRace();
        const mulAt = (x, y) => window.VenueDoc.shoalField(state.course.islands, x, y);
        const sampleLine = (ax, ay, bx, by, step) => {
            const d = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.ceil(d / step));
            let m = 1;
            for (let i = 0; i <= n; i++) m = Math.min(m, mulAt(ax + (bx - ax) * i / n, ay + (by - ay) * i / n));
            return m;
        };
        const analyse = (pts, label) => {
            // resample to 50u
            const rs = [];
            for (let i = 0; i < pts.length - 1; i++) {
                const a = pts[i], b = pts[i + 1];
                const d = Math.hypot(b.x - a.x, b.y - a.y), n = Math.max(1, Math.round(d / 50));
                for (let k = 0; k < n; k++) rs.push({ x: a.x + (b.x - a.x) * k / n, y: a.y + (b.y - a.y) * k / n });
            }
            rs.push(pts[pts.length - 1]);
            const rows = [];
            for (let i = 0; i < rs.length; i++) {
                const p = rs[i];
                const pn = rs[Math.min(i + 1, rs.length - 1)], pp = rs[Math.max(i - 1, 0)];
                let tx = pn.x - pp.x, ty = pn.y - pp.y;
                const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
                const nx = -ty, ny = tx;
                const half = (sgn) => {
                    let w = 0;
                    for (let off = 25; off <= 300; off += 25) {
                        if (mulAt(p.x + nx * off * sgn, p.y + ny * off * sgn) < 0.9) break;
                        w = off;
                    }
                    return w;
                };
                const hard = (sgn) => {
                    for (let off = 25; off <= 300; off += 25) {
                        if (mulAt(p.x + nx * off * sgn, p.y + ny * off * sgn) < 0.35) return off;
                    }
                    return 301;
                };
                rows.push({ x: Math.round(p.x), y: Math.round(p.y),
                            mul: +mulAt(p.x, p.y).toFixed(2),
                            wL: half(-1), wR: half(1), hardL: hard(-1), hardR: hard(1) });
            }
            // chord tests
            const chords = {};
            for (const LOOK of [250, 420, 900]) {
                const c = [];
                const skip = Math.round(LOOK / 50);
                for (let i = 0; i + skip < rs.length; i += 2) {
                    const a = rs[i], b = rs[i + skip];
                    const chordMul = sampleLine(a.x, a.y, b.x, b.y, 25);
                    let arcMul = 1;
                    for (let k = i; k <= i + skip; k++) arcMul = Math.min(arcMul, mulAt(rs[k].x, rs[k].y));
                    c.push({ chord: +chordMul.toFixed(2), arc: +arcMul.toFixed(2) });
                }
                chords[LOOK] = c;
            }
            return { label, rows, chords };
        };
        const res = [];
        // (a) DMC legs
        const legs = state.course.dmc && state.course.dmc.legs || [];
        for (let li = 1; li < legs.length; li++) {
            if (legs[li] && legs[li].pts && legs[li].pts.length >= 2) res.push(analyse(legs[li].pts, 'dmc-leg' + li));
        }
        // (b) live router path start->each leg goal
        const g = state.course.botGrid;
        if (g && window.SailCheck && legs.length > 1) {
            for (let li = 1; li < legs.length; li++) {
                const L = legs[li];
                const a = L.pts[0], b = L.pts[L.pts.length - 1];
                try {
                    const seg = window.SailCheck.pathSailable(g, [a.x, a.y], [b.x, b.y]);
                    if (seg && seg.length >= 2) res.push(analyse(seg.map(p => ({ x: p[0] != null && Array.isArray(p) ? p[0] : p.x, y: Array.isArray(p) ? p[1] : p.y })), 'grid-leg' + li));
                } catch (e) { res.push({ label: 'grid-leg' + li, err: String(e).slice(0, 120) }); }
            }
        }
        return res;
    });
    const q = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(p * (s.length - 1))] : NaN; };
    const pct = (n, d) => d ? (100 * n / d).toFixed(0) + '%' : '-';
    for (const r of out) {
        if (r.err) { console.log(`${r.label}: ERR ${r.err}`); continue; }
        const rows = r.rows;
        const onPathWeed = rows.filter(x => x.mul < 0.9).length;
        const minW = rows.map(x => Math.min(x.wL, x.wR));
        const width = rows.map(x => x.wL + x.wR);
        const minHard = rows.map(x => Math.min(x.hardL, x.hardR));
        console.log(`\n== ${r.label}: ${rows.length} samples (${rows.length * 50}u), on-path mul<0.9: ${pct(onPathWeed, rows.length)}`);
        console.log(`   corridor FULL width p10/p25/p50: ${q(width, .1)}/${q(width, .25)}/${q(width, .5)}u   min-side half-width p10/p25/p50: ${q(minW, .1)}/${q(minW, .25)}/${q(minW, .5)}u`);
        console.log(`   dist to HARD weed (mul<0.35) p10/p25/p50: ${q(minHard, .1)}/${q(minHard, .25)}/${q(minHard, .5)}u  (301=none within 300)`);
        console.log(`   narrow share: half-width<=50u ${pct(minW.filter(w => w <= 50).length, rows.length)}, <=100u ${pct(minW.filter(w => w <= 100).length, rows.length)}, hard<=100u ${pct(minHard.filter(w => w <= 100).length, rows.length)}`);
        for (const LOOK of [250, 420, 900]) {
            const c = r.chords[LOOK];
            const dirty = c.filter(x => x.chord < 0.7 && x.arc >= 0.9).length;
            const both = c.filter(x => x.chord < 0.7).length;
            console.log(`   chord ${LOOK}u: chord-dirty-while-arc-clean ${pct(dirty, c.length)} of ${c.length}; chord mul<0.7 at all ${pct(both, c.length)}; chord mul p25/p50 ${q(c.map(x => x.chord), .25).toFixed(2)}/${q(c.map(x => x.chord), .5).toFixed(2)}`);
        }
    }
    fs.writeFileSync(path.join(__dirname, '_sw_corridor.json'), JSON.stringify(out));
    console.log('\nrows → _sw_corridor.json');
    await browser.close();
})();
