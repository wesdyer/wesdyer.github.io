// WHERE DOES A HONEST ROUNDING SPEND ITS TIME?
//
// Removing ROUND_SWEEP_TOL cost arctic 87 seconds a boat. Some of that is simply the
// arc the fleet used to skip. The rest — if there is any — is the fleet grinding in the
// island's lee rather than sailing round it, which is an AI problem and not the price
// of honesty. This separates the two, per boat per rounding leg:
//
//   arcTime     seconds between first entering `zone * ACTIVE` and the leg completing
//   arcDist     distance sailed in that window
//   arcSweep    bearing swept about the mark in that window
//   meanSpd     arcDist / arcTime — the giveaway. Sailing round costs distance at
//               speed; milling costs time at no speed.
//   slowFrac    fraction of those frames under 3 units/s
//   ratio       arcDist / (arcSweep * meanRadius) — 1.0 is a circle sailed cleanly,
//               higher means she wandered
//
// node _round_cost_probe.js <trials> <seed0> <tree> [venue]
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
            const ACTIVE = 2.0;
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
                    const rm = (typeof legRoundMark === 'function' ? legRoundMark(rs.leg) : null);
                    let s = st[k];
                    if (s && s.leg !== rs.leg) {
                        if (s.t > 0) out.push({
                            leg: s.leg, t: +s.t.toFixed(1), dist: Math.round(s.dist),
                            sweep: +s.sweep.toFixed(2), spd: +(s.dist / Math.max(0.1, s.t)).toFixed(1),
                            slow: +(s.slow / Math.max(1, s.n)).toFixed(2),
                            ratio: +(s.dist / Math.max(1, Math.abs(s.sweep) * (s.rSum / Math.max(1, s.n)))).toFixed(2),
                        });
                        st[k] = s = null;
                    }
                    if (!rm || rs.finished) continue;
                    const d = Math.hypot(b.x - rm.x, b.y - rm.y);
                    if (!s) {
                        if (d > rm.zone * ACTIVE) continue;
                        st[k] = s = { leg: rs.leg, t: 0, dist: 0, sweep: 0, prevA: null,
                                      px: b.x, py: b.y, slow: 0, n: 0, rSum: 0 };
                    }
                    s.t += dt;
                    s.dist += Math.hypot(b.x - s.px, b.y - s.py);
                    s.px = b.x; s.py = b.y;
                    s.n++; s.rSum += d;
                    if (b.speed < 3) s.slow++;
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
        console.log(`seed ${seed}: ${r.length} rounding passages`);
    }
    await browser.close();
    if (!all.length) { console.log('no roundings'); return; }
    const f = k => all.map(r => r[k]);
    console.log(`\nROUNDING COST — ${VENUE}, tree ${path.basename(ROOT)}, ${TRIALS} seeds, ${all.length} passages`);
    console.log(`  time in the ring   med ${med(f('t')).toFixed(1)}s   mean ${(f('t').reduce((a, b) => a + b, 0) / all.length).toFixed(1)}s   max ${Math.max(...f('t')).toFixed(0)}s`);
    console.log(`  distance sailed    med ${med(f('dist')).toFixed(0)}u`);
    console.log(`  sweep banked       med ${med(f('sweep')).toFixed(2)} rad`);
    console.log(`  mean speed         med ${med(f('spd')).toFixed(1)} u/s`);
    console.log(`  frames under 3 u/s med ${med(f('slow')).toFixed(2)}   mean ${(f('slow').reduce((a, b) => a + b, 0) / all.length).toFixed(2)}`);
    console.log(`  wander ratio       med ${med(f('ratio')).toFixed(2)}  (1.0 = a clean circle)`);
    const stuck = all.filter(r => r.t > 60);
    console.log(`  passages over 60s in the ring: ${stuck.length} (${(100 * stuck.length / all.length).toFixed(0)}%)`);
})();
