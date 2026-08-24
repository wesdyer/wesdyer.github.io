// ARMED-APPROACH WEDGE CENSUS (2026-08-23, R3 push Phase 1.3 — W1 sizing).
// The named class (icecraft session 2): 9100 t185-195 latch-thrash AT demand
// 78 with roundArmed set — the mark approach is unfaired, un-rejoined water
// (rounding nav does not follow gridPath). ⚠️ roundArmed IS SET FROM ~700u
// OUT, so "while armed" covers the whole approach, not the rounding.
// WEDGE EPISODE = speed*60 < 20 u/s sustained > 2s with nearest floe-hull
// clearance < 60u, while roundArmed. Episode closes when speed > 40 u/s or
// clr > 90u for > 1s. Per episode at ENTRY: owning layer (rule 27
// precedence), on/off gridPath (xtrack 80u), dist-to-mark (u and /zone),
// _rulerMode, leg. Names W1's shape:
//   wedges mostly ON the ruler/entry-hunt line, > 1.2 zones out -> (a) fair
//     the approach line;  mostly INSIDE the zone / entry-hunt churn -> (b)
//     delay the mark-carrot takeover while > 2 zones out.
// FLEET, __CHAR unset (rule 18b — fleet-bench attribution mirror). Rule 2:
// episodes AND s/boat both reported.
//   node _wedge_census.js <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 16;
const SEED0 = parseInt(process.argv[3]) || 9100;
const ROOT = path.join(__dirname, process.argv[4] || 'treeR1C');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic' })); });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const EPS = []; let BOATSEC = 0, ARMSEC = 0, NBOATS = 0;
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const r = await page.evaluate(async (seed) => {
            const segD = (px, py, ax, ay, bx, by) => {
                const dx = bx - ax, dy = by - ay; const L2 = dx * dx + dy * dy;
                let t = L2 ? ((px - ax) * dx + (py - ay) * dy) / L2 : 0; t = Math.max(0, Math.min(1, t));
                return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
            };
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const bots = state.boats.filter(b => !b.isPlayer);
            const pl = state.boats.find(b => b.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
            const dt = 1 / 60;
            const floes = () => state.course._floeObjs || [];
            const eps = [], open = new Map();
            let boatSec = 0, armSec = 0;
            for (let it = 0; it < 60 * 900; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                const t = state.race.timer;
                if (t > 880) break;
                if (it % 6) continue;   // 10 Hz sampling; durations via dt*6 credit
                for (const b of bots) {
                    const rs = b.raceState;
                    if (rs.finished || rs.leg < 1) continue;
                    boatSec += 0.1;
                    if (!rs.roundArmed) { const o = open.get(b); if (o && t - o.lastT > 1.0) { if (o.dur > 2) eps.push(o); open.delete(b); } continue; }
                    armSec += 0.1;
                    const c = b.controller; if (!c) continue;
                    let clr = Infinity;
                    for (const f of floes()) {
                        if (Math.hypot(b.x - f.x, b.y - f.y) > (f.radius || 0) + 400) continue;
                        const cH = floeHullClear(f, b.x, b.y, 0);
                        if (cH < clr) clr = cH;
                    }
                    const slow = (b.speed || 0) * 60 < 20, near = clr < 60;
                    const o = open.get(b);
                    if (slow && near) {
                        if (!o) {
                            const rm = legRoundMark ? (legRoundMark(rs.leg) || state.course.roundMark) : state.course.roundMark;
                            const dRm = rm ? Math.hypot(b.x - rm.x, b.y - rm.y) : null;
                            let xtk = null;
                            const gp = c.gridPath;
                            if (gp && gp.length > 1) {
                                let best = Infinity;
                                for (let k2 = 0; k2 < gp.length - 1; k2++)
                                    best = Math.min(best, segD(b.x, b.y, gp[k2].x, gp[k2].y, gp[k2 + 1].x, gp[k2 + 1].y));
                                xtk = Math.round(best);
                            }
                            const dev = c.lastAvoidDeviationSigned || 0;
                            const layer = c.penaltySpin ? 'pen' : c.escActive ? 'esc'
                                : (c.iceEscapeTimer || 0) > 0 ? 'latch' : c.wiggleActive ? 'wig'
                                    : Math.abs(dev) > 0.09 ? 'avoid' : 'nav';
                            open.set(b, { seed, boat: b.name, t0: +t.toFixed(1), lastT: t, dur: 0.1,
                                layer, xtk, dRm: dRm != null ? Math.round(dRm) : null,
                                zr: rm && rm.zone ? +(dRm / rm.zone).toFixed(2) : null,
                                ruler: !!c._rulerMode, leg: rs.leg, minClr: Math.round(clr) });
                        } else { o.dur += 0.1; o.lastT = t; if (clr < o.minClr) o.minClr = Math.round(clr); }
                    } else if (o && (t - o.lastT > 1.0 || (b.speed || 0) * 60 > 40 || clr > 90)) {
                        if (t - o.lastT > 1.0) { if (o.dur > 2) eps.push(o); open.delete(b); }
                        // else keep 1s grace: only close on sustained recovery
                        else { o.grace = (o.grace || 0) + 0.1; if (o.grace > 1.0) { if (o.dur > 2) eps.push(o); open.delete(b); } }
                    } else if (o) { o.grace = 0; }
                }
            }
            for (const o of open.values()) if (o.dur > 2) eps.push(o);
            return { eps, boatSec, armSec, nBoats: bots.length };
        }, seed);
        EPS.push(...r.eps); BOATSEC += r.boatSec; ARMSEC += r.armSec; NBOATS += r.nBoats;
        console.log(`seed ${seed}: ${r.eps.length} wedge episodes  (${r.eps.reduce((a, e) => a + e.dur, 0).toFixed(0)}s total)`);
    }
    await browser.close();
    const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : NaN; };
    const totS = EPS.reduce((a, e) => a + e.dur, 0);
    console.log(`\n=== ARMED-APPROACH WEDGE CENSUS (${TRIALS} seeds, ${path.basename(ROOT)}) ===`);
    console.log(`${EPS.length} episodes, ${totS.toFixed(0)}s total = ${(EPS.length / NBOATS).toFixed(2)} ep/boat, ${(totS / NBOATS).toFixed(1)} s/boat  (armed exposure ${(ARMSEC / NBOATS).toFixed(0)} s/boat)`);
    if (EPS.length) {
        console.log(`dur p25/med/p75/p90: ${q(EPS.map(e => e.dur), .25).toFixed(1)}/${q(EPS.map(e => e.dur), .5).toFixed(1)}/${q(EPS.map(e => e.dur), .75).toFixed(1)}/${q(EPS.map(e => e.dur), .9).toFixed(1)}s`);
        const lay = {}; for (const e of EPS) lay[e.layer] = (lay[e.layer] || 0) + 1;
        console.log(`layer at entry: ${Object.entries(lay).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join('  ')}`);
        const xt = EPS.map(e => e.xtk).filter(x => x != null);
        console.log(`xtrack at entry p25/med/p75: ${q(xt, .25)}/${q(xt, .5)}/${q(xt, .75)}u  ON-path(<80): ${(100 * xt.filter(x => x < 80).length / xt.length).toFixed(0)}%`);
        const zr = EPS.map(e => e.zr).filter(x => x != null);
        console.log(`dist/zone at entry p25/med/p75: ${q(zr, .25)}/${q(zr, .5)}/${q(zr, .75)}  inside-zone(<1): ${(100 * zr.filter(x => x < 1).length / zr.length).toFixed(0)}%  1-2.1 (ruler band): ${(100 * zr.filter(x => x >= 1 && x < 2.1).length / zr.length).toFixed(0)}%  >2.1: ${(100 * zr.filter(x => x >= 2.1).length / zr.length).toFixed(0)}%`);
        console.log(`rulerMode at entry: ${(100 * EPS.filter(e => e.ruler).length / EPS.length).toFixed(0)}%   time by band: inside ${EPS.filter(e => e.zr != null && e.zr < 1).reduce((a, e) => a + e.dur, 0).toFixed(0)}s / ruler ${EPS.filter(e => e.zr != null && e.zr >= 1 && e.zr < 2.1).reduce((a, e) => a + e.dur, 0).toFixed(0)}s / outside ${EPS.filter(e => e.zr != null && e.zr >= 2.1).reduce((a, e) => a + e.dur, 0).toFixed(0)}s`);
    }
    fs.writeFileSync(path.join(__dirname, `_wedge_census_${path.basename(ROOT)}_${SEED0}.json`), JSON.stringify(EPS, null, 1));
    console.log(`wrote _wedge_census_${path.basename(ROOT)}_${SEED0}.json`);
})();
