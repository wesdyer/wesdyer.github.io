// REFUSED-GAP CENSUS + THE PRIZE (2026-08-23, R3 push Phase 1.1).
// The router prices floe-blocked (soft) cells at 2.5-6x, so it effectively
// refuses gaps the stamp closed. R3 would ADMIT a floe-stamp-blocked cell
// (static land stays sacred: statNav must be 1) within the path's <=5s ETA
// window iff the TRUE-hull gap is drift+spin-predicted open across the
// boat's transit with >=60u margin. This probe is MEASURE-ONLY: every 2s
// of solo racing it (a) counts the refused-admissible cells inside the 5s
// reach, (b) records their predicted clearances (width census), (c) re-runs
// pathSailable on a probe-modified grid with those cells re-opened and
// reports the PATH-LENGTH DELTA vs the same router on the unmodified grid
// (both string-pulled the same way, so stair-step inflation cancels).
// PRIZE aggregation: runs of consecutive samples with delta>60u are one
// EVENT (the same gap re-offered is not new prize); per-lap prize = sum of
// per-event MAX deltas (an upper bound — taking one gap can consume
// another). Bar: 8s-scale ~ 1000u/lap at ~130 u/s. If under, REPORT
// BEFORE BUILDING (the E1 lesson).
//   node _gap_admit.js <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 4;
const SEED0 = parseInt(process.argv[3]) || 9100;
const ROOT = path.join(__dirname, process.argv[4] || 'treeR1C');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic' })); });
    await page.addInitScript(() => { window.__CHAR = { neutral: 1 }; });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const RACES = [];
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const r = await page.evaluate(async (seed) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const bots = state.boats.filter(b => !b.isPlayer);
            const pl = state.boats.find(b => b.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
            const hero = bots[0];
            for (let k = 1; k < bots.length; k++) { bots[k].x = 1e6 + k * 500; bots[k].y = 1e6; bots[k].raceState.finished = true; }
            const dt = 1 / 60;
            const MARGIN = 60, HORIZ = 5, DELTA_BAR = 60;
            const samples = [];
            let nextT = 0;
            const cloneGrid = (g, nav2, soft2) => ({
                n: g.n, x0: g.x0, y0: g.y0, res: g.res, nav: nav2,
                _tight: g._tight, _soft: soft2, _shapes: g._shapes,
                _shoal: g._shoal, _leeW: g._leeW, _wfx: g._wfx, _wfy: g._wfy,
                _wbin: g._wbin, _floeRisk: g._floeRisk,
                cell: (wx, wy) => [Math.floor((wx - g.x0) / g.res), Math.floor((wy - g.y0) / g.res)],
                world: (i2, j2) => [g.x0 + (i2 + 0.5) * g.res, g.y0 + (j2 + 0.5) * g.res],
                at: function (i2, j2) { return (i2 < 0 || j2 < 0 || i2 >= this.n || j2 >= this.n) ? 0 : this.nav[j2 * this.n + i2]; },
            });
            const plen = (seg) => {
                if (!seg || seg.length < 2) return null;
                let L = 0; for (let k2 = 1; k2 < seg.length; k2++) L += Math.hypot(seg[k2][0] - seg[k2 - 1][0], seg[k2][1] - seg[k2 - 1][1]);
                return L;
            };
            for (let it = 0; it < 60 * 900; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                const t = state.race.timer;
                if (t > 880 || hero.raceState.finished) break;
                const L = hero.raceState.leg;
                if (L !== 1 && L !== 2) continue;
                if (t < nextT) continue;
                nextT = t + 2.0;
                const c = hero.controller; if (!c || !c.gridGoal) continue;
                const g = state.course.botGrid, stat = state.course._botGridStatic;
                if (!g || !stat) continue;
                const v = Math.max(60, (hero.speed || 0) * 60);
                const reach = HORIZ * v;
                const floes = state.course._floeObjs || [];
                // census refused-admissible cells in the <=5s reach
                const adm = [], admClr = [];
                const ci0 = g.cell(hero.x - reach, hero.y - reach), ci1 = g.cell(hero.x + reach, hero.y + reach);
                for (let j = Math.max(0, ci0[1]); j <= Math.min(g.n - 1, ci1[1]); j++) {
                    for (let i2 = Math.max(0, ci0[0]); i2 <= Math.min(g.n - 1, ci1[0]); i2++) {
                        const id = j * g.n + i2;
                        if (g.nav[id] || !stat.nav[id]) continue;   // floe-blocked only; land sacred
                        const [wx, wy] = g.world(i2, j);
                        const d = Math.hypot(wx - hero.x, wy - hero.y);
                        if (d > reach) continue;
                        const tE = Math.min(HORIZ, d / v);
                        // TRUE-hull predicted clearance across the transit (tE and tE+1.5)
                        let ok = true, cMin = Infinity;
                        for (const tT of [tE, Math.min(HORIZ, tE + 1.5)]) {
                            let best = Infinity;
                            for (const f of floes) {
                                const fx = f.x + (f.driftVx || 0) * tT, fy = f.y + (f.driftVy || 0) * tT;
                                const dx = wx - fx, dy = wy - fy;
                                const rr = (f.radius || 0) + MARGIN + 40;
                                if (dx * dx + dy * dy > rr * rr) continue;
                                const cH = floeHullClear(f, wx - (f.driftVx || 0) * tT, wy - (f.driftVy || 0) * tT, tT);
                                if (cH < best) best = cH;
                            }
                            if (best < MARGIN) { ok = false; break; }
                            if (best < cMin) cMin = best;
                        }
                        if (ok) { adm.push(id); admClr.push(cMin === Infinity ? 999 : Math.round(cMin)); }
                    }
                }
                let delta = null, bLen = null, mLen = null;
                if (adm.length) {
                    const goal = c.gridGoal;
                    const bSeg = window.SailCheck.pathSailable(g, [hero.x, hero.y], [goal.x, goal.y]);
                    bLen = plen(bSeg);
                    const nav2 = g.nav.slice();
                    const soft2 = g._soft ? g._soft.slice() : null;
                    for (const id of adm) { nav2[id] = 1; if (soft2) soft2[id] = 0; }
                    const g2 = cloneGrid(g, nav2, soft2);
                    const mSeg = window.SailCheck.pathSailable(g2, [hero.x, hero.y], [goal.x, goal.y]);
                    mLen = plen(mSeg);
                    if (bLen != null && mLen != null) delta = bLen - mLen;
                }
                samples.push({ t: +t.toFixed(1), leg: L, nAdm: adm.length,
                    clr: admClr.length ? admClr.reduce((a, b) => a + b, 0) / admClr.length : null,
                    clrMin: admClr.length ? Math.min(...admClr) : null,
                    bLen: bLen != null ? Math.round(bLen) : null, delta: delta != null ? Math.round(delta) : null });
            }
            // event aggregation: runs of consecutive samples with delta > DELTA_BAR
            const events = [];
            let ev = null;
            for (const s of samples) {
                const on = s.delta != null && s.delta > DELTA_BAR;
                if (on) { if (!ev) ev = { t0: s.t, max: s.delta, n: 1 }; else { ev.max = Math.max(ev.max, s.delta); ev.n++; ev.t1 = s.t; } }
                else if (ev) { events.push(ev); ev = null; }
            }
            if (ev) events.push(ev);
            const fin = hero.raceState.finished ? hero.raceState.finishTime : null;
            return { seed, fin, nSamples: samples.length,
                sAny: samples.filter(s => s.nAdm > 0).length,
                nAdmTot: samples.reduce((a, s) => a + s.nAdm, 0),
                deltas: samples.map(s => s.delta).filter(d => d != null),
                clrs: samples.map(s => s.clr).filter(x => x != null),
                events, prize: events.reduce((a, e) => a + e.max, 0) };
        }, seed);
        RACES.push(r);
        console.log(`seed ${seed}: fin ${r.fin}  samples ${r.nSamples}  samples-with-admissible ${r.sAny} (${(100 * r.sAny / r.nSamples).toFixed(0)}%)  events ${r.events.length}  PRIZE ${Math.round(r.prize)}u`);
    }
    await browser.close();
    const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : NaN; };
    const allD = RACES.flatMap(r => r.deltas), allC = RACES.flatMap(r => r.clrs);
    const allEv = RACES.flatMap(r => r.events);
    console.log(`\n=== REFUSED-GAP CENSUS (${TRIALS} seeds, ${path.basename(ROOT)}) ===`);
    console.log(`samples with admissible cells: ${RACES.reduce((a, r) => a + r.sAny, 0)}/${RACES.reduce((a, r) => a + r.nSamples, 0)}`);
    console.log(`admissible-cell predicted clr (per-sample mean) p25/med/p75: ${q(allC, .25).toFixed(0)}/${q(allC, .5).toFixed(0)}/${q(allC, .75).toFixed(0)}u`);
    console.log(`route delta when admissible, p25/med/p75/p90/max: ${q(allD, .25)}/${q(allD, .5)}/${q(allD, .75)}/${q(allD, .9)}/${Math.max(...allD, 0)}u  share>60u: ${(100 * allD.filter(d => d > 60).length / allD.length).toFixed(0)}%`);
    console.log(`EVENTS (runs of delta>60u): ${allEv.length} total, per-event max med/p75/max: ${q(allEv.map(e => e.max), .5)}/${q(allEv.map(e => e.max), .75)}/${Math.max(...allEv.map(e => e.max), 0)}u`);
    const przs = RACES.map(r => Math.round(r.prize));
    console.log(`PRIZE per lap (sum of event maxima, UPPER BOUND): ${przs.join(', ')}u  med ${q(przs, .5)}u  (~${(q(przs, .5) / 130).toFixed(1)}s at 130 u/s; bar = 8s-scale ~1000u)`);
    fs.writeFileSync(path.join(__dirname, `_gap_admit_${path.basename(ROOT)}_${SEED0}.json`), JSON.stringify(RACES, null, 1));
    console.log(`wrote _gap_admit_${path.basename(ROOT)}_${SEED0}.json`);
})();
