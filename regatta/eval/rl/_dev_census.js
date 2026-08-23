// THE DEVIATION CENSUS (2026-08-22, the C4 avoidance-honesty push, Phase 1.1).
// Every AVOID_NONE deviation EPISODE (rule 2 — episodes, 0.5s dedup) on legs
// 1-2: trigger object (floe-hit / floe-shave / land / none-visible on the
// UNDEVIATED heading), range at onset, magnitude/duration, and the
// COUNTERFACTUAL — project the undeviated heading h0 = _lastAvoidChoice −
// lastAvoidDeviationSigned straight for 5s WITH floe drift (driftVx/driftVy,
// spin advanced by spinRate — same prediction the engine's floeHullClear
// makes) and ask: would it have cleared at his margins?
//   PHANTOM  = min clearance >= 78u  (his p25 clearance-at-tack)
//   SHAVE    = 28-78u                (his measured floe shave band)
//   REAL     = < 28u or a hull hit
// Clearance = min segment distance to the floe's localHull polygon — the
// SAME computation as _board_ladder.js's floeClearance, so his profile and
// the bot's are comparable. Also emits the bot's floe-CPA encounter profile
// (encounter = contiguous frames with nearest-floe clearance < 300u; one
// min-clearance per episode) for the P2 comparison.
// Solo mode = neutral hero (the _c2_solo pattern); fleet mode = all bots,
// __CHAR unset (rule 18b — the fleet-bench attribution mirror).
//   node _dev_census.js <solo|fleet> <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const MODE = process.argv[2] || 'solo';
const TRIALS = parseInt(process.argv[3]) || 4;
const SEED0 = parseInt(process.argv[4]) || 9100;
const ROOT = path.join(__dirname, process.argv[5] || 'treeC2');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic' })); });
    if (MODE === 'solo') await page.addInitScript(() => { window.__CHAR = { neutral: 1 }; });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const EP = [], ENC = [];
    const TIME = {}; // per-leg accumulators
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const r = await page.evaluate(async ({ seed, solo }) => {
            const wrap = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
            const segD = (px, py, ax, ay, bx, by) => {
                const dx = bx - ax, dy = by - ay; const L2 = dx * dx + dy * dy;
                let t = L2 ? ((px - ax) * dx + (py - ay) * dy) / L2 : 0; t = Math.max(0, Math.min(1, t));
                return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
            };
            // clearance from point (px,py) to floe f as it will sit at +t seconds
            const floeClr = (f, px, py, t) => {
                if (!f.localHull || !f.localHull.length) return Math.hypot(px - f.x, py - f.y) - (f.radius || 0);
                const fx = f.x + (f.driftVx || 0) * t, fy = f.y + (f.driftVy || 0) * t;
                const sp = (f.spin || 0) + (f.spinRate || 0) * t;
                const c = Math.cos(sp), s = Math.sin(sp);
                const pts = f.localHull.map(p => [fx + p.x * c - p.y * s, fy + p.x * s + p.y * c]);
                let best = Infinity;
                for (let i2 = 0; i2 < pts.length; i2++) {
                    const a = pts[i2], b = pts[(i2 + 1) % pts.length];
                    best = Math.min(best, segD(px, py, a[0], a[1], b[0], b[1]));
                }
                return best;
            };
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const bots = state.boats.filter(b => !b.isPlayer);
            const pl = state.boats.find(b => b.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
            let tracked = bots;
            if (solo) {
                tracked = [bots[0]];
                for (let k = 1; k < bots.length; k++) { bots[k].x = 1e6 + k * 500; bots[k].y = 1e6; bots[k].raceState.finished = true; }
            }
            const dt = 1 / 60;
            const eps = [], encs = [], time = {}; // time keys: leg -> {racing, devNone}
            const st = new Map(); // boat.id -> {ep, lastDevT, enc}
            const floes = () => (state.course.islands || []).filter(i2 => i2.isFloe);
            for (let it = 0; it < 60 * 900; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                const t = state.race.timer;
                if (t > 880) break;
                for (const bt of tracked) {
                    if (bt.raceState.finished) continue;
                    const leg = bt.raceState.leg;
                    if (leg !== 1 && leg !== 2) continue;
                    const c = bt.controller; if (!c) continue;
                    const T = time[leg] = time[leg] || { racing: 0, devNone: 0, vmgLoss: 0 };
                    T.racing += dt;
                    const devS = c.lastAvoidDeviationSigned || 0;
                    const deviated = Math.abs(devS) > 0.09;
                    let rng = Infinity;
                    if (!solo) {
                        for (const ob of state.boats) {
                            if (ob === bt || ob.isPlayer || ob.raceState.finished) continue;
                            const d = Math.hypot(ob.x - bt.x, ob.y - bt.y);
                            if (d < rng) rng = d;
                        }
                    }
                    const roleNone = !c.avoidanceRole || c.avoidanceRole === 'NONE';
                    const avNone = deviated && roleNone && !c.threatBoat && (solo || rng > 300)
                        && !c.wiggleActive && !c.escActive && !bt.raceState.penalty;
                    let s = st.get(bt.id);
                    if (!s) { s = { ep: null, enc: null }; st.set(bt.id, s); }
                    if (avNone) {
                        T.devNone += dt;
                        T.vmgLoss += (1 - Math.cos(devS)) * dt;
                        if (s.ep && t - s.ep.lastT <= 0.5) {
                            s.ep.lastT = t; s.ep.dur = t - s.ep.t0;
                            s.ep.maxDev = Math.max(s.ep.maxDev, Math.abs(devS));
                        } else {
                            if (s.ep) eps.push(s.ep);
                            // ONSET: classify trigger + counterfactual on h0
                            const h0 = wrap((c._lastAvoidChoice != null ? c._lastAvoidChoice : bt.heading) - devS);
                            const hx = Math.sin(h0), hy = -Math.cos(h0);
                            const v = Math.max(40, (bt.speed || 0) * 60);
                            const FL = floes();
                            // counterfactual walk: 0..5s at 0.25s steps, drifted floes
                            let cfMin = Infinity, cfRange = null, landAt = null;
                            // LAND via the STATIC grid — botGrid carries fat
                            // floe stamps, which would misfile stamped-floe
                            // phantoms as honest land (rule 18 audit catch).
                            const g = state.course._botGridStatic || state.course.botGrid;
                            for (let k = 1; k <= 20; k++) {
                                const tt = k * 0.25;
                                const px = bt.x + hx * v * tt, py = bt.y + hy * v * tt;
                                for (const f of FL) {
                                    if (Math.hypot(px - f.x, py - f.y) > (f.radius || 0) + 600) continue;
                                    const clr = floeClr(f, px, py, tt);
                                    if (clr < cfMin) { cfMin = clr; cfRange = v * tt; }
                                }
                                if (landAt == null && g) {
                                    const cc = g.cell(px, py);
                                    if (!g.at(cc[0], cc[1])) {
                                        let onFloe = false;
                                        for (const f of FL) if (floeClr(f, px, py, tt) < 25) { onFloe = true; break; }
                                        if (!onFloe) landAt = v * tt;
                                    }
                                }
                            }
                            // nearest floe clearance right now (range at onset)
                            let nowClr = Infinity;
                            for (const f of FL) {
                                if (Math.hypot(bt.x - f.x, bt.y - f.y) > (f.radius || 0) + 1500) continue;
                                nowClr = Math.min(nowClr, floeClr(f, bt.x, bt.y, 0));
                            }
                            const trig = (landAt != null && (cfMin > 40 || landAt < cfRange)) ? 'land'
                                : cfMin < 40 ? 'floe-hit' : cfMin < 120 ? 'floe-shave' : 'none-visible';
                            const cf = landAt != null ? 'LAND' : cfMin >= 78 ? 'PHANTOM' : cfMin >= 28 ? 'SHAVE' : 'REAL';
                            s.ep = { seed, n: bt.name, leg, t0: +t.toFixed(1), lastT: t, dur: dt,
                                maxDev: Math.abs(devS), trig, cf,
                                cfMin: cfMin === Infinity ? null : Math.round(cfMin),
                                nowClr: nowClr === Infinity ? null : Math.round(nowClr),
                                armed: bt.raceState.roundArmed ? 1 : 0 };
                        }
                    } else if (s.ep && t - s.ep.lastT > 0.5) { eps.push(s.ep); s.ep = null; }
                    // floe ENCOUNTER profile (bot side of P2)
                    let nf = Infinity;
                    const FL2 = floes();
                    for (const f of FL2) {
                        if (Math.hypot(bt.x - f.x, bt.y - f.y) > (f.radius || 0) + 800) continue;
                        nf = Math.min(nf, floeClr(f, bt.x, bt.y, 0));
                    }
                    if (nf < 300) {
                        if (s.enc) { s.enc.min = Math.min(s.enc.min, nf); s.enc.lastT = t; }
                        else s.enc = { seed, n: bt.name, leg, min: nf, lastT: t };
                    } else if (s.enc && t - s.enc.lastT > 1.0) { encs.push(s.enc); s.enc = null; }
                }
            }
            for (const s of st.values()) { if (s.ep) eps.push(s.ep); if (s.enc) encs.push(s.enc); }
            return { eps, encs, time, nb: tracked.length };
        }, { seed, solo: MODE === 'solo' });
        EP.push(...r.eps); ENC.push(...r.encs);
        for (const L of Object.keys(r.time)) {
            const T = TIME[L] = TIME[L] || { racing: 0, devNone: 0, vmgLoss: 0, nb: 0 };
            T.racing += r.time[L].racing; T.devNone += r.time[L].devNone;
            T.vmgLoss += r.time[L].vmgLoss; T.nb += r.nb;
        }
        console.log(`seed ${seed}: ${r.eps.length} episodes, ${r.encs.length} floe encounters`);
    }
    await browser.close();
    const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : NaN; };
    console.log(`\n=== DEVIATION CENSUS (${MODE}, ${TRIALS} seeds, ${path.basename(ROOT)}) — AVOID_NONE episodes, legs 1-2 ===`);
    for (const L of [1, 2]) {
        const T = TIME[L]; if (!T) continue;
        console.log(`leg ${L}: AVOID_NONE deviated ${(T.devNone / T.nb).toFixed(1)} s/boat-leg  (VMG-weighted ${(T.vmgLoss / T.nb).toFixed(1)} s lost/boat-leg)  racing ${(T.racing / T.nb).toFixed(0)} s/boat`);
    }
    console.log(`\n${EP.length} episodes — trigger x counterfactual:`);
    const cls = {};
    for (const e of EP) { const k = `${e.trig}/${e.cf}${e.armed ? '/armed' : ''}`; cls[k] = cls[k] || { n: 0, dur: 0 }; cls[k].n++; cls[k].dur += e.dur; }
    for (const [k, v] of Object.entries(cls).sort((a, b2) => b2[1].dur - a[1].dur))
        console.log(`  ${k.padEnd(30)} n=${String(v.n).padStart(4)}  ${v.dur.toFixed(0).padStart(5)}s total  (${(v.dur / v.n).toFixed(1)}s/ep)`);
    const durs = EP.map(e => e.dur), devs = EP.map(e => e.maxDev * 180 / Math.PI), rngs = EP.map(e => e.nowClr).filter(x => x != null);
    console.log(`episode dur p25/med/p75: ${q(durs, .25).toFixed(1)}/${q(durs, .5).toFixed(1)}/${q(durs, .75).toFixed(1)}s  maxDev med ${q(devs, .5).toFixed(0)}deg  nearest-floe-at-onset p25/med/p75: ${q(rngs, .25)}/${q(rngs, .5)}/${q(rngs, .75)}u`);
    const cfm = EP.map(e => e.cfMin).filter(x => x != null);
    console.log(`counterfactual min-clearance p10/p25/med/p75: ${q(cfm, .1)}/${q(cfm, .25)}/${q(cfm, .5)}/${q(cfm, .75)}u  (his margins: shave 28-50, p25-at-tack 78, med 179)`);
    console.log(`\nBOT FLOE-CPA PROFILE (${ENC.length} encounters <300u): min-clr p10/p25/med/p75: ${q(ENC.map(e => e.min), .1).toFixed(0)}/${q(ENC.map(e => e.min), .25).toFixed(0)}/${q(ENC.map(e => e.min), .5).toFixed(0)}/${q(ENC.map(e => e.min), .75).toFixed(0)}u  per boat-race: ${(ENC.length / (TRIALS * (MODE === 'solo' ? 1 : 9))).toFixed(1)}`);
    fs.writeFileSync(path.join(__dirname, `_dev_census_${MODE}.json`), JSON.stringify({ EP, ENC, TIME }, null, 1));
    console.log(`wrote _dev_census_${MODE}.json`);
})();
