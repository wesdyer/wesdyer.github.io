// ARMED-CRAWL ATTRIBUTION (2026-08-22, C4 push, Phase 1.5 — MEASUREMENT
// ONLY; radius selection and arrival/laning x2 are CLOSED families).
// The crawl: 69.3 s/boat slow time in the dRM 300-1200u band, 89% armed.
// This census asks WHEN arming happens and WHAT changes at arm:
//  - dRM at the moment roundArmed first sets (per boat, leg 1) vs the zone
//  - time and ground distance from arm to rounding vs the straight line
//  - in-band speed and deviation, armed vs unarmed frames (same dRM band,
//    so the comparison is apples-to-apples)
//  - while armed+slow: role and deviation class (the crawl's ownership)
//   node _arm_census.js <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 4;
const SEED0 = parseInt(process.argv[3]) || 9400;
const ROOT = path.join(__dirname, process.argv[4] || 'treeC2');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic' })); });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const BOATS = [];
    let bandAgg = null;
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const r = await page.evaluate(async (seed) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(b => b.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
            const dt = 1 / 60;
            const B = new Map(); // id -> per-boat record
            const band = { armT: 0, armSlow: 0, unT: 0, unSlow: 0, armDev: 0, unDev: 0,
                slowRole: {}, slowDev: 0, slowNoDev: 0 };
            const rmOf = () => (typeof legRoundMark === 'function' ? legRoundMark(1) : null) || state.course.roundMark;
            for (let it = 0; it < 60 * 900; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                const t = state.race.timer;
                if (t > 880) break;
                const rm = rmOf(); if (!rm) continue;
                for (const bt of state.boats) {
                    if (bt.isPlayer || bt.raceState.finished) continue;
                    const rs = bt.raceState;
                    let rec = B.get(bt.id);
                    if (!rec) { rec = { n: bt.name, armed: false, armT: null, armD: null,
                        roundT: null, odo: 0, px: bt.x, py: bt.y, wasLeg1: false }; B.set(bt.id, rec); }
                    if (rs.leg === 1) {
                        rec.wasLeg1 = true;
                        const dM = Math.hypot(bt.x - rm.x, bt.y - rm.y);
                        if (rs.roundArmed && !rec.armed) {
                            rec.armed = true; rec.armT = t; rec.armD = dM;
                            rec.armX = bt.x; rec.armY = bt.y;
                        }
                        if (rec.armed && rec.roundT == null) {
                            rec.odo += Math.hypot(bt.x - rec.px, bt.y - rec.py);
                        }
                        rec.px = bt.x; rec.py = bt.y;
                        // in-band armed-vs-unarmed comparison
                        if (dM >= 300 && dM < 1200) {
                            const v = (bt.speed || 0) * 60;
                            const c = bt.controller || {};
                            const dev = Math.abs(c.lastAvoidDeviationSigned || 0) > 0.09;
                            if (rs.roundArmed) {
                                band.armT += dt; if (v < 80) band.armSlow += dt;
                                if (dev) band.armDev += dt;
                                if (v < 80) {
                                    const k = (c.avoidanceRole || 'NONE') + (c.threatBoat ? '/thr' : '');
                                    band.slowRole[k] = (band.slowRole[k] || 0) + dt;
                                    if (dev) band.slowDev += dt; else band.slowNoDev += dt;
                                }
                            } else {
                                band.unT += dt; if (v < 80) band.unSlow += dt;
                                if (dev) band.unDev += dt;
                            }
                        }
                    } else if (rec.wasLeg1 && rec.roundT == null) {
                        rec.roundT = t;
                    }
                }
            }
            const out = [];
            for (const rec of B.values()) {
                if (!rec.wasLeg1) continue;
                out.push({ n: rec.n, armT: rec.armT, armD: rec.armD == null ? null : Math.round(rec.armD),
                    roundT: rec.roundT, odo: Math.round(rec.odo),
                    straight: rec.armX == null ? null : Math.round(Math.hypot(rec.armX - rmOf().x, rec.armY - rmOf().y)) });
            }
            return { boats: out, band, zone: rmOf() ? Math.round(rmOf().zone || 0) : null };
        }, seed);
        BOATS.push(...r.boats.map(x => ({ ...x, seed })));
        if (!bandAgg) bandAgg = r.band; else {
            for (const k of ['armT', 'armSlow', 'unT', 'unSlow', 'armDev', 'unDev', 'slowDev', 'slowNoDev']) bandAgg[k] += r.band[k];
            for (const k of Object.keys(r.band.slowRole)) bandAgg.slowRole[k] = (bandAgg.slowRole[k] || 0) + r.band.slowRole[k];
        }
        console.log(`seed ${seed}: ${r.boats.length} boats, zone ${r.zone}u`);
    }
    await browser.close();
    const nb = BOATS.length;
    const q = (a, p) => { const s = a.filter(x => x != null).sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : NaN; };
    console.log(`\n=== ARM CENSUS (${TRIALS} seeds, ${path.basename(ROOT)}) — leg 1 ===`);
    console.log(`dRM at arm: p25/med/p75 ${q(BOATS.map(b => b.armD), .25)}/${q(BOATS.map(b => b.armD), .5)}/${q(BOATS.map(b => b.armD), .75)}u`);
    const armToRound = BOATS.filter(b => b.armT != null && b.roundT != null).map(b => b.roundT - b.armT);
    console.log(`arm->round time: p25/med/p75 ${q(armToRound, .25).toFixed(0)}/${q(armToRound, .5).toFixed(0)}/${q(armToRound, .75).toFixed(0)}s  (n=${armToRound.length}/${nb})`);
    const ratio = BOATS.filter(b => b.odo && b.straight).map(b => b.odo / Math.max(1, b.straight));
    console.log(`arm->round ground/straight ratio: p25/med/p75 ${q(ratio, .25).toFixed(2)}/${q(ratio, .5).toFixed(2)}/${q(ratio, .75).toFixed(2)}`);
    const B2 = bandAgg;
    console.log(`\nin-band (300-1200u): armed ${B2.armT.toFixed(0)}s (slow ${(100 * B2.armSlow / Math.max(1e-9, B2.armT)).toFixed(0)}%, deviated ${(100 * B2.armDev / Math.max(1e-9, B2.armT)).toFixed(0)}%) | unarmed ${B2.unT.toFixed(0)}s (slow ${(100 * B2.unSlow / Math.max(1e-9, B2.unT)).toFixed(0)}%, deviated ${(100 * B2.unDev / Math.max(1e-9, B2.unT)).toFixed(0)}%)`);
    console.log(`armed+slow ownership: deviated ${B2.slowDev.toFixed(0)}s vs not-deviated ${B2.slowNoDev.toFixed(0)}s`);
    console.log(`armed+slow roles:`, Object.entries(B2.slowRole).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v.toFixed(0)}s`).join('  '));
})();
