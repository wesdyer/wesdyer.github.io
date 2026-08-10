// DOES THE ARMED APPROACH SHOW REDROCK'S DISPLACEMENT SIGNATURE? (2026-08-10)
//
// Two places are now measured to the same shape and could share one fix:
//   * REDROCK's bowl (+26.5 s/boat): 95% of contacts are preceded by displacement
//     — 63% of boats are already >60u off their OWN planned path 2 s before they
//     touch, median 86u, and only 5% are clean-and-on-path.
//   * ARCTIC's armed approach, 300-900u from granite (+89.2 s/boat): armed ~100%,
//     risk 58-62%, deflected 53%, sailing 63-76 u/s against her 109-115, with ice
//     and land barely blocking (floe 4-9%, land 0-5%). Traffic, in other words.
//
// If arctic's crawl ALSO runs off-path, then one shape — a candidate that returns
// the boat toward its planned route — addresses ~115 s/boat across the campaign's
// two biggest places. If arctic's boats are ON their path and merely slow, the two
// are different problems and must not be built together (composition risk: unscoped
// pairs went anti-compositional at m5).
//
// ⚠️ The arctic record already says distance-to-own-plan is med 44-52u over the
// WHOLE race with off-plan >100u only 25-30% of the time. That is the baseline this
// has to beat: the question is whether the APPROACH BAND is worse than the race.
//
//   node _offpath_band.js <venue> <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'arctic';
const TRIALS = parseInt(process.argv[3]) || 4;
const SEED0 = parseInt(process.argv[4]) || 9100;
const ROOT = path.join(__dirname, process.argv[5] || 'treeDB3');
const BANDS = [0, 300, 600, 900, 1200, 1800, 2400, 9999];
const q = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(p * (s.length - 1))] : NaN; };

(async () => {
    const b = await chromium.launch(); const p = await b.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await p.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });

    const OFF = BANDS.map(() => []), SLOWOFF = BANDS.map(() => []);
    const CNT = BANDS.map(() => ({ n: 0, off60: 0, slow: 0, slowOff60: 0 }));
    for (let t = 0; t < TRIALS; t++) {
        const r = await p.evaluate(({ seed, BANDS }) => {
            window.evalHarness.seed = seed; window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(x => x.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
            const off = BANDS.map(() => []), cnt = BANDS.map(() => ({ n: 0, off60: 0, slow: 0, slowOff60: 0 }));
            const DT = 1 / 60; let tick = 0;
            const bandOf = (d) => { let i = 0; while (i < BANDS.length - 1 && d >= BANDS[i + 1]) i++; return i; };
            for (let it = 0; it < 60 * 900; it++) {
                window.update(DT);
                if (state.race.status !== 'racing') { if (state.race.status === 'finished') break; continue; }
                if (++tick % 6) continue;                        // 10 Hz
                for (const bo of state.boats) {
                    if (bo.isPlayer || bo.raceState.finished || bo.raceState.leg < 1) continue;
                    const c = bo.controller; if (!c) continue;
                    const gp = c.gridPath; if (!gp || gp.length < 2) continue;
                    const rs = bo.raceState;
                    const rm = (typeof legRoundMark === 'function' ? legRoundMark(rs.leg) : null) || state.course.roundMark;
                    if (!rm) continue;
                    const dM = Math.hypot(bo.x - rm.x, bo.y - rm.y);
                    // perpendicular distance to the boat's OWN planned polyline
                    let m = Infinity, px = gp[0].x, py = gp[0].y;
                    for (let k = 1; k < gp.length; k++) {
                        const ax = px, ay = py, bx = gp[k].x, by = gp[k].y;
                        const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
                        let s = L ? ((bo.x - ax) * dx + (bo.y - ay) * dy) / L : 0;
                        s = Math.max(0, Math.min(1, s));
                        m = Math.min(m, Math.hypot(bo.x - (ax + s * dx), bo.y - (ay + s * dy)));
                        px = bx; py = by;
                    }
                    const i = bandOf(dM), v = (bo.speed || 0) * 60;
                    off[i].push(Math.round(m));
                    const C = cnt[i]; C.n++;
                    if (m > 60) C.off60++;
                    if (v < 40) { C.slow++; if (m > 60) C.slowOff60++; }
                }
            }
            return { off, cnt };
        }, { seed: SEED0 + t, BANDS });
        for (let i = 0; i < BANDS.length; i++) {
            OFF[i] = OFF[i].concat(r.off[i].filter((_, k) => k % 7 === 0));
            for (const k of Object.keys(CNT[i])) CNT[i][k] += r.cnt[i][k];
        }
        console.log(`seed ${SEED0 + t} done`);
    }
    await b.close();
    console.log(`\n=== ${VENUE.toUpperCase()}: DISTANCE TO ITS OWN PLANNED PATH, BY BAND (${TRIALS} seeds, ${path.basename(ROOT)}) ===`);
    console.log(`band(u)      samples   off-path med   p75    p90   | >60u share | slow share | of SLOW, >60u off`);
    for (let i = 0; i < BANDS.length; i++) {
        const C = CNT[i]; if (!C.n) continue;
        const lo = BANDS[i], hi = BANDS[i + 1] != null && BANDS[i + 1] < 9999 ? BANDS[i + 1] : '+';
        const o = OFF[i];
        console.log(`${String(lo).padStart(5)}-${String(hi).padEnd(5)} ${String(C.n).padStart(8)} ` +
            `${q(o, 0.5).toFixed(0).padStart(12)}u ${q(o, 0.75).toFixed(0).padStart(6)}u ${q(o, 0.9).toFixed(0).padStart(6)}u |` +
            `${(100 * C.off60 / C.n).toFixed(0).padStart(9)}%  |${(100 * C.slow / C.n).toFixed(0).padStart(9)}%  |` +
            `${(100 * C.slowOff60 / (C.slow || 1)).toFixed(0).padStart(12)}%`);
    }
    console.log(`\n  → approach bands markedly worse than the far bands = the SAME displacement`);
    console.log(`    class as redrock's bowl, and one shape can address both.`);
    console.log(`  → flat across bands = arctic is ON its path and merely slow: DIFFERENT problem,`);
    console.log(`    build them separately.`);
})();
