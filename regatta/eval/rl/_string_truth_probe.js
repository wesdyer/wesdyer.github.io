// DID THE STRING TOUCH THE MARK? — the rule itself, not the proxy.
//
// The engine completes a rounding on a MAGNITUDE: `roundSweep >= reqSweep`, where
// reqSweep is the ideal path's tangent-to-tangent arc and roundSweep accumulates from
// the moment the leg started. That is a proxy for the rule, and it is a proxy in both
// directions:
//
//   TOO LENIENT when she approaches off the mark's beam, because the straight-line
//   approach banks bearing change she did not spend rounding anything;
//   TOO STRICT when she approaches straight at the mark, because then she banks
//   nothing on the way in and has to over-rotate to make the number.
//
// The rule is not a magnitude. "A string representing her track, when drawn taut,
// passes each mark on the required side" is a statement about the WINDING of her track,
// and winding is a homotopy invariant: over the whole leg, from where she started it to
// the next mark, the net bearing swept about this mark takes one of exactly two values,
// 2*pi apart. The larger one means the string wraps the mark; the smaller means it does
// not. Nothing in between is possible, so the classifier has a full pi of margin and
// needs no tolerance at all.
//
//   required = the signed angle from (mark -> where she began the leg) to
//              (mark -> the next mark), taken the required way round, in (0, 2pi]
//   actual   = roundSweep + the short-way sweep still to come as she runs to the
//              next mark from where she is now
//   ROUNDED  iff actual >= required - pi
//
// This reports, for every rounding the ENGINE completed, whether the STRING RULE agrees
// — and by how much margin, so over- and under-strictness are visible separately.
//
// node _string_truth_probe.js <trials> <seed0> <tree> [venue]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 6;
const SEED0 = parseInt(process.argv[3]) || 9100;
const ROOT = path.join(__dirname, process.argv[4] || 'treeL');
const VENUE = process.argv[5] || 'arctic';
const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await page.addInitScript((v) => localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })), VENUE);
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
            const wrap = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
            const st = bots.map(() => null);
            const out = [];
            const dt = 1 / 60;
            for (let it = 0; it < 60 * 940; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                if (state.race.timer > 900) break;
                for (let k = 0; k < bots.length; k++) {
                    const b = bots[k], rs = b.raceState;
                    let s = st[k];
                    if (!s || s.leg !== rs.leg) {
                        // A leg turned over. If the one we just left was a rounding, the
                        // frame BEFORE the turnover is where the verdict is taken.
                        if (s && s.rm && s.last) {
                            const sgn = s.rm.side === 'port' ? -1 : 1;
                            const nextA = (typeof CoursePath !== 'undefined')
                                ? CoursePath.anchor(state.course.route[s.leg + 1], state.course.marks) : null;
                            if (nextA) {
                                const bTo = Math.atan2(nextA.y - s.rm.y, nextA.x - s.rm.x);
                                const bFrom = Math.atan2(s.from.y - s.rm.y, s.from.x - s.rm.x);
                                let need = (bTo - bFrom) * sgn;
                                while (need <= 0) need += Math.PI * 2;
                                while (need > Math.PI * 2) need -= Math.PI * 2;
                                const remain = wrap(bTo - s.last.a) * sgn;
                                const actual = s.sweep + remain;
                                out.push({
                                    leg: s.leg,
                                    req: +s.rm.reqSweep.toFixed(3),
                                    sweep: +s.sweep.toFixed(3),
                                    need: +need.toFixed(3),
                                    actual: +actual.toFixed(3),
                                    margin: +(actual - (need - Math.PI)).toFixed(3),
                                    rounded: actual >= need - Math.PI,
                                    // how much MORE than the string rule asked she swept,
                                    // in radians — the over-strictness of the proxy
                                    excess: +(actual - need).toFixed(3),
                                });
                            }
                        }
                        const rmN = (typeof legRoundMark === 'function' ? legRoundMark(rs.leg) : null);
                        st[k] = s = { leg: rs.leg, rm: (rmN && rmN.reqSweep != null) ? rmN : null,
                                      sweep: 0, prevA: null, from: { x: b.x, y: b.y }, last: null };
                    }
                    if (!s.rm || rs.finished) continue;
                    const a = Math.atan2(b.y - s.rm.y, b.x - s.rm.x);
                    if (s.prevA != null) s.sweep += wrap(a - s.prevA) * (s.rm.side === 'port' ? -1 : 1);
                    s.prevA = a; s.last = { a };
                }
            }
            return out;
        }, [seed, VENUE]);
        all.push(...r);
        console.log(`seed ${seed}: ${r.length} completed roundings`);
    }
    await browser.close();
    if (!all.length) { console.log('no roundings'); return; }
    const bad = all.filter(r => !r.rounded);
    const exc = all.map(r => r.excess);
    // The verdict is a two-class question, so the useful diagnostics are the class
    // populations and what the failures look like — not moments of a bimodal sample.
    console.log('  failing cases (leg, reqSweep, swept, winding required, winding actual):');
    for (const r of bad.slice(0, 12)) console.log(`    L${r.leg} req ${r.req} swept ${r.sweep} need ${r.need} actual ${r.actual}`);
    console.log(`\nSTRING TRUTH — ${VENUE}, tree ${path.basename(ROOT)}, ${TRIALS} seeds, ${all.length} completed roundings`);
    console.log(`  the string did NOT touch the mark:  ${bad.length} (${(100 * bad.length / all.length).toFixed(0)}%)`);
    console.log(`  banked sweep, median               ${med(all.map(r => r.sweep)).toFixed(2)} rad against reqSweep ${med(all.map(r => r.req)).toFixed(2)}`);
    void exc;
})();
