// RE-BEACHING PUSH P1 — WIGGLE SIDE-OUTCOME CENSUS (2026-08-25, pre-build
// kill filter). The wiggle side chooser is land-blind (bot.js ~583-621:
// rounding dir, weed [S3a], nearest boat/mark <=100u, else random). The
// specimen (_riv_dnf.js, d5765f7) showed re-entries after escape are
// wiggle-steered. THIS probe asks whether the SIDE the wiggle picks
// predicts the outcome — the candidate is dead pre-build if it does not.
//   Per wiggle trigger (rising edge, 10Hz detect), leg>=1:
//     side chosen, cause branch (round/weed/rand8/obs/rand — replicated),
//     boat-cell clearance (cells; <=2 = near-beached population),
//     beam-point clearances both sides at 80/150u (grid._clear, OOB=0),
//     stream vector, in-contact flag, outcome <=10s (re-beach = any land
//     contact event in (t0+1.5, t0+10]).
//   Plus: land-contact episodes (2s debounce) with pre-6s steering
//   ownership (wiggle/escape/avoidance-dev) — re-entry ownership at n.
//   Sequence replay per standing rule 34 (from the bench's seed0), LATE
//   venue write per rule 30 (goto default, then set localStorage). Fins
//   are validated against the bench JSON when a label is given.
//   node _rb_census.js <tree> <venue> <seed0> <nraces> [benchLabel]
// e.g. node _rb_census.js treeF1 river 9408 4 f1riv9408
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TREE = process.argv[2] || 'treeF1';
const ROOT = path.join(__dirname, TREE);
const VENUE = process.argv[3] || 'river';
const SEED0 = parseInt(process.argv[4] || '9408');
const NRACES = parseInt(process.argv[5] || '4');
const BENCH = process.argv[6] || '';
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    await page.evaluate((v) => localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })), VENUE);
    const allOut = [];
    for (let race = 0; race < NRACES; race++) {
        const seed = SEED0 + race;
        const r = await page.evaluate(async (seed) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(b => b.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
            // land-contact times per boat via the engine's own event (rule 31b)
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
            // full-race 10Hz ledger per boat (kept in-page; episodes + outcomes
            // are derived from it after the race)
            const L = new Map();
            const led = (name) => { let l = L.get(name); if (!l) { l = { t: [], x: [], y: [], kt: [], wig: [], esc: [], av: [], clr: [] }; L.set(name, l); } return l; };
            const prevWig = new Map();
            const triggers = [];
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
                if (it % 6) continue;   // 10Hz instrument
                for (const b of state.boats) {
                    if (b.isPlayer || b.raceState.finished) continue;
                    const c = b.controller;
                    const wig = c && c.wiggleActive ? 1 : 0;
                    const l = led(b.name);
                    l.t.push(+t.toFixed(1)); l.x.push(Math.round(b.x)); l.y.push(Math.round(b.y));
                    l.kt.push(+(b.speed * 4).toFixed(1)); l.wig.push(wig);
                    l.esc.push(c && c.escActive ? 1 : 0);
                    l.av.push(Math.round((b._avDev || 0) * 57.3));
                    l.clr.push(clrAt(b.x, b.y));
                    // rising edge = a fresh trigger; side was just chosen
                    if (wig && !prevWig.get(b.name) && b.raceState.leg >= 1) {
                        const wd = getWindAt(b.x, b.y).direction;
                        const beams = {};
                        for (const sd of [1, -1]) {
                            beams[sd] = [80, 150].map(d => clrAt(
                                b.x + Math.sin(wd + sd * 1.75) * d,
                                b.y - Math.cos(wd + sd * 1.75) * d));
                        }
                        // cause branch, replicated in chain order
                        let cause = 'rand';
                        const rs = b.raceState;
                        const rm = (window.legRoundMark ? legRoundMark(rs.leg) : null) || state.course.roundMark;
                        if (rm && rs.roundArmed && Math.hypot(b.x - rm.x, b.y - rm.y) < (rm.zone || 165) * 1.5) cause = 'round';
                        else {
                            let weedS = 0;
                            if (state.course._hasAwashDrag && rs.leg >= 1 && b.shoalMul != null && b.shoalMul < 0.7
                                && window.VenueDoc && window.VenueDoc.shoalField) {
                                let mPl = 0, mMi = 0;
                                for (const dRW of [80, 150]) {
                                    mPl += window.VenueDoc.shoalField(state.course.islands, b.x + Math.sin(wd + 1.75) * dRW, b.y - Math.cos(wd + 1.75) * dRW);
                                    mMi += window.VenueDoc.shoalField(state.course.islands, b.x + Math.sin(wd - 1.75) * dRW, b.y - Math.cos(wd - 1.75) * dRW);
                                }
                                if (Math.abs(mPl - mMi) > 0.1) weedS = mPl > mMi ? 1 : -1;
                            }
                            if (weedS !== 0) cause = 'weed';
                            else if (c.lowSpeedTimer > 8.0) cause = 'rand8';
                            else {
                                let minD = Infinity;
                                for (const ob of state.boats) { if (ob === b) continue; const q = (ob.x - b.x) ** 2 + (ob.y - b.y) ** 2; if (q < minD) minD = q; }
                                if (state.course.marks) for (const m of state.course.marks) { const q = (m.x - b.x) ** 2 + (m.y - b.y) ** 2; if (q < minD) minD = q; }
                                if (minD < 100 * 100) cause = 'obs';
                            }
                        }
                        const cur = getCurrentAt(b.x, b.y) || { speed: 0, direction: 0 };
                        const ct = CT[b.name] || [];
                        const inC = ct.length && (t - ct[ct.length - 1]) < 0.3 ? 1 : 0;
                        triggers.push({ name: b.name, t: +t.toFixed(1), x: Math.round(b.x), y: Math.round(b.y),
                            leg: rs.leg, side: c.wiggleSide, cause, clr0: clrAt(b.x, b.y), inC,
                            bp: beams[1], bm: beams[-1],
                            curKt: +(cur.speed || 0).toFixed(2), curDir: +(cur.direction || 0).toFixed(2),
                            wd: +wd.toFixed(2), kt: +(b.speed * 4).toFixed(1), lst: +(c.lowSpeedTimer || 0).toFixed(1) });
                    }
                    prevWig.set(b.name, wig);
                }
                if (state.boats.every(b => b.isPlayer || b.raceState.finished)) break;
            }
            // land-contact episodes (2s debounce) + pre-6s ownership from the ledger
            const eps = [];
            const near = (l, tt) => { let lo = 0, hi = l.t.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (l.t[m] < tt) lo = m + 1; else hi = m; } return lo; };
            for (const [name, ct] of Object.entries(CT)) {
                const l = L.get(name);
                let e0 = null, last = null, idx = 0;
                const flush = (t0, t1) => {
                    const ep = { name, idx, t0, t1, dur: +(t1 - t0).toFixed(1) };
                    if (l && l.t.length) {
                        const iE = near(l, t0);
                        ep.x = l.x[Math.min(iE, l.x.length - 1)]; ep.y = l.y[Math.min(iE, l.y.length - 1)];
                        const i0 = near(l, t0 - 6);
                        const n = Math.max(1, iE - i0);
                        let w = 0, e = 0, avM = 0;
                        for (let i = i0; i < iE; i++) { w += l.wig[i]; e += l.esc[i]; if (l.av[i] > avM) avM = l.av[i]; }
                        ep.preWig = +(w / n).toFixed(2); ep.preEsc = +(e / n).toFixed(2);
                        ep.preAvMax = avM; ep.preKt = l.kt[i0];
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
            for (const tr of triggers) {
                const ct = CT[tr.name] || [];
                tr.reB = ct.some(x => x > tr.t + 1.5 && x <= tr.t + 10) ? 1 : 0;
                tr.cw = +(ct.filter(x => x > tr.t && x <= tr.t + 10).length * 0.1).toFixed(1);
                const l = L.get(tr.name);
                if (l && l.t.length) { const i = near(l, tr.t + 10); if (Math.abs(l.t[Math.min(i, l.t.length - 1)] - (tr.t + 10)) < 2) { tr.clr10 = l.clr[Math.min(i, l.clr.length - 1)]; tr.kt10 = l.kt[Math.min(i, l.kt.length - 1)]; } }
            }
            const fins = {};
            for (const b of state.boats) { if (!b.isPlayer) fins[b.name] = b.raceState.finished ? 1 : 0; }
            return { triggers, eps: eps.slice(0, 600), fins, finT,
                     hasAwash: !!state.course._hasAwashDrag };
        }, seed);
        console.log(`race ${race} (seed ${seed}): triggers ${r.triggers.length}, land episodes ${r.eps.length}, fins ${Object.values(r.fins).reduce((a, b) => a + b, 0)}/${Object.keys(r.fins).length}`);
        allOut.push({ seed, ...r });
    }
    const of = path.join(__dirname, `_rb_census_${TREE}_${VENUE}_${SEED0}.json`);
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
