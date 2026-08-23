// LATCH-THRASH MICRO-STRUCTURE (2026-08-23, sub-1.5x push — SIZES E2 BEFORE
// BUILDING). For every floe-contact episode (0.5s dedup): WHICH floe (nearest
// hull), and for every RE-HIT (<=10s after the prior episode on that boat):
//   sameFloe    — same floe object as the previous episode?
//   clrAtExp    — clearance to the previous floe when iceEscapeTimer expired
//   backTurn    — within 3s after escape expiry, did desiredHeading point back
//                 to within 60deg of the contacted floe's centre?
//   dtPrev      — seconds since the previous episode's last contact
//   escPeak     — max clearance to the contacted floe reached between the two
//                 episodes (did the escape ever actually leave the ice?)
// Fleet arctic, __CHAR unset (rule 18b).
//   node _latch_micro.js <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 4;
const SEED0 = parseInt(process.argv[3]) || 9400;
const ROOT = path.join(__dirname, process.argv[4] || 'treeBOTH3');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic' })); });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const HITS = [];
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const r = await page.evaluate(async (seed) => {
            const segD = (px, py, ax, ay, bx, by) => {
                const dx = bx - ax, dy = by - ay; const L2 = dx * dx + dy * dy;
                let t = L2 ? ((px - ax) * dx + (py - ay) * dy) / L2 : 0; t = Math.max(0, Math.min(1, t));
                return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
            };
            const floeClr2 = (f, px, py) => {
                if (!f.localHull || !f.localHull.length) return Math.hypot(px - f.x, py - f.y) - (f.radius || 0);
                const c = Math.cos(f.spin || 0), s = Math.sin(f.spin || 0);
                const pts = f.localHull.map(p => [f.x + p.x * c - p.y * s, f.y + p.x * s + p.y * c]);
                let best = Infinity;
                for (let i2 = 0; i2 < pts.length; i2++) {
                    const a = pts[i2], b = pts[(i2 + 1) % pts.length];
                    best = Math.min(best, segD(px, py, a[0], a[1], b[0], b[1]));
                }
                return best;
            };
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(b => b.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
            const floes = (state.course.islands || []).filter(i2 => i2.isFloe);
            floes.forEach((f, idx) => { f._lmId = idx; });
            const hits = [];
            const lastC = new Map();   // boat id -> t of last contact (dedup)
            const prevEp = new Map();  // boat id -> {floeId, tEnd, escExpT, clrAtExp, escPeak, backTurn}
            const track = new Map();   // boat id -> live tracking of the gap after an episode
            const norm = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
            // v2: threshold 20 -> 60 (v1 left 51% of episodes fid-null — the
            // event carries no island ref and the hull approx runs wide; at a
            // contact the boat is ON the hull, so 60u is identification, not
            // attribution). Rule 18 audit caught v1's sameFloe=10% headline
            // reading 57% on the valid subset.
            const nearestFloeId = (x, y) => {
                let best = 60, id = null;
                for (const f of floes) {
                    if (Math.hypot(x - f.x, y - f.y) > (f.radius || 0) + 120) continue;
                    const d = floeClr2(f, x, y);
                    if (d < best) { best = d; id = f._lmId; }
                }
                return id;
            };
            const inner = window.onRaceEvent;
            window.onRaceEvent = (ty, d) => {
                try {
                    if (d && d.boat && !d.boat.isPlayer && ty === 'collision_island' && d.isFloe
                        && state.race.status === 'racing') {
                        const bt = d.boat, t = state.race.timer;
                        if (t - (lastC.get(bt.id) || -99) > 0.5) {
                            const fid = nearestFloeId(bt.x, bt.y);
                            const tr = track.get(bt.id);
                            const rec = { seed, n: bt.name, t: +t.toFixed(1), fid,
                                leg: bt.raceState.leg, rehit: 0 };
                            if (tr && t - tr.tEnd <= 10.0) {
                                rec.rehit = 1;
                                rec.sameFloe = (fid != null && fid === tr.floeId) ? 1 : 0;
                                rec.dtPrev = +(t - tr.tEnd).toFixed(1);
                                rec.clrAtExp = tr.clrAtExp == null ? null : Math.round(tr.clrAtExp);
                                rec.escPeak = Math.round(tr.escPeak);
                                rec.backTurn = tr.backTurn ? 1 : 0;
                            }
                            hits.push(rec);
                            track.set(bt.id, { floeId: fid, tEnd: t, clrAtExp: null,
                                escPeak: -99, backTurn: 0, expT: null });
                        }
                        lastC.set(bt.id, t);
                        const tr2 = track.get(bt.id); if (tr2) tr2.tEnd = t;
                    }
                } catch (e) {}
                return inner && inner(ty, d);
            };
            const dt = 1 / 60;
            for (let it = 0; it < 60 * 900; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                const t = state.race.timer;
                if (t > 880) break;
                for (const bt of state.boats) {
                    if (bt.isPlayer || bt.raceState.finished) continue;
                    const c = bt.controller; if (!c) continue;
                    const tr = track.get(bt.id);
                    if (!tr || tr.floeId == null || t - tr.tEnd > 12) continue;
                    const f = floes[tr.floeId];
                    const clr = floeClr2(f, bt.x, bt.y);
                    tr.escPeak = Math.max(tr.escPeak, clr);
                    const escOn = (c.iceEscapeTimer || 0) > 0;
                    if (escOn) tr.expT = null;             // still escaping
                    else if (tr.expT == null) { tr.expT = t; tr.clrAtExp = clr; }
                    if (tr.expT != null && t - tr.expT <= 3.0) {
                        const hD = c.targetHeading != null ? c.targetHeading : bt.heading;
                        const brg = Math.atan2(f.x - bt.x, -(f.y - bt.y));
                        if (Math.abs(norm(hD - brg)) < Math.PI / 3) tr.backTurn = 1;
                    }
                }
            }
            return hits;
        }, seed);
        HITS.push(...r);
        console.log(`seed ${seed}: ${r.length} contact episodes (${r.filter(x => x.rehit).length} re-hits)`);
    }
    await browser.close();
    const nb = TRIALS * 9;
    const R = HITS.filter(h => h.rehit);
    console.log(`\n=== LATCH-THRASH MICRO (${TRIALS} seeds, ${path.basename(ROOT)}) ===`);
    console.log(`episodes ${HITS.length} (${(HITS.length / nb).toFixed(2)}/boat), re-hits ${R.length} (${(100 * R.length / HITS.length).toFixed(0)}% of episodes)`);
    const q = (a, p) => { const s = a.filter(x => x != null).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length * p)] : NaN; };
    console.log(`re-hit: sameFloe ${R.filter(x => x.sameFloe).length}/${R.length} (${(100 * R.filter(x => x.sameFloe).length / R.length).toFixed(0)}%)   dtPrev p25/med/p75: ${q(R.map(x => x.dtPrev), .25)}/${q(R.map(x => x.dtPrev), .5)}/${q(R.map(x => x.dtPrev), .75)}s`);
    console.log(`clr at escape expiry p25/med/p75: ${q(R.map(x => x.clrAtExp), .25)}/${q(R.map(x => x.clrAtExp), .5)}/${q(R.map(x => x.clrAtExp), .75)}u   escPeak p25/med/p75: ${q(R.map(x => x.escPeak), .25)}/${q(R.map(x => x.escPeak), .5)}/${q(R.map(x => x.escPeak), .75)}u`);
    console.log(`backTurn within 3s of expiry: ${R.filter(x => x.backTurn).length}/${R.length} (${(100 * R.filter(x => x.backTurn).length / R.length).toFixed(0)}%)`);
    fs.writeFileSync(path.join(__dirname, `_latch_micro_${path.basename(ROOT)}.json`), JSON.stringify(HITS, null, 1));
    console.log('wrote JSON');
})();
