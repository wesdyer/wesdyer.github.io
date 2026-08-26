// RIVER ENTRY PUSH P1 — FIRST-CONTACT ENTRY CENSUS (2026-08-26, overnight;
// pre-registration: memory regatta-rventry-push-plan). The notch re-beach
// machinery is dead at three levels; ENTRY is the named open lead. This
// probe asks WHO steers a boat into its FIRST land contact and what is
// measurable BEFORE it: per land-contact episode (2s debounce), the pre-10s
// track — clearance trajectory (cells), avoidance deviation, wiggle/escape
// flags, speed, ground-frame gap (commanded heading vs track bearing),
// stream, TWA — plus position for leg-3 subsection clustering.
//   Owner rule (the rr census convention): wig >=0.5, esc >=0.5,
//   avMax >=30deg, else nav — evaluated over the pre-6s window; the pre-5s
//   clearance sample feeds the registered kill bar.
//   TEN-BOT ERA: ocean_bench's conversion, RB_PARKED=1 opt-out; sequence
//   replay (rule 34) + late venue write (rule 30) + fins validation vs the
//   tb bench JSON.
//   node _rv_entry.js <tree> <venue> <seed0> <nraces> [benchLabel]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TREE = process.argv[2] || 'treeRW';
const ROOT = path.join(__dirname, TREE);
const VENUE = process.argv[3] || 'river';
const SEED0 = parseInt(process.argv[4] || '9400');
const NRACES = parseInt(process.argv[5] || '8');
const BENCH = process.argv[6] || '';
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const TEN_BOT = process.env.RB_PARKED !== '1';
    await page.evaluate(({ v, tenBot }) => {
        const s = { venue: v };
        if (tenBot) s.character = AI_CONFIG[0].name;
        localStorage.setItem('regatta_settings', JSON.stringify(s));
    }, { v: VENUE, tenBot: TEN_BOT });
    const allOut = [];
    for (let race = 0; race < NRACES; race++) {
        const seed = SEED0 + race;
        const r = await page.evaluate(async ({ seed, tenBot }) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(b => b.isPlayer);
            if (pl && tenBot) {
                applyBoatIdentity(pl, playerCharacter(), false);
                pl.isPlayer = false; pl.manualTrim = false;
                const nine = state.boats.filter(b => b !== pl);
                const meanPct = nine.reduce((a, b) => a + b.ai.startLinePct, 0) / nine.length;
                pl.ai.startLinePct = Math.max(0.05, Math.min(0.90, meanPct));
                pl.ai.setupDist = 300;
            } else if (pl) { pl.x = 1e6; pl.y = 1e6; }
            const CT = {};
            {
                const inner = window.onRaceEvent;
                window.onRaceEvent = (ty, d) => {
                    try {
                        if (ty === 'collision_island' && d && d.boat && !d.isFloe && !d.boat.isPlayer) {
                            const a = CT[d.boat.name] = CT[d.boat.name] || [];
                            const t = state.race.timer;
                            if (!a.length || t - a[a.length - 1] >= 0.1) a.push(+t.toFixed(1));
                        }
                    } catch (e) {}
                    if (inner) return inner(ty, d);
                };
            }
            const norm = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
            const wrapAll = () => {
                for (const bo of state.boats) {
                    if (bo.isPlayer) continue;
                    const c = bo.controller;
                    if (!c || !c.applyAvoidance || c.__dwrap) continue;
                    const orig = c.applyAvoidance.bind(c);
                    c.applyAvoidance = (dh, sr) => { const out = orig(dh, sr); bo._avDev = Math.abs(norm(out - dh)); return out; };
                    c.__dwrap = 1;
                }
            };
            const g = state.course.botGrid;
            if (g && !g._clear && window.SailCheck) g._clear = window.SailCheck.clearanceField(g);
            const clrAt = (wx, wy) => {
                if (!g || !g._clear) return null;
                const c = g.cell(wx, wy);
                if (c[0] < 0 || c[1] < 0 || c[0] >= g.n || c[1] >= g.n) return 0;
                return g._clear[c[1] * g.n + c[0]];
            };
            // 10Hz ledger per boat
            const L = new Map();
            const led = (name) => { let l = L.get(name); if (!l) { l = { t: [], x: [], y: [], kt: [], wig: [], esc: [], av: [], clr: [], hd: [] }; L.set(name, l); } return l; };
            const finT = {};
            const DT = 1 / 60; let it = 0;
            while (it < 900 * 60) {
                for (const bo of state.boats) bo._avDev = 0;
                wrapAll();
                update(DT); it++;
                if (state.race.status !== 'racing') continue;
                const t = state.race.timer;
                if (t > 900) break;
                for (const b of state.boats) {
                    if (b.isPlayer) continue;
                    if (b.raceState.finished) { if (finT[b.name] == null) finT[b.name] = Math.round(t); continue; }
                }
                if (it % 6) continue;
                for (const b of state.boats) {
                    if (b.isPlayer || b.raceState.finished) continue;
                    const l = led(b.name);
                    l.t.push(+t.toFixed(1)); l.x.push(Math.round(b.x)); l.y.push(Math.round(b.y));
                    l.kt.push(+(b.speed * 4).toFixed(1));
                    const c = b.controller;
                    l.wig.push(c && c.wiggleActive ? 1 : 0);
                    l.esc.push(c && c.escActive ? 1 : 0);
                    l.av.push(Math.round((b._avDev || 0) * 57.3));
                    l.clr.push(clrAt(b.x, b.y));
                    l.hd.push(+b.heading.toFixed(2));
                    // off-path distance: boat to the polyline of its own gridPath
                    // (first 6 pts) — the _contact_ante "off own path" measure
                    {
                        let pd = null;
                        const gp = c && c.gridPath;
                        if (gp && gp.length) {
                            pd = Math.hypot(b.x - gp[0].x, b.y - gp[0].y);
                            for (let ii = 0; ii + 1 < Math.min(6, gp.length); ii++) {
                                const ax = gp[ii].x, ay = gp[ii].y, bx2 = gp[ii + 1].x, by2 = gp[ii + 1].y;
                                const dx = bx2 - ax, dy = by2 - ay, L2 = dx * dx + dy * dy;
                                let tt = L2 ? ((b.x - ax) * dx + (b.y - ay) * dy) / L2 : 0;
                                tt = Math.max(0, Math.min(1, tt));
                                pd = Math.min(pd, Math.hypot(b.x - (ax + tt * dx), b.y - (ay + tt * dy)));
                            }
                        }
                        if (!l.pd) l.pd = [];
                        l.pd.push(pd == null ? null : Math.round(pd));
                    }
                }
                if (state.boats.every(b => b.isPlayer || b.raceState.finished)) break;
            }
            // episodes with 2s debounce; rich pre-window on each
            const eps = [];
            const near = (l, tt) => { let lo = 0, hi = l.t.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (l.t[m] < tt) lo = m + 1; else hi = m; } return lo; };
            const legOf = (name) => { const b = state.boats.find(bb => bb.name === name); return b ? b.raceState.leg : -1; };
            for (const [name, ct] of Object.entries(CT)) {
                const l = L.get(name);
                let e0 = null, last = null, idx = 0;
                const flush = (t0, t1) => {
                    const ep = { name, idx, t0: +t0.toFixed(1), dur: +(t1 - t0).toFixed(1) };
                    if (l && l.t.length) {
                        const iE = Math.min(near(l, t0), l.t.length - 1);
                        ep.x = l.x[iE]; ep.y = l.y[iE];
                        // clearance/speed trajectory at -10, -7.5, -5, -2.5, -1 s
                        ep.clrT = [-10, -7.5, -5, -2.5, -1].map(dt0 => {
                            const i = near(l, t0 + dt0);
                            return Math.abs(l.t[Math.min(i, l.t.length - 1)] - (t0 + dt0)) < 1.5 ? l.clr[Math.min(i, l.clr.length - 1)] : null;
                        });
                        ep.ktT = [-10, -5, -1].map(dt0 => {
                            const i = near(l, t0 + dt0);
                            return Math.abs(l.t[Math.min(i, l.t.length - 1)] - (t0 + dt0)) < 1.5 ? l.kt[Math.min(i, l.kt.length - 1)] : null;
                        });
                        // owner window: pre-6s (the rr convention)
                        const i0 = near(l, t0 - 6), n = Math.max(1, iE - i0);
                        let w = 0, e = 0, avM = 0, avHi = 0;
                        for (let i = i0; i < iE; i++) { w += l.wig[i]; e += l.esc[i]; if (l.av[i] > avM) avM = l.av[i]; if (l.av[i] >= 30) avHi++; }
                        ep.preWig = +(w / n).toFixed(2); ep.preEsc = +(e / n).toFixed(2);
                        ep.preAvMax = avM; ep.preAvFrac = +(avHi / n).toFixed(2);
                        // ground-frame gap over pre-5s: commanded heading vs track bearing
                        const i5 = near(l, t0 - 5);
                        let gap = 0, gn = 0;
                        for (let i = Math.max(i5, 1); i < iE; i++) {
                            const dx = l.x[i] - l.x[i - 1], dy = l.y[i] - l.y[i - 1];
                            if (dx * dx + dy * dy < 1) continue;
                            const trk = Math.atan2(dx, -dy);
                            let d = Math.abs(trk - l.hd[i]); while (d > Math.PI) d = Math.abs(d - 2 * Math.PI);
                            gap += d; gn++;
                        }
                        ep.gfGap = gn ? Math.round((gap / gn) * 57.3) : null;
                    }
                    // off-path at -3s and -1s (v3)
                    if (l && l.pd && l.pd.length) {
                        for (const [key, dt0] of [['pd3', -3], ['pd1', -1]]) {
                            const i = near(l, t0 + dt0);
                            if (Math.abs(l.t[Math.min(i, l.t.length - 1)] - (t0 + dt0)) < 1.5)
                                ep[key] = l.pd[Math.min(i, l.pd.length - 1)];
                        }
                    }
                    // rival context at t0-3s, from the other boats' own ledgers
                    if (l && l.t.length) {
                        const i3 = near(l, t0 - 3);
                        const mx = l.x[Math.min(i3, l.x.length - 1)], my = l.y[Math.min(i3, l.y.length - 1)];
                        const mh = l.hd[Math.min(i3, l.hd.length - 1)];
                        let best = null, n300 = 0;
                        for (const [oname, ol] of L) {
                            if (oname === name || !ol.t.length) continue;
                            const oi = near(ol, t0 - 3);
                            if (Math.abs(ol.t[Math.min(oi, ol.t.length - 1)] - (t0 - 3)) > 1.5) continue;
                            const ox = ol.x[Math.min(oi, ol.x.length - 1)], oy = ol.y[Math.min(oi, ol.y.length - 1)];
                            const d = Math.hypot(ox - mx, oy - my);
                            if (d < 300) n300++;
                            if (!best || d < best.d) {
                                const brg = Math.atan2(ox - mx, -(oy - my));
                                let rel = Math.abs(brg - mh); while (rel > Math.PI) rel = Math.abs(rel - 2 * Math.PI);
                                const oh = ol.hd[Math.min(oi, ol.hd.length - 1)];
                                let al = Math.abs(oh - mh); while (al > Math.PI) al = Math.abs(al - 2 * Math.PI);
                                best = { d, rel, al, kt: ol.kt[Math.min(oi, ol.kt.length - 1)] };
                            }
                        }
                        if (best) { ep.rivD3 = Math.round(best.d); ep.rivRel = Math.round(best.rel * 57.3);
                                    ep.rivAlign = Math.round(best.al * 57.3); ep.rivKt = best.kt; }
                        ep.n300 = n300;
                    }
                    const b = state.boats.find(bb => bb.name === name);
                    ep.leg = b ? b.raceState.leg : -1;
                    if (typeof getCurrentAt === 'function') {
                        const cur = getCurrentAt(ep.x || 0, ep.y || 0) || { speed: 0, direction: 0 };
                        ep.curKt = +(cur.speed || 0).toFixed(2); ep.curDir = +(cur.direction || 0).toFixed(2);
                    }
                    eps.push(ep); idx++;
                };
                for (const t of ct.concat([1e9])) {
                    if (e0 == null) { e0 = t; last = t; continue; }
                    if (t - last >= 2.0) { flush(e0, last); e0 = t === 1e9 ? null : t; }
                    last = t;
                }
                if (e0 != null && e0 !== 1e9) flush(e0, Math.min(last, 900));
            }
            const fins = {};
            for (const b of state.boats) { if (!b.isPlayer) fins[b.name] = b.raceState.finished ? 1 : 0; }
            return { eps: eps.slice(0, 900), fins, finT };
        }, { seed, tenBot: TEN_BOT });
        console.log(`race ${race} (seed ${seed}): episodes ${r.eps.length} (first ${r.eps.filter(e => e.idx === 0).length}), fins ${Object.values(r.fins).reduce((a, b) => a + b, 0)}/${Object.keys(r.fins).length}`);
        allOut.push({ seed, ...r });
    }
    const of = path.join(__dirname, `_rv_entry_${TREE}_${VENUE}_${SEED0}.json`);
    fs.writeFileSync(of, JSON.stringify(allOut));
    console.log('wrote', of);
    if (BENCH) {
        try {
            const bj = JSON.parse(fs.readFileSync(path.join(__dirname, `ocean_bench_${BENCH}.json`), 'utf8'));
            for (let i = 0; i < Math.min(NRACES, bj.length); i++) {
                const bf = {}; for (const b of bj[i].info) bf[b.name] = b.fin;
                const mine = allOut[i].finT;
                const diffs = Object.keys(bf).filter(n => (bf[n] == null) !== (mine[n] == null) || (bf[n] != null && mine[n] != null && Math.abs(bf[n] - mine[n]) > 1));
                console.log(`replay check race ${i}: ${diffs.length ? 'DIFFERS ' + JSON.stringify(diffs.map(n => `${n} ${bf[n]} vs ${mine[n]}`)) : 'matches bench fins'}`);
            }
        } catch (e) { console.log('replay check unavailable:', e.message); }
    }
    await browser.close();
})();
