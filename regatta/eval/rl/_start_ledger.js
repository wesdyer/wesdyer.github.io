// THE START LEDGER — where do the gun seconds go? (measure first; the start
// is sacred tuning.)
//
// Bay's residual concentrates at the gun (median first crossing 6.5s late)
// and seatrials flags 14.78% OCS vs the human's ~6%. Before any calibration
// candidate exists, attribute the lateness PER BOAT to its separable parts:
//
//   crossTime  = seconds after the gun the boat's hull first clears the line
//              = realizedRun - (estimate + BUF) + commit quantization
//   estimate   = getApproachTime(STAGE/cos 0.7, speedAtCommit, stats) — the
//                controller's own pure function, recomputed at the commit
//                frame (tCross is a local; startCommitted flipping false->true
//                IS the commit frame, to within a tick)
//   BUF        = 0.5 + traits.startBufAdj — known exactly per boat
//   realized   = commitTimer + crossTime (seconds from commit to crossing)
//   estErr     = realized - estimate  (physics/wind miss of the estimator)
//   blocked    = post-commit seconds where avoidance bent the course
//                (lastAvoidDeviation > 0.12 rad), risk latched HIGH+, or the
//                commanded speed fell under 0.95 — traffic, not estimation
//
// OCS boats are a fourth bucket: their crossing time measures the return
// trip, not the approach, and must not pollute the estimate-error bin.
//
// Only a calibration candidate is justified if estErr dominates blocked —
// that is the question this ledger answers.
//
//   node _start_ledger.js <trials> <seed0> <tree> [venue] [maxT]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 8;
const SEED0 = parseInt(process.argv[3]) || 9100;
const ROOT = path.join(__dirname, process.argv[4] || 'treeHEAD');
const VENUE = process.argv[5] || 'bay';
const MAXT = parseInt(process.argv[6] || '120');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript((v) => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: v }));
    }, VENUE);
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const rows = [];
    for (let i = 0; i < TRIALS; i++) {
        const r = await page.evaluate(async ({ seed, maxT }) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            const bots = state.boats.filter(b => !b.isPlayer);
            const pl = state.boats.find(b => b.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
            const led = {};
            for (const b of bots) led[b.name] = {
                commitT: null, spdAtCommit: null, est: null,
                buf: 0.5 + ((b.traits && b.traits.startBufAdj) || 0),
                cross: null, ocsAtGun: false, blocked: 0, devSecs: 0, slowSecs: 0,
                distAtGun: null, spdAtGun: null
            };
            const inner = window.onRaceEvent;
            window.onRaceEvent = (ty, d) => {
                if (ty === 'leg_complete' && d && d.leg === 0 && d.boat && !d.boat.isPlayer) {
                    const L = led[d.boat.name];
                    if (L && L.cross == null) L.cross = state.race.timer;
                }
                if (inner) inner(ty, d);
            };
            let gunDone = false;
            let frames = 0;
            const STEP = 1 / 60;
            while (frames < maxT * 60) {
                window.update(STEP); frames++;
                if (frames % 6 !== 0) continue; // sample at 10 Hz, the controller tick
                const prestart = state.race.status === 'prestart';
                for (const b of bots) {
                    const L = led[b.name], c = b.controller;
                    if (!c) continue;
                    // Commit frame: startCommitted flips exactly once.
                    if (prestart && L.commitT == null && c.startCommitted) {
                        L.commitT = state.race.timer;   // seconds to the gun
                        L.spdAtCommit = b.speed;
                        const STAGE = (window.__START && window.__START.stage != null) ? window.__START.stage : (c.startStageDepth || 60);
                        try { L.est = c.getApproachTime(STAGE / Math.cos(0.7), b.speed, b.stats); } catch (e) { L.est = -1; }
                    }
                    // Post-commit, pre-cross: traffic ledger at 10 Hz.
                    if (L.commitT != null && L.cross == null) {
                        const dev = (c.lastAvoidDeviation || 0) > 0.12;
                        const hot = c.riskState === 'HIGH' || c.riskState === 'IMMINENT';
                        const slow = (c.speedLimit != null && c.speedLimit < 0.95);
                        if (dev) L.devSecs += 0.1;
                        if (slow) L.slowSecs += 0.1;
                        if (dev || hot || slow) L.blocked += 0.1;
                    }
                }
                if (!gunDone && state.race.status === 'racing') {
                    gunDone = true;
                    const [m0, m1] = startLinePts();
                    for (const b of bots) {
                        const L = led[b.name];
                        L.ocsAtGun = !!b.raceState.ocs;
                        L.distAtGun = hullLineOffset(b, m0, m1, true);
                        L.spdAtGun = b.speed;
                    }
                }
                if (gunDone && state.race.timer > maxT - 35) break;
            }
            return Object.entries(led).map(([name, L]) => ({ name, ...L }));
        }, { seed: SEED0 + i, maxT: MAXT });
        for (const row of r) rows.push({ seed: SEED0 + i, ...row });
        console.error(`seed ${SEED0 + i}: crossed ${r.filter(x => x.cross != null).length}/${r.length} ocs ${r.filter(x => x.ocsAtGun).length}`);
    }
    fs.writeFileSync(path.join(__dirname, `start_ledger_${VENUE}_${SEED0}.json`), JSON.stringify(rows, null, 1));

    // ── aggregate ──
    const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
    const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * p))] : null; };
    const crossed = rows.filter(r => r.cross != null && r.commitT != null);
    const clean = crossed.filter(r => !r.ocsAtGun);
    const ocs = rows.filter(r => r.ocsAtGun);
    const dns = rows.filter(r => r.cross == null);
    console.log(`\n=== START LEDGER ${VENUE} ${TRIALS}@${SEED0} — ${rows.length} boat-starts ===`);
    console.log(`crossed ${crossed.length}  OCS-at-gun ${ocs.length} (${(100 * ocs.length / rows.length).toFixed(1)}%)  never-crossed ${dns.length}`);
    const A = clean.map(r => ({
        cross: r.cross, buf: r.buf, est: r.est,
        realized: r.commitT + r.cross,
        estErr: (r.commitT + r.cross) - r.est,
        blocked: r.blocked, dev: r.devSecs, slow: r.slowSecs,
        spdC: r.spdAtCommit
    }));
    const col = (k) => A.map(r => r[k]);
    console.log(`\nCLEAN CROSSERS (${A.length}):`);
    console.log(`  crossTime   med ${med(col('cross')).toFixed(2)}s  p25 ${q(col('cross'), .25).toFixed(2)}  p75 ${q(col('cross'), .75).toFixed(2)}  p90 ${q(col('cross'), .9).toFixed(2)}`);
    console.log(`  estimate    med ${med(col('est')).toFixed(2)}s   realized med ${med(col('realized')).toFixed(2)}s`);
    console.log(`  estErr      med ${med(col('estErr')).toFixed(2)}s  p25 ${q(col('estErr'), .25).toFixed(2)}  p75 ${q(col('estErr'), .75).toFixed(2)}  p90 ${q(col('estErr'), .9).toFixed(2)}`);
    console.log(`  BUF         med ${med(col('buf')).toFixed(2)}s`);
    console.log(`  blocked     med ${med(col('blocked')).toFixed(2)}s  p75 ${q(col('blocked'), .75).toFixed(2)}  p90 ${q(col('blocked'), .9).toFixed(2)}`);
    console.log(`    (dev med ${med(col('dev')).toFixed(2)}  slow med ${med(col('slow')).toFixed(2)})`);
    // The question: among LATE boats, what dominates?
    const late = A.filter(r => r.cross > 4);
    if (late.length) {
        console.log(`\nLATE (>4s) — ${late.length} boats (${(100 * late.length / A.length).toFixed(0)}% of clean):`);
        const lc = k => late.map(r => r[k]);
        console.log(`  cross med ${med(lc('cross')).toFixed(2)}  estErr med ${med(lc('estErr')).toFixed(2)}  blocked med ${med(lc('blocked')).toFixed(2)}  BUF med ${med(lc('buf')).toFixed(2)}`);
        const domEst = late.filter(r => r.estErr > r.blocked + r.buf).length;
        const domBlk = late.filter(r => r.blocked > r.estErr && r.blocked > r.buf).length;
        console.log(`  dominated by estErr: ${domEst}/${late.length}   by blocked: ${domBlk}/${late.length}   rest: BUF/mixed`);
    }
    if (ocs.length) {
        console.log(`\nOCS boats: return-cross med ${med(ocs.filter(r => r.cross != null).map(r => r.cross)).toFixed(2)}s  distAtGun med ${med(ocs.map(r => r.distAtGun)).toFixed(1)}u over`);
    }
    await browser.close();
})();
