// WHERE DOES THE ARMED APPROACH LOSE ITS TIME? (2026-08-10, the arctic push)
//
// arctic leg-1 subs 8-9 are +86.6 s/boat, 48% of the venue gap, armed 73%. Two
// measurements on the landed HEAD have already narrowed what that can be:
//   * the RING itself now costs +21.8 s/boat (ring->flip 40.8 s vs her 19) —
//     halved from the 75.7 s the Aug-8 record describes, because RD11 landed;
//   * the ARC is alive 85-96% of armed-in-zone time, so "keep the fast service
//     alive in the crowd" is SPENT as a lever. That line is closed.
// ⇒ Roughly three quarters of subs 8-9 is lost BEFORE the ring: the armed-approach
// crawl, which is the address [[MEMORY]] already names and nobody has profiled.
//
// The record also leaves a specific prediction to test: RD11 MOVED the queue
// outward, "frames 191->505 in the dRM 900-1800u band on hostile seeds while every
// other band fell". If that is where the fleet now waits, it should show as a
// speed trough in that band and nowhere else.
//
// So: profile everything by DISTANCE TO THE ROUNDING MARK, in bands, over leg 1.
// Her recordings give the same profile from the same geometry, so the two are
// directly comparable and the trough (if any) is located rather than assumed.
//
//   node _arc_approach.js <trials> <seed0> <tree>
//
// ⚠️ Rule 5: drifting ice and authored land are DIFFERENT physical lines — a floe
// blocking the way is a legitimate reason to stop, authored land is not. The two
// are counted separately, because the Aug-8 record had LAND 89 / FLOE 49 and the
// landed HEAD has reversed it to FLOE 344 / LAND 95.
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 6;
const SEED0 = parseInt(process.argv[3]) || 9100;
const ROOT = path.join(__dirname, process.argv[4] || 'treeDB3');
const BANDS = [0, 300, 600, 900, 1200, 1800, 2400, 3200, 4200];

(async () => {
    const b = await chromium.launch(); const p = await b.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await p.addInitScript(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic' })); });
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });

    const A = BANDS.map(() => ({ t: 0, dist: 0, slow: 0, armed: 0, defl: 0, risk: 0, irons: 0,
                                 floeBlk: 0, landBlk: 0, wig: 0, n: 0 }));
    for (let t = 0; t < TRIALS; t++) {
        const r = await p.evaluate(({ seed, BANDS }) => {
            window.evalHarness.seed = seed; window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(x => x.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
            const acc = BANDS.map(() => ({ t: 0, dist: 0, slow: 0, armed: 0, defl: 0, risk: 0, irons: 0,
                                           floeBlk: 0, landBlk: 0, wig: 0, n: 0 }));
            const DT = 1 / 60;
            const bandOf = (d) => { let i = 0; while (i < BANDS.length - 1 && d >= BANDS[i + 1]) i++; return i; };
            for (let it = 0; it < 60 * 900; it++) {
                window.update(DT);
                if (state.race.status !== 'racing') { if (state.race.status === 'finished') break; continue; }
                const g = state.course.botGrid;
                for (const bo of state.boats) {
                    if (bo.isPlayer || bo.raceState.finished) continue;
                    const rs = bo.raceState;
                    if (rs.leg !== 1) continue;                       // leg 1 only
                    const rm = (typeof legRoundMark === 'function' ? legRoundMark(rs.leg) : null) || state.course.roundMark;
                    if (!rm) continue;
                    const dM = Math.hypot(bo.x - rm.x, bo.y - rm.y);
                    const i = bandOf(dM); const a = acc[i]; const c = bo.controller;
                    const v = (bo.speed || 0) * 60;
                    a.t += DT; a.dist += v * DT; a.n++;
                    if (v < 40) a.slow += DT;
                    if (rs.roundArmed) a.armed += DT;
                    if (c) {
                        if (Math.abs(c.lastAvoidDeviation || 0) > 0.26) a.defl += DT;
                        if (c.riskState && c.riskState !== 'LOW') a.risk += DT;
                        if (c.wiggleActive) a.wig += DT;
                    }
                    const w = getWindAt(bo.x, bo.y);
                    if (Math.abs(normalizeAngle(bo.heading - w.direction)) < 0.55) a.irons += DT;
                    // what is blocking the heading 120u ahead — floe or authored land?
                    if (g && v < 40) {
                        const fx = bo.x + Math.sin(bo.heading) * 120, fy = bo.y - Math.cos(bo.heading) * 120;
                        const cc = g.cell(fx, fy);
                        if (!g.at(cc[0], cc[1])) {
                            let onFloe = false;
                            for (const fl of (state.course._floeObjs || [])) {
                                if (Math.hypot(fx - fl.x, fy - fl.y) <= (fl.radius || 0) + 20) { onFloe = true; break; }
                            }
                            if (onFloe) a.floeBlk += DT; else a.landBlk += DT;
                        }
                    }
                }
            }
            return acc;
        }, { seed: SEED0 + t, BANDS });
        for (let i = 0; i < A.length; i++) for (const k of Object.keys(A[i])) A[i][k] += r[i][k];
        console.log(`seed ${SEED0 + t} done`);
    }
    await b.close();

    // ── her profile, same geometry ───────────────────────────────────────────
    // ⚠️ RULE 23: only laps stamped with the BENCHED document are references. The
    // arctic corpus holds 32 schema-2 laps with a leg 1, spread over several doc
    // versions — pooling them all inflates every band and compares her against a
    // course she did not sail. FP is the frozen arctic's recording-side hash.
    // ⚠️ And dt is per-lap, not a constant: the measured spacing runs 0.098-0.120 s
    // across the corpus, so a hardcoded 0.11 mis-scales whole laps.
    const FP = process.env.ARC_FP || '19b566b3:82810';
    const dir = path.join(__dirname, 'traj');
    const H = BANDS.map(() => ({ t: 0, dist: 0 }));
    let hn = 0;
    for (const f of fs.readdirSync(dir).filter(f => f.startsWith('traj_arctic_')).sort()) {
        const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
        if (!j.format || j.venueFingerprint !== FP) continue;
        const F = j.format, I = n => F.indexOf(n);
        const rows = j.samples.filter(r => r[I('leg')] === 1);
        if (rows.length < 2) continue;
        hn++;
        const markXY = [rows[rows.length - 1][I('x')], rows[rows.length - 1][I('y')]];
        const span = Math.abs(rows[rows.length - 1][I('t')] - rows[0][I('t')]);
        const dt = span / (rows.length - 1);
        for (let k = 1; k < rows.length; k++) {
            const x = rows[k][I('x')], y = rows[k][I('y')];
            const d = Math.hypot(x - markXY[0], y - markXY[1]);
            let i = 0; while (i < BANDS.length - 1 && d >= BANDS[i + 1]) i++;
            H[i].t += dt;
            H[i].dist += Math.hypot(x - rows[k - 1][I('x')], y - rows[k - 1][I('y')]);
        }
    }
    console.log(`\nher reference laps on the benched doc (${FP}): ${hn}`);

    console.log(`\n=== ARCTIC LEG 1 BY DISTANCE TO THE ROUNDING MARK (${TRIALS} seeds, ${path.basename(ROOT)}) ===`);
    console.log(`band(u)        bot s/boat  bot u/s | HER s  HER u/s |  slow%  armed%  defl%  risk%  irons%  FLOE-blk%  land-blk%`);
    const nb = TRIALS * 9;   // boat-races
    for (let i = 0; i < BANDS.length; i++) {
        const a = A[i]; if (a.t < 1) continue;
        const lo = BANDS[i], hi = BANDS[i + 1] != null ? BANDS[i + 1] : '+';
        const h = H[i];
        const P = x => (100 * x / a.t).toFixed(0).padStart(4) + '%';
        console.log(`${String(lo).padStart(5)}-${String(hi).padEnd(5)} ${(a.t / nb).toFixed(1).padStart(10)} ${(a.dist / a.t).toFixed(0).padStart(8)} |` +
            `${(hn ? h.t / hn : 0).toFixed(1).padStart(6)} ${(h.t ? h.dist / h.t : 0).toFixed(0).padStart(8)} |` +
            ` ${P(a.slow)} ${P(a.armed)} ${P(a.defl)} ${P(a.risk)} ${P(a.irons)}  ${P(a.floeBlk)}     ${P(a.landBlk)}`);
    }
    console.log(`\n  → the band where bot s/boat most exceeds HER s is where the approach is lost.`);
    console.log(`  → FLOE-blk is rule 5's legitimate stop; land-blk is not.`);
})();
