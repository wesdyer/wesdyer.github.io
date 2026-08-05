// DO THE BOATS ACTUALLY ROUND THE MARKS?
//
// Owner report: "bots cheat — they don't actually round rounding marks and it
// gets counted, and they've figured out that they can do that."
//
// The completion test is `roundSweep >= reqSweep * ROUND_SWEEP_TOL` with
// ROUND_SWEEP_TOL = 0.75 — a rounding completes at 75% of the geometric
// requirement, which on bay's hairpin is 137 degrees against a needed 183. And
// the AI TARGETS that discounted number: `reqSweep * ROUND_SWEEP_TOL` appears in
// the bot's own outbound/exit logic, so the boats are not exploiting a gap they
// found, they were told to stop at 75%.
//
// The rule has no tolerance. RRS "Sail the Course": *a string representing her
// track, when drawn taut, passes each mark of the course on the required side.*
//
// This measures the gap between the two. For every completed rounding it records:
//   sweptFrac  the sweep actually banked, as a fraction of the FULL reqSweep
//   minDist    how close the boat ever got to the mark (in zone radii)
//   sideOK     the STRING-RULE test: walking the track from leg start to leg end,
//              does the mark stay on the required side of the taut line? Computed
//              as the total signed bearing sweep about the mark over the whole
//              leg — the taut string passes on the required side exactly when
//              that total reaches the geometric requirement, so this is the same
//              quantity the engine uses WITHOUT the 0.75 discount.
//
// node _rounding_truth_probe.js <trials> <seed0> <tree> [venue]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 8;
const SEED0 = parseInt(process.argv[3]) || 9100;
const ROOT = path.join(__dirname, process.argv[4] || 'treeA');
const VENUE = process.argv[5] || 'bay';
const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };

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
        const r = await page.evaluate(async ([seed, venue]) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const bots = state.boats.filter(b => !b.isPlayer);
            const pl = state.boats.find(b => b.isPlayer);
            if (pl) { pl.x = venue === 'arctic' ? -4500 : 5900; pl.y = venue === 'arctic' ? 4700 : -6100; }
            const st = bots.map(() => ({ leg: -1, minD: 1e9, sweep: 0, prevA: null, need: 0, req: 0, zone: 1 }));
            const out = [];
            const dt = 1 / 60;
            for (let it = 0; it < 60 * 940; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                if (state.race.timer > 900) break;
                for (let k = 0; k < bots.length; k++) {
                    const b = bots[k], rs = b.raceState, s = st[k];
                    if (rs.finished && s.leg < 0) continue;
                    const rm = (typeof legRoundMark === 'function' ? legRoundMark(rs.leg) : null);
                    if (s.leg !== rs.leg) {
                        // the leg we just LEFT completed — emit it if it was a rounding
                        if (s.leg >= 0 && s.req > 0) {
                            out.push({ leg: s.leg, req: s.req,
                                       swept: +s.sweep.toFixed(3),
                                       frac: +(s.sweep / s.req).toFixed(3),
                                       minD: +(s.minD / s.zone).toFixed(2) });
                        }
                        s.leg = rs.leg; s.minD = 1e9; s.sweep = 0; s.prevA = null;
                        s.req = rm && rm.reqSweep != null ? rm.reqSweep : 0;
                        s.zone = rm ? rm.zone : 1;
                    }
                    if (!rm) continue;
                    const d = Math.hypot(b.x - rm.x, b.y - rm.y);
                    if (d < s.minD) s.minD = d;
                    const a = Math.atan2(b.y - rm.y, b.x - rm.x);
                    if (s.prevA != null) {
                        let dA = a - s.prevA;
                        while (dA > Math.PI) dA -= Math.PI * 2;
                        while (dA < -Math.PI) dA += Math.PI * 2;
                        s.sweep += dA * (rm.side === 'port' ? -1 : 1);
                    }
                    s.prevA = a;
                }
            }
            return out;
        }, [seed, VENUE]);
        all.push(...r);
        console.log(`seed ${seed}: ${r.length} completed roundings`);
    }
    await browser.close();

    if (!all.length) { console.log('no roundings'); return; }
    const frac = all.map(r => r.frac), minD = all.map(r => r.minD);
    const short = all.filter(r => r.frac < 1.0);
    const wayShort = all.filter(r => r.frac < 0.8);
    const never = all.filter(r => r.minD > 1.0);          // never entered the zone
    const far = all.filter(r => r.minD > 2.0);
    console.log(`\nROUNDING TRUTH — ${VENUE}, ${TRIALS} seeds, ${all.length} COMPLETED roundings`);
    console.log(`  sweep banked as a fraction of the FULL geometric requirement:`);
    console.log(`    med ${med(frac).toFixed(2)}   min ${Math.min(...frac).toFixed(2)}   max ${Math.max(...frac).toFixed(2)}`);
    console.log(`  completed with LESS than the full rounding: ${short.length} (${(100 * short.length / all.length).toFixed(0)}%)`);
    console.log(`  completed with less than 80% of it:         ${wayShort.length} (${(100 * wayShort.length / all.length).toFixed(0)}%)`);
    console.log(`  closest approach to the mark, in ZONE RADII:`);
    console.log(`    med ${med(minD).toFixed(2)}   p90 ${[...minD].sort((a, b) => a - b)[Math.floor(0.9 * (minD.length - 1))].toFixed(2)}   max ${Math.max(...minD).toFixed(2)}`);
    console.log(`  NEVER ENTERED THE ZONE at all:              ${never.length} (${(100 * never.length / all.length).toFixed(0)}%)`);
    console.log(`  never came within TWO zone radii:           ${far.length} (${(100 * far.length / all.length).toFixed(0)}%)`);
    const byLeg = {};
    for (const r of all) (byLeg[r.leg] = byLeg[r.leg] || []).push(r.frac);
    console.log('  by leg (median sweep fraction):  ' +
        Object.keys(byLeg).sort().map(L => `L${L} ${med(byLeg[L]).toFixed(2)} (n=${byLeg[L].length})`).join('  '));
})();
