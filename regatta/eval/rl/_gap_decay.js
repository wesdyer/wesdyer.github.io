// GAP DECAY — does the corridor you planned still exist when you get there?
//
// The owner's strategy projects gaps to ARRIVAL TIME. The fleet's router stamps
// floes at plan time. The difference matters only if gaps actually close between
// planning and arrival — SIPP was retired because drift is unpredictable past ~5s,
// but nobody has measured how much the CHOSEN corridor degrades over the plan's
// life. For each bot replan on arctic: record min clearance along the plan's next
// 700u at PLAN TIME, then re-measure that same polyline every second for 8s.
// Median decay curve = the size of the arrival-time prize. Flat curve = the
// research direction is dead; steep = it's funded.
//   node _gap_decay.js <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 6;
const SEED0 = parseInt(process.argv[3]) || 9100;
const ROOT = path.join(__dirname, process.argv[4] || 'treeHEAD3');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(() => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic' }));
    });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const decay = {};   // dt-bucket -> [clearance deltas]
    const abs0 = [];
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
                return (px - (a.x + t * dx)) ** 2 + (py - (a.y + t * dy)) ** 2;
            };
            const clearanceAt = (px, py) => {
                let best = 1e9;
                for (let fi = 0; fi < floes.length; fi++) {
                    const f = floes[fi];
                    if (Math.hypot(px - f.x, py - f.y) - maxR[fi] > best + 1) continue;
                    const V = f.vertices;
                    let d2 = 1e18;
                    for (let k = 0, j = V.length - 1; k < V.length; j = k++)
                        d2 = Math.min(d2, segD2(px, py, V[j], V[k]));
                    best = Math.min(best, Math.sqrt(d2));
                }
                return best;
            };
            const minAlong = (pts) => {
                let m = 1e9, run = 0;
                for (let k = 1; k < pts.length && run < 700; k++) {
                    const a = pts[k - 1], b2 = pts[k];
                    const L = Math.hypot(b2.x - a.x, b2.y - a.y);
                    for (let t = 0; t <= 1.0001; t += Math.max(0.1, 40 / Math.max(1, L))) {
                        m = Math.min(m, clearanceAt(a.x + (b2.x - a.x) * t, a.y + (b2.y - a.y) * t));
                    }
                    run += L;
                }
                return m;
            };
            const tracked = [];   // {pts, t0, c0, samples:{dt:c}}
            const lastAge = new Map();
            const out = { rows: [] };
            const dt = 1 / 60; let acc = 0; let simT = 0;
            for (let it = 0; it < 60 * 640; it++) {
                window.update(dt); simT += dt;
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                if (state.race.timer > 620) break;
                if (++acc < 30) continue;   // every 0.5s
                acc = 0;
                for (const b of bots) {
                    if (b.raceState.finished) continue;
                    const c = b.controller;
                    if (!c || !c.gridPath || !c.gridPath.length) continue;
                    const prev = lastAge.get(b);
                    lastAge.set(b, c.gridAge);
                    if (prev !== undefined && c.gridAge < prev - 1e-9 && tracked.length < 400) {
                        const pts = c.gridPath.map(q => ({ x: q.x, y: q.y }));
                        tracked.push({ pts, t0: simT, c0: minAlong(pts), samples: {} });
                    }
                }
                for (const tr of tracked) {
                    const age = simT - tr.t0;
                    if (age > 8.5 || Object.keys(tr.samples).length > 8) continue;
                    const bucket = Math.round(age);
                    if (bucket >= 1 && !(bucket in tr.samples)) tr.samples[bucket] = minAlong(tr.pts);
                }
            }
            for (const tr of tracked) out.rows.push({ c0: Math.round(tr.c0), s: tr.samples });
            return out;
        }, SEED0 + i);
        for (const row of r.rows) {
            abs0.push(row.c0);
            for (const [k, v] of Object.entries(row.s)) {
                (decay[k] = decay[k] || []).push(Math.round(v) - row.c0);
            }
        }
        console.log(`seed ${SEED0 + i}: ${r.rows.length} plans tracked`);
    }
    const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : NaN; };
    const p10 = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length * 0.1)] : NaN; };
    console.log(`\n${abs0.length} plans; clearance-at-plan-time med ${med(abs0)}u`);
    console.log('corridor clearance DELTA vs plan time (med / p10 worst-decile):');
    for (const k of Object.keys(decay).sort((a, b) => a - b)) {
        console.log(`  +${k}s: ${med(decay[k])} / ${p10(decay[k])}u  (n=${decay[k].length})`);
    }
    await browser.close();
})();
