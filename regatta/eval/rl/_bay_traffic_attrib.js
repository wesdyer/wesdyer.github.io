// BAY EXCESS-DISTANCE ATTRIBUTION — the bay analogue of `_transit_probe.js`.
//
// The density measurement says bay's largest remaining bin is traffic (~15s of
// the ~25s per-leg gap; L1 alone swings 9.6s between 2 boats and 9) and that it
// is spent in AVOIDANCE, not wind shadow. That is a diagnosis, not a bin table.
// This produces the bin table, in the same shape the arctic transit work used,
// so the next candidate can be aimed instead of guessed.
//
// Per boat, per 1-second window, on every leg:
//   odoW   = odometer this second        dispW = straight-line displacement
//   dsW    = progress along the DMC leg path
// so  weave   = odoW - dispW      (curvature burned inside the second)
//     lateral = dispW - max(dsW,0) (movement that was not progress)
// and each window is owned by ONE mode, priority order:
//   rec   = wiggle / clearance / liveness force|recovery
//   turn  = board flip, or >57 deg of heading swing this second
//   avoid = applyAvoidance bent the heading >0.12 rad on average
//   offrt = >300u cross-track from the DMC line
//   sail  = none of the above
// Sampling is read-only at frame boundaries; the race is byte-identical to an
// uninstrumented run.
//
// node _bay_traffic_attrib.js <trials> <seed0> <tree> [nBoats] [label]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 8;
const SEED0 = parseInt(process.argv[3]) || 9100;
const ROOT = path.join(__dirname, process.argv[4] || 'treeA');
const NBOATS = parseInt(process.argv[5] || '0');
const LABEL = process.argv[6] || null;
const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(() => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'bay' }));
    });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });

    const rows = [];
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const r = await page.evaluate(async ([seed, NB]) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            let bots = state.boats.filter(b => !b.isPlayer);
            const pl = state.boats.find(b => b.isPlayer); if (pl) { pl.x = 5900; pl.y = -6100; }
            if (NB > 0 && NB < bots.length) {
                bots.slice(NB).forEach((b, i2) => { b.x = 9000 + i2 * 150; b.y = -9000; b.raceState.finished = true; });
                bots = bots.slice(0, NB);
            }
            const st = bots.map(b => ({
                leg: -1, px: b.x, py: b.y, ph: b.heading, hint: null,
                odo: 0, swing: 0, avoid: 0, n: 0, flip: 0, tk: null,
                sPrev: null, wx: b.x, wy: b.y, out: [],
            }));
            const dt = 1 / 60;
            let lastSec = -1;
            for (let it = 0; it < 60 * 940; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                if (state.race.timer > 900) break;
                const sec = Math.floor(state.race.timer);
                for (let k = 0; k < bots.length; k++) {
                    const b = bots[k], s = st[k], c = b.controller || {};
                    if (b.raceState.finished) continue;
                    if (s.leg !== b.raceState.leg) { s.leg = b.raceState.leg; s.hint = null; s.sPrev = null; }
                    s.odo += Math.hypot(b.x - s.px, b.y - s.py);
                    s.swing += Math.abs(normalizeAngle(b.heading - s.ph));
                    s.px = b.x; s.py = b.y; s.ph = b.heading;
                    if (it % 6 === 0) {
                        s.avoid += Math.abs(c.lastAvoidDeviation || 0); s.n++;
                        const w = getWindAt(b.x, b.y);
                        const tk = normalizeAngle(b.heading - w.direction) > 0 ? 1 : -1;
                        if (s.tk != null && tk !== s.tk) s.flip++;
                        s.tk = tk;
                    }
                }
                if (sec !== lastSec && lastSec >= 0) {
                    for (let k = 0; k < bots.length; k++) {
                        const b = bots[k], s = st[k], c = b.controller || {};
                        if (b.raceState.finished || s.leg < 1) { s.odo = 0; s.swing = 0; s.avoid = 0; s.n = 0; s.flip = 0; s.wx = b.x; s.wy = b.y; continue; }
                        const leg = state.course.dmc && state.course.dmc.legs ? state.course.dmc.legs[s.leg] : null;
                        let ds = 0, xt = 0;
                        if (leg && leg.pts && leg.pts.length > 1) {
                            const sp = CoursePath.project(leg, b.x, b.y, s.hint);
                            if (s.sPrev != null) ds = sp - s.sPrev;
                            s.sPrev = sp; s.hint = sp;
                            const cum = leg.cum, pts = leg.pts;
                            let q = 1; while (q < cum.length - 1 && cum[q] < sp) q++;
                            const tt = (sp - cum[q - 1]) / Math.max(1e-6, cum[q] - cum[q - 1]);
                            xt = Math.hypot(b.x - (pts[q - 1].x + (pts[q].x - pts[q - 1].x) * tt),
                                            b.y - (pts[q - 1].y + (pts[q].y - pts[q - 1].y) * tt));
                        }
                        const disp = Math.hypot(b.x - s.wx, b.y - s.wy);
                        const mode = (c.wiggleActive || c.clearanceTimer > 0 || c.livenessState === 'force' || c.livenessState === 'recovery') ? 'rec'
                            : (s.flip > 0 || s.swing > 1.0) ? 'turn'
                            : (s.n && s.avoid / s.n > 0.12) ? 'avoid'
                            : (xt > 300) ? 'offrt' : 'sail';
                        s.out.push({ leg: s.leg, mode, excess: s.odo - Math.max(0, ds),
                                     weave: s.odo - disp, lateral: disp - Math.max(0, ds) });
                        s.odo = 0; s.swing = 0; s.avoid = 0; s.n = 0; s.flip = 0; s.wx = b.x; s.wy = b.y;
                    }
                }
                lastSec = sec;
            }
            return st.flatMap(s => s.out);
        }, [seed, NBOATS]);
        rows.push(...r);
        console.log(`seed ${seed}: ${r.length} boat-seconds`);
    }
    await browser.close();

    const modes = ['rec', 'turn', 'avoid', 'offrt', 'sail'];
    console.log(`\nBAY EXCESS ATTRIBUTION — ${TRIALS} seeds, ${NBOATS || 9} boats, ${rows.length} boat-seconds`);
    console.log('  leg |  ' + modes.map(m => m.padStart(6)).join(' ') + '  |  seconds by mode');
    for (let L = 1; L <= 6; L++) {
        const R = rows.filter(r => r.leg === L);
        if (!R.length) continue;
        const ex = {}, secs = {};
        for (const m of modes) {
            const S = R.filter(r => r.mode === m);
            ex[m] = S.reduce((a, r) => a + r.excess, 0) / Math.max(1, TRIALS * (NBOATS || 9));
            secs[m] = S.length / Math.max(1, TRIALS * (NBOATS || 9));
        }
        console.log(`  L${L}  |  ` + modes.map(m => String(Math.round(ex[m])).padStart(6)).join(' ') +
                    `  |  ` + modes.map(m => `${m} ${secs[m].toFixed(0)}s`).join(' '));
    }
    const tot = {};
    for (const m of modes) tot[m] = rows.filter(r => r.mode === m).reduce((a, r) => a + r.excess, 0) / Math.max(1, TRIALS * (NBOATS || 9));
    console.log('  ALL |  ' + modes.map(m => String(Math.round(tot[m])).padStart(6)).join(' ') +
                `  |  total excess ${Math.round(modes.reduce((a, m) => a + tot[m], 0))}u per boat-race`);
    const w = rows.reduce((a, r) => a + r.weave, 0) / Math.max(1, TRIALS * (NBOATS || 9));
    const l = rows.reduce((a, r) => a + r.lateral, 0) / Math.max(1, TRIALS * (NBOATS || 9));
    console.log(`  form: weave ${Math.round(w)}u vs lateral ${Math.round(l)}u`);
    if (LABEL) { fs.writeFileSync(path.join(__dirname, `bay_traffic_${LABEL}.json`), JSON.stringify(rows)); console.log(`\nwrote bay_traffic_${LABEL}.json`); }
})();
