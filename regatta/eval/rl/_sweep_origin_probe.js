// WHERE DOES THE WRONG-WAY SWEEP COME FROM?
//
// The hairpin probe says every long bay rounding (8 of 98 at >=10s, costing
// 12-43s each) arms with NEGATIVE accumulated sweep — between -0.45 and -4.07
// rad — and then pays to unwind it. `roundSweep` accumulates from the moment the
// leg starts, not from the zone, so the negative balance could be either:
//   (a) an artefact of the BEAT — bearing wobble accumulated far from the mark
//       while tacking up the leg, in which case the boat is being charged for
//       ordinary sailing, or
//   (b) a real WRONG-SIDE PASS close in, in which case the boat genuinely has to
//       go back around and the fix belongs in the approach.
// The two want opposite fixes, so measure before designing.
//
// Samples each boat's sweep as it crosses inward through 6x, 4x, 3x, 2x, 1.5x
// and 1x zone radius on every rounding leg, and reports the distribution split
// by whether that rounding ended up long.
//
// node _sweep_origin_probe.js <trials> <seed0> <tree> [venue]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 8;
const SEED0 = parseInt(process.argv[3]) || 9100;
const ROOT = path.join(__dirname, process.argv[4] || 'treeA');
const VENUE = process.argv[5] || 'bay';

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript((v) => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: v }));
    }, VENUE);
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });

    const all = [];
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const r = await page.evaluate(async (seed) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const bots = state.boats.filter(b => !b.isPlayer);
            const pl = state.boats.find(b => b.isPlayer); pl.x = 5900; pl.y = -6100;
            const RINGS = [6, 4, 3, 2, 1.5, 1];
            const st = bots.map(() => ({ leg: -1, ring: 0, at: {}, armT: null, need: 0 }));
            const out = [];
            const dt = 1 / 60;
            for (let it = 0; it < 60 * 940; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                if (state.race.timer > 900) break;
                for (let k = 0; k < bots.length; k++) {
                    const b = bots[k], rs = b.raceState, s = st[k];
                    if (rs.finished) continue;
                    const rm = (typeof legRoundMark === 'function' ? legRoundMark(rs.leg) : null)
                        || state.course.roundMark;
                    if (!rm) continue;
                    if (s.leg !== rs.leg) {   // new leg: reset the ring walk
                        if (s.leg >= 0 && s.armT != null)
                            out.push({ name: b.name, leg: s.leg, at: s.at, xt: s.xt, md: s.md,
                                       armT: s.armT, armSweep: s.armSweep, need: s.need,
                                       dur: state.race.timer - s.armT });
                        s.leg = rs.leg; s.ring = 0; s.at = {}; s.armT = null; s.armSweep = null;
                        s.need = rm.reqSweep * (typeof ROUND_SWEEP_TOL !== 'undefined' ? ROUND_SWEEP_TOL : 1);
                    }
                    const d = Math.hypot(b.x - rm.x, b.y - rm.y) / rm.zone;
                    while (s.ring < RINGS.length && d <= RINGS[s.ring]) {
                        // Sweep is only half the question: WHERE is the boat relative
                        // to the ruler when it fails to bank any? Record cross-track
                        // from the DMC leg, ruler-vs-far mode, and speed too.
                        const c = b.controller || {};
                        const leg = state.course.dmc && state.course.dmc.legs
                            ? state.course.dmc.legs[rs.leg] : null;
                        let xt = null;
                        if (leg && leg.pts && leg.pts.length > 1) {
                            const sp = CoursePath.project(leg, b.x, b.y, null);
                            const cum = leg.cum, pts = leg.pts;
                            let q = 1;
                            while (q < cum.length - 1 && cum[q] < sp) q++;
                            const tt = (sp - cum[q - 1]) / Math.max(1e-6, cum[q] - cum[q - 1]);
                            const px = pts[q - 1].x + (pts[q].x - pts[q - 1].x) * tt;
                            const py = pts[q - 1].y + (pts[q].y - pts[q - 1].y) * tt;
                            xt = Math.round(Math.hypot(b.x - px, b.y - py));
                        }
                        s.at[RINGS[s.ring]] = +(rs.roundSweep || 0).toFixed(2);
                        s.xt = s.xt || {}; s.xt[RINGS[s.ring]] = xt;
                        s.md = s.md || {}; s.md[RINGS[s.ring]] = (c._rulerMode ? 'R' : 'F') + (+(b.speed * 60).toFixed(0));
                        s.ring++;
                    }
                    if (s.armT == null && rs.roundArmed) {
                        s.armT = state.race.timer;
                        s.armSweep = +(rs.roundSweep || 0).toFixed(2);
                    }
                }
            }
            return out;
        }, seed);
        all.push(...r.map(x => ({ ...x, seed })));
        console.log(`seed ${seed}: ${r.length} roundings`);
    }
    await browser.close();

    const done = all.filter(r => r.armSweep != null && r.dur != null);
    const long = done.filter(r => r.dur >= 10), quick = done.filter(r => r.dur < 10);
    const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
    const fmt = (set, ring) => {
        const v = set.map(r => r.at[ring]).filter(x => x != null);
        if (!v.length) return '   n/a';
        const neg = v.filter(x => x < -0.3).length;
        return `${med(v).toFixed(2).padStart(6)} (${String(Math.round(100 * neg / v.length)).padStart(3)}% below -0.3)`;
    };
    console.log(`\nSWEEP ORIGIN — ${VENUE}, ${TRIALS} seeds, ${done.length} roundings (${long.length} long >=10s)`);
    console.log('  median accumulated sweep as the boat crosses inward:');
    for (const ring of [6, 4, 3, 2, 1.5, 1]) {
        console.log(`   ${String(ring).padStart(3)}x zone   LONG ${fmt(long, ring)}   QUICK ${fmt(quick, ring)}`);
    }
    console.log(`  at ARM      LONG ${med(long.map(r => r.armSweep)).toFixed(2)}   QUICK ${med(quick.map(r => r.armSweep)).toFixed(2)}`);
    console.log('  median CROSS-TRACK from the ruler at the same rings:');
    for (const ring of [4, 3, 2, 1.5, 1]) {
        const g = set => { const v = set.map(r => r.xt && r.xt[ring]).filter(x => x != null); return v.length ? med(v).toFixed(0) : 'n/a'; };
        console.log(`   ${String(ring).padStart(3)}x zone   LONG ${String(g(long)).padStart(5)}u   QUICK ${String(g(quick)).padStart(5)}u`);
    }
    const modeAt = (set, ring) => {
        const m = {};
        for (const r of set) { const v = r.md && r.md[ring]; if (v) m[v[0]] = (m[v[0]] || 0) + 1; }
        return Object.entries(m).map(([k, v]) => `${k}${v}`).join('/');
    };
    console.log(`  ruler(R)/far(F) mode at 2x: LONG ${modeAt(long, 2)}  QUICK ${modeAt(quick, 2)}`);
    console.log(`  need        ${med(done.map(r => r.need)).toFixed(2)}`);
    console.log(`  duration    LONG med ${med(long.map(r => r.dur)).toFixed(1)}s   QUICK med ${med(quick.map(r => r.dur)).toFixed(1)}s`);
    fs.writeFileSync(path.join(__dirname, `sweep_origin_${VENUE}.json`), JSON.stringify(all));
    console.log(`\nwrote sweep_origin_${VENUE}.json`);
})();
