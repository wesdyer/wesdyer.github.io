// SWAMP STALL-MACHINE ANATOMY (2026-08-25, the swamp push, P1).
//
// The 08-21 brief: the clean line THREADS weed corridors; 48% of stalls are
// within 150u of the planned route; in mul-0.1 weed 4kt cannot restart. This
// probe answers the P1 questions the candidates hang on:
//   1. WHICH LAYER puts the boat into weed — wiggle / escape / avoidance
//      deviation / plain navigation (board choice)? Episodes, not frames
//      (rule 2): a weed ENTRY is mul<0.7 after >=2s of mul>=0.9.
//   2. Is the PLAN itself clean where the boat enters weed (weed-on-path
//      check at the nearest gridPath point), i.e. scatter vs planned weed?
//   3. Stall/restart anatomy: entries to sub-1kt, mul at entry, time to
//      restart, wiggle share during the stall, net displacement.
//   4. Execution scatter: lateral offset off the boat's own gridPath and
//      off the static DMC leg line, during normal (unstalled) sailing.
//
// ⚠️ conventions: kt = speed*4 (rule 31); TWA 0 = head-to-wind (rule 19);
// shoalFieldAt returns a MULTIPLIER, 1.0 = clean (the inverted-label trap);
// controllers are lazy — wrap applyAvoidance per frame (_rights_use idiom);
// _avDev zeroed BEFORE update (rule 27b: penalty spin skips avoidance).
//
//   node _sw_anat.js <trials> <seed0> <tree> [venue]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 4;
const SEED0 = parseInt(process.argv[3]) || 9400;
const ROOT = path.join(__dirname, process.argv[4] || 'treeSW0');
const VENUE = process.argv[5] || 'swamp';
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const weedEps = [], stallEps = [], scatter = [], boatTotals = [];
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const r = await page.evaluate(async (seed) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(b => b.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
            const norm = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
            const wrapAll = () => {
                for (const bo of state.boats) {
                    if (bo.isPlayer) continue;
                    const c = bo.controller;
                    if (!c || !c.applyAvoidance || c.__swrapped) continue;
                    const orig = c.applyAvoidance.bind(c);
                    c.applyAvoidance = (dh, sr) => { const out = orig(dh, sr); bo._avDev = Math.abs(norm(out - dh)); return out; };
                    c.__swrapped = 1;
                }
            };
            const mulAt = (x, y) => window.VenueDoc.shoalField(state.course.islands, x, y);
            // static reference line: the DMC leg paths (the authored clean line)
            const dmcDist = (leg, x, y) => {
                const L = state.course.dmc && state.course.dmc.legs && state.course.dmc.legs[leg];
                if (!L || !L.pts || L.pts.length < 2) return null;
                let best = Infinity;
                for (let k = 0; k < L.pts.length - 1; k++) {
                    const a = L.pts[k], b = L.pts[k + 1];
                    const ex = b.x - a.x, ey = b.y - a.y, l2 = ex * ex + ey * ey;
                    let t = l2 < 1e-6 ? 0 : ((x - a.x) * ex + (y - a.y) * ey) / l2;
                    t = t < 0 ? 0 : t > 1 ? 1 : t;
                    const dx = x - (a.x + ex * t), dy = y - (a.y + ey * t);
                    const dd = dx * dx + dy * dy;
                    if (dd < best) best = dd;
                }
                return Math.sqrt(best);
            };
            const gridDist = (c, x, y) => {
                // nearest remaining point on the boat's own planned gridPath +
                // the plan's OWN weed status there (weed-on-path discriminator)
                if (!c || !c.gridPath || !c.gridPath.length) return null;
                let best = Infinity, bp = null;
                for (const p of c.gridPath) {
                    const dd = (x - p.x) ** 2 + (y - p.y) ** 2;
                    if (dd < best) { best = dd; bp = p; }
                }
                return { d: Math.sqrt(best), pathMul: bp ? mulAt(bp.x, bp.y) : null };
            };
            const S = new Map();   // per-boat state machine
            const weedEps = [], stallEps = [], scatter = [];
            const DT = 1 / 60; let it = 0;
            const N = 3;           // sample every 3rd frame = 0.05s credit each (rule 18)
            while (it < 900 * 60) {
                for (const bo of state.boats) bo._avDev = 0;
                wrapAll();
                update(DT); it++;
                if (state.race.status !== 'racing') continue;
                if (state.race.timer > 900) break;
                if (it % N) continue;
                const t = state.race.timer;
                let allDone = true;
                for (const b of state.boats) {
                    if (b.isPlayer) continue;
                    if (b.raceState.finished || b.raceState.leg < 1) { if (!b.raceState.finished) allDone = false; continue; }
                    allDone = false;
                    const c = b.controller;
                    let s = S.get(b.id);
                    if (!s) { s = { cleanT: 0, weed: null, stall: null, slowT: 0, wigT: 0, avT: 0, escT: 0, kt1: 0,
                                    weedT: 0, stallT: 0, raceT: 0, recentAv: 0, recentWig: 0, recentEsc: 0 }; S.set(b.id, s); }
                    const dt = N * DT;
                    s.raceT += dt;
                    const mul = (b.shoalMul != null) ? b.shoalMul : 1;
                    const kt = b.speed * 4;
                    const wig = !!(c && c.wiggleActive), esc = !!(c && c.escActive);
                    const avDev = (b._avDev || 0) * 57.3;
                    // decayed "recent owner" signals (~1.2s memory)
                    const dk = Math.exp(-dt / 1.2);
                    s.recentAv = Math.max(avDev, s.recentAv * dk);
                    s.recentWig = wig ? 1 : s.recentWig * dk;
                    s.recentEsc = esc ? 1 : s.recentEsc * dk;
                    if (mul < 0.7) s.weedT += dt;
                    if (wig) s.wigT += dt;
                    // ----- weed episode machine -----
                    // ⚠️ NO clean-run precondition: weed edges FEATHER, so mul
                    // always passes through 0.7-0.9 on the way in and a
                    // "2s of mul>=0.9 first" gate never fires (rule 4 catch:
                    // first run read 0 episodes beside 74 stalls). Hysteresis +
                    // a 2s gap since the last episode closed is the debounce.
                    if (!s.weed) {
                        s.gapT = (s.gapT || 0) + dt;
                        if (mul < 0.7 && s.gapT >= 2) {
                            const gd = gridDist(c, b.x, b.y);
                            const w = getWindAt(b.x, b.y);
                            const twa = Math.abs(norm(b.heading - w.direction)) * 57.3;
                            let owner = 'nav';
                            if (s.recentWig > 0.35) owner = 'wiggle';
                            else if (s.recentEsc > 0.35) owner = 'escape';
                            else if (s.recentAv > 8) owner = 'avoid';
                            s.weed = { t0: t, x0: b.x, y0: b.y, owner, twa: Math.round(twa),
                                       mode: twa < 90 ? 'beat' : 'run', ktIn: +kt.toFixed(2),
                                       mulIn: +mul.toFixed(2), minMul: mul, minKt: kt,
                                       gridD: gd ? Math.round(gd.d) : null,
                                       pathMul: gd && gd.pathMul != null ? +gd.pathMul.toFixed(2) : null,
                                       dmcD: (() => { const d = dmcDist(b.raceState.leg, b.x, b.y); return d == null ? null : Math.round(d); })(),
                                       stalled: 0, exitClean: 0 };
                        }
                    } else {
                        s.weed.minMul = Math.min(s.weed.minMul, mul);
                        s.weed.minKt = Math.min(s.weed.minKt, kt);
                        if (mul >= 0.9) s.weed.exitClean += dt; else s.weed.exitClean = 0;
                        if (s.weed.exitClean >= 1 || b.raceState.finished) {
                            s.weed.dur = +(t - s.weed.t0).toFixed(1);
                            s.weed.n = b.name; s.weed.leg = b.raceState.leg;
                            weedEps.push(s.weed); s.weed = null; s.gapT = 0;
                        }
                    }
                    // ----- stall episode machine (sub-1kt >= 3s) -----
                    if (!s.stall) {
                        s.slowT = kt < 1.0 ? s.slowT + dt : 0;
                        if (s.slowT >= 3) {
                            s.stall = { t0: t - 3, x0: b.x, y0: b.y, mul: +mul.toFixed(2),
                                        inWeed: mul < 0.7 ? 1 : 0, wigT: 0, fastT: 0,
                                        owner: s.weed ? s.weed.owner : (s.recentWig > 0.35 ? 'wiggle' : s.recentEsc > 0.35 ? 'escape' : s.recentAv > 8 ? 'avoid' : 'nav') };
                            if (s.weed) s.weed.stalled = 1;
                        }
                    } else {
                        if (wig) s.stall.wigT += dt;
                        if (kt >= 1.0) s.stall.fastT += dt; else s.stall.fastT = 0;
                        if (s.stall.fastT >= 2 || b.raceState.finished) {
                            s.stall.dur = +((t - s.stall.t0) - s.stall.fastT).toFixed(1);
                            s.stall.disp = Math.round(Math.hypot(b.x - s.stall.x0, b.y - s.stall.y0));
                            s.stall.mulOut = +mul.toFixed(2);
                            s.stall.n = b.name; s.stall.leg = b.raceState.leg;
                            stallEps.push(s.stall); s.stallT += s.stall.dur; s.stall = null; s.slowT = 0;
                        }
                    }
                    // ----- scatter sample @1Hz, normal sailing only -----
                    if (!(it % 60) && kt >= 1.0 && !wig && !esc) {
                        const gd = gridDist(c, b.x, b.y);
                        if (gd) scatter.push({ d: Math.round(gd.d), mul: +mul.toFixed(2),
                                               dmc: (() => { const d = dmcDist(b.raceState.leg, b.x, b.y); return d == null ? null : Math.round(d); })() });
                    }
                }
                if (allDone) break;
            }
            const totals = [];
            for (const b of state.boats) {
                if (b.isPlayer) continue;
                const s = S.get(b.id); if (!s) continue;
                totals.push({ n: b.name, fin: b.raceState.finished ? +state.race.timer.toFixed(0) : null,
                              finT: b.raceState.finished && b.raceState.finishTime != null ? +b.raceState.finishTime.toFixed(0) : null,
                              raceT: +s.raceT.toFixed(0), weedT: +s.weedT.toFixed(0),
                              stallT: +s.stallT.toFixed(0), wigT: +s.wigT.toFixed(0) });
            }
            return { weedEps, stallEps, scatter, totals };
        }, seed);
        for (const e of r.weedEps) { e.seed = seed; weedEps.push(e); }
        for (const e of r.stallEps) { e.seed = seed; stallEps.push(e); }
        for (const e of r.scatter) scatter.push(e);
        for (const e of r.totals) { e.seed = seed; boatTotals.push(e); }
        console.log(`seed ${seed}: ${r.weedEps.length} weed eps, ${r.stallEps.length} stalls`);
    }
    await browser.close();
    const q = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(p * (s.length - 1))] : NaN; };
    const pct = (n, d) => d ? (100 * n / d).toFixed(0) + '%' : '-';
    console.log(`\n===== WEED ENTRIES (mul<0.7 after 2s clean): ${weedEps.length} episodes =====`);
    for (const mode of ['beat', 'run']) {
        const eps = weedEps.filter(e => e.mode === mode);
        if (!eps.length) continue;
        console.log(`-- ${mode} (${eps.length}, ${pct(eps.length, weedEps.length)}) — stalled ${pct(eps.filter(e => e.stalled).length, eps.length)}`);
        for (const o of ['nav', 'avoid', 'wiggle', 'escape']) {
            const g = eps.filter(e => e.owner === o);
            if (!g.length) continue;
            const st = g.filter(e => e.stalled).length;
            console.log(`   ${o.padEnd(7)} ${String(g.length).padStart(4)} (${pct(g.length, eps.length)})  stall-> ${pct(st, g.length)}  minMul p50 ${q(g.map(e => e.minMul), .5).toFixed(2)}  dur p50 ${q(g.map(e => e.dur), .5).toFixed(1)}s  gridD p50 ${q(g.map(e => e.gridD).filter(x => x != null), .5)}u`);
        }
    }
    const wp = weedEps.filter(e => e.pathMul != null);
    console.log(`weed-on-PATH at entry (plan's nearest pt mul<0.9): ${pct(wp.filter(e => e.pathMul < 0.9).length, wp.length)} of ${wp.length}`);
    const gds = weedEps.map(e => e.gridD).filter(x => x != null);
    const dms = weedEps.map(e => e.dmcD).filter(x => x != null);
    console.log(`entry dist to OWN gridPath p25/50/75: ${q(gds, .25)}/${q(gds, .5)}/${q(gds, .75)}u   to DMC line: ${q(dms, .25)}/${q(dms, .5)}/${q(dms, .75)}u`);
    console.log(`\n===== STALLS (sub-1kt >=3s): ${stallEps.length} =====`);
    console.log(`in weed at entry: ${pct(stallEps.filter(e => e.inWeed).length, stallEps.length)}   mul at entry p25/50/75: ${q(stallEps.map(e => e.mul), .25).toFixed(2)}/${q(stallEps.map(e => e.mul), .5).toFixed(2)}/${q(stallEps.map(e => e.mul), .75).toFixed(2)}`);
    console.log(`duration p50/p90/max: ${q(stallEps.map(e => e.dur), .5).toFixed(1)}/${q(stallEps.map(e => e.dur), .9).toFixed(1)}/${Math.max(...stallEps.map(e => e.dur), 0).toFixed(1)}s   displacement during p50: ${q(stallEps.map(e => e.disp), .5)}u`);
    console.log(`wiggle share of stall time: ${pct(stallEps.reduce((a, e) => a + e.wigT, 0), stallEps.reduce((a, e) => a + e.dur, 0))}   mul at RESTART p50: ${q(stallEps.map(e => e.mulOut), .5).toFixed(2)}`);
    for (const o of ['nav', 'avoid', 'wiggle', 'escape']) {
        const g = stallEps.filter(e => e.owner === o);
        if (g.length) console.log(`   owner ${o.padEnd(7)} ${String(g.length).padStart(4)} (${pct(g.length, stallEps.length)})  dur p50 ${q(g.map(e => e.dur), .5).toFixed(1)}s`);
    }
    console.log(`\n===== SCATTER (1Hz, kt>=1, no wiggle/escape): ${scatter.length} samples =====`);
    console.log(`|off own gridPath| p50/p75/p90: ${q(scatter.map(s => s.d), .5)}/${q(scatter.map(s => s.d), .75)}/${q(scatter.map(s => s.d), .9)}u`);
    const dmc2 = scatter.map(s => s.dmc).filter(x => x != null);
    console.log(`|off DMC line|    p50/p75/p90: ${q(dmc2, .5)}/${q(dmc2, .75)}/${q(dmc2, .9)}u`);
    for (const [lo, hi] of [[0, 50], [50, 100], [100, 150], [150, 250], [250, 1e9]]) {
        const g = scatter.filter(s => s.d >= lo && s.d < hi);
        if (g.length) console.log(`   gridD ${String(lo).padStart(3)}-${hi > 1e8 ? 'inf' : hi}: ${pct(g.length, scatter.length)} of time, weed(mul<0.7) ${pct(g.filter(s => s.mul < 0.7).length, g.length)}`);
    }
    const fins = boatTotals.filter(b => b.fin != null), dnfs = boatTotals.filter(b => b.fin == null);
    console.log(`\n===== BOAT TOTALS: ${fins.length} fin / ${dnfs.length} DNF =====`);
    console.log(`finishers: stallT p50 ${q(fins.map(b => b.stallT), .5)}s  weedT p50 ${q(fins.map(b => b.weedT), .5)}s  wigT p50 ${q(fins.map(b => b.wigT), .5)}s of raceT p50 ${q(fins.map(b => b.raceT), .5)}s`);
    if (dnfs.length) console.log(`DNFs:      stallT p50 ${q(dnfs.map(b => b.stallT), .5)}s  weedT p50 ${q(dnfs.map(b => b.weedT), .5)}s  wigT p50 ${q(dnfs.map(b => b.wigT), .5)}s of raceT p50 ${q(dnfs.map(b => b.raceT), .5)}s`);
    // filename carries the tree — three gate runs overwrote one file before
    // this stamp existed (baseline numbers survive only in the session log)
    const stamp = (process.argv[4] || 'treeSW0').replace(/[^\w]/g, '');
    fs.writeFileSync(path.join(__dirname, `_sw_anat_${stamp}.json`), JSON.stringify({ weedEps, stallEps, boatTotals }));
    console.log(`rows → _sw_anat_${stamp}.json`);
})();
