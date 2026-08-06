// FLEET ICE EXPOSURE — the same definition as `_ice_exposure.py` on the human side.
//
// The owner's stated strategy is gap-seeking: project where the pack's gaps will be,
// prefer the largest, commit. The human-side number says she does NOT route around ice:
// clearance med 206u, 22.4% of the race within 100u of a floe edge, min 14-31u every
// race — and 8 of 19 races take zero floe hits anyway. This probe asks where the FLEET
// sits on the same axis. Two different worlds are possible:
//   fleet clearance ≈ human's, hits 6x    -> per-encounter steering is the gap
//   fleet clearance << human's (pinched)  -> routing chooses thinner corridors
//   fleet clearance >> human's, still 23  -> it dodges wide AND hits, i.e. reactive
//                                            fire-fighting (the stale-plan story)
//
// Definition (identical to the python): at each 10 Hz racing-phase sample, signed
// distance from boat to the nearest floe EDGE, exact hull polygon (isl.vertices is
// the world hull, kept in sync with spin by syncFloe). Negative = inside.
//
//   node _ice_exposure_fleet.js <trials> <seed0> <tree> [venue]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 8;
const SEED0 = parseInt(process.argv[3]) || 9100;
const ROOT = path.join(__dirname, process.argv[4] || 'treeNOW');
const VENUE = process.argv[5] || 'arctic';
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript((v) => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: v }));
    }, VENUE);
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const pooled = []; const perRace = []; const hbAcc = {};
    for (let i = 0; i < TRIALS; i++) {
        const r = await page.evaluate(async (seed) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const bots = state.boats.filter(b => !b.isPlayer);
            const pl = state.boats.find(b => b.isPlayer); pl.x = 1e6; pl.y = 1e6;
            const floes = (state.course.islands || []).filter(f => f.isFloe && f.vertices);
            const maxR = floes.map(f => Math.max(...f.localHull.map(p => Math.hypot(p.x, p.y))));
            const segD2 = (px, py, a, b2) => {
                const dx = b2.x - a.x, dy = b2.y - a.y;
                const L2 = dx * dx + dy * dy;
                const t = L2 ? Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / L2)) : 0;
                const ex = a.x + t * dx, ey = a.y + t * dy;
                return (px - ex) * (px - ex) + (py - ey) * (py - ey);
            };
            const clearance = (px, py) => {
                let best = 1e9;
                for (let fi = 0; fi < floes.length; fi++) {
                    const f = floes[fi];
                    const cd = Math.hypot(px - f.x, py - f.y);
                    if (cd - maxR[fi] > (best === 1e9 ? 1e9 : Math.abs(best)) + 1) continue;
                    const V = f.vertices;
                    let d2 = 1e18, inside = false;
                    for (let k = 0, j = V.length - 1; k < V.length; j = k++) {
                        const d = segD2(px, py, V[j], V[k]);
                        if (d < d2) d2 = d;
                        if ((V[k].y > py) !== (V[j].y > py)) {
                            const xin = (V[j].x - V[k].x) * (py - V[k].y) / (V[j].y - V[k].y) + V[k].x;
                            if (px < xin) inside = !inside;
                        }
                    }
                    const v = (inside ? -1 : 1) * Math.sqrt(d2);
                    if (best === 1e9 || v < best) best = v;
                }
                return best === 1e9 ? null : best;
            };
            // clearance samples, plus heading-rate binned by clearance band —
            // the human's discriminator: her median hdg-rate is 0.0 deg/s in every
            // band outside 50u (turns are planned, not proximity-triggered).
            const clr = [];
            const bands = [50, 100, 200, 400, 1e9];
            const hr = bands.map(() => []); const sp = bands.map(() => []);
            const lastHdg = new Map();
            const dt = 1 / 60; let acc = 0;
            for (let it = 0; it < 60 * 940; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                if (state.race.timer > 900) break;
                if (++acc < 6) continue;   // 10 Hz, matching the recorder
                acc = 0;
                for (const b of bots) {
                    if (b.raceState.finished) continue;
                    const v = clearance(b.x, b.y);
                    if (v === null) continue;
                    clr.push(Math.round(v));
                    const prev = lastHdg.get(b);
                    lastHdg.set(b, b.heading);
                    if (prev !== undefined) {
                        let dh = Math.abs(b.heading - prev) % (2 * Math.PI);
                        if (dh > Math.PI) dh = 2 * Math.PI - dh;
                        const rate = dh / 0.1 * 57.3;
                        for (let bi = 0; bi < bands.length; bi++) {
                            if (v < bands[bi]) { hr[bi].push(rate); sp[bi].push(b.speed); break; }
                        }
                    }
                }
            }
            const med = a => { const s2 = [...a].sort((x, y) => x - y); return s2.length ? s2[s2.length >> 1] : NaN; };
            const p90 = a => { const s2 = [...a].sort((x, y) => x - y); return s2.length ? s2[Math.floor(s2.length * 0.9)] : NaN; };
            return { clr, hdgByBand: hr.map((a, i) => ({ band: bands[i], n: a.length, med: med(a), p90: p90(a), spdMed: med(sp[i]) })) };
        }, SEED0 + i);
        for (const hb of r.hdgByBand) {
            (hbAcc[hb.band] = hbAcc[hb.band] || []).push(hb);
        }
        pooled.push(...r.clr);
        const s = [...r.clr].sort((a, b) => a - b);
        const pc = p => s[Math.min(s.length - 1, Math.floor((s.length - 1) * p / 100))];
        perRace.push(`seed ${SEED0 + i}: n=${s.length} min=${s[0]} p5=${pc(5)} med=${pc(50)}`);
        console.log(perRace[perRace.length - 1]);
    }
    const s = pooled.sort((a, b) => a - b);
    const pc = p => s[Math.min(s.length - 1, Math.floor((s.length - 1) * p / 100))];
    console.log(`\nFLEET pooled ${VENUE} samples: ${s.length}`);
    console.log(`  clearance: min ${s[0]}  p5 ${pc(5)}  p25 ${pc(25)}  med ${pc(50)}  p75 ${pc(75)}`);
    for (const th of [0, 50, 100, 200, 400]) {
        let lo = 0, hi = s.length;
        while (lo < hi) { const m = (lo + hi) >> 1; if (s[m] < th) lo = m + 1; else hi = m; }
        console.log(`    share < ${String(th).padStart(3)}u from a floe edge: ${(100 * lo / s.length).toFixed(1)}%`);
    }
    console.log('\nheading-rate by clearance band (per-race medians of medians):');
    for (const k of Object.keys(hbAcc).sort((a, b) => a - b)) {
        const rows = hbAcc[k].filter(r => r.n > 20);
        if (!rows.length) continue;
        const mid = a => { const s2 = [...a].sort((x, y) => x - y); return s2[s2.length >> 1]; };
        console.log(`  <${String(k).padStart(4)}u  n=${rows.reduce((a, r) => a + r.n, 0)}  ` +
            `hdgrate med ${mid(rows.map(r => r.med)).toFixed(1)} p90 ${mid(rows.map(r => r.p90)).toFixed(1)}  ` +
            `spd med ${mid(rows.map(r => r.spdMed)).toFixed(2)}`);
    }
    console.log('\n(human 19-recording reference: min 14  p5 46  p25 108  med 206  p75 365;');
    console.log(' shares <0u 0.0% | <50u 6.1% | <100u 22.4% | <200u 48.7% | <400u 78.7%;');
    console.log(' hdgrate med by band: 14.2 <50u, 0.0 everywhere else; p90 ~50 all bands;');
    console.log(' spd med 1.61 <50u rising to 2.05 open)');
    await browser.close();
})();
