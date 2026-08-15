// THE ARMED-APPROACH CRAWL, MECHANISM PASS (2026-08-15, the ocean-intake push).
// _arc_approach (final HEAD, 4 seeds) put 45 s/boat of arctic leg 1 in the dRM
// 300-1200u band: 68-77 u/s vs her 104-115, armed ~100%, deflected 43-51%,
// irons 15-25%, floe-blocked only 5-9%. So the crawl is avoidance/queue, not ice
// — but "deflected" names a symptom, not a cause. This classifies every slow
// in-band frame by WHAT the boat is reacting to:
//   role   — avoidanceRole (NONE / STAND_ON / GIVE_WAY) and whether threatBoat set
//   near   — nearest rival distance (and whether that rival is AHEAD toward the
//            mark = queueing, or abeam/behind = crossing traffic)
//   floe   — nearest floe distance; heading-blocked probe (floe vs land), as in
//            _arc_approach
//   irons  — TWA < 0.55 while slow (and whether wiggle owns it)
// Slow = v < 80 u/s (the crawl band's own speed vs her 104-115; the _arc_approach
// slow% used <40 which is the STUCK line, not the crawl line — both printed).
// Fleet race, bots only, leg 1 only, dRM 300-1200 only. __CHAR left unset (rule
// 18b: the mirror for attributing fleet-bench statistics).
//   node _arc_crawl.js <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 4;
const SEED0 = parseInt(process.argv[3]) || 9400;
const ROOT = path.join(__dirname, process.argv[4] || 'treeBASE');

(async () => {
    const b = await chromium.launch(); const p = await b.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    await p.evaluate((v) => localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })), 'arctic');

    const SUM = { t: 0, slow: 0, n: 0 };
    const S = {}; // slow-frame classification accumulators (seconds)
    const add = (k, dt) => { S[k] = (S[k] || 0) + dt; };
    const rivalDists = [], floeDists = [];

    for (let t = 0; t < TRIALS; t++) {
        const r = await p.evaluate(({ seed }) => {
            window.evalHarness.seed = seed; window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(x => x.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
            const DT = 1 / 60;
            const S = {}; const add = (k, v) => { S[k] = (S[k] || 0) + v; };
            const out = { t: 0, slow: 0, n: 0, S, rd: [], fd: [] };
            for (let it = 0; it < 60 * 900; it++) {
                window.update(DT);
                if (state.race.status !== 'racing') { if (state.race.status === 'finished') break; continue; }
                const g = state.course.botGrid;
                for (const bo of state.boats) {
                    if (bo.isPlayer || bo.raceState.finished) continue;
                    const rs = bo.raceState;
                    if (rs.leg !== 1) continue;
                    const rm = (typeof legRoundMark === 'function' ? legRoundMark(rs.leg) : null) || state.course.roundMark;
                    if (!rm) continue;
                    const dM = Math.hypot(bo.x - rm.x, bo.y - rm.y);
                    if (dM < 300 || dM >= 1200) continue;
                    const v = (bo.speed || 0) * 60;
                    out.t += DT; out.n++;
                    if (v >= 80) continue;
                    out.slow += DT;
                    const c = bo.controller;
                    // role
                    const role = c ? (c.avoidanceRole || 'NONE') : 'NONE';
                    add('role:' + role, DT);
                    if (c && c.threatBoat) add('threatSet', DT);
                    // nearest rival, and is it between us and the mark?
                    let nr = 1e9, nrAhead = false;
                    const mx = rm.x - bo.x, my = rm.y - bo.y, mL = Math.hypot(mx, my) || 1;
                    for (const ob of state.boats) {
                        if (ob === bo || ob.isPlayer || ob.raceState.finished) continue;
                        const dx = ob.x - bo.x, dy = ob.y - bo.y;
                        const d = Math.hypot(dx, dy);
                        if (d < nr) { nr = d; nrAhead = (dx * mx + dy * my) / (d * mL || 1) > 0.5; }
                    }
                    if (nr < 1e9) {
                        out.rd.push(Math.round(nr));
                        if (nr < 150) add(nrAhead ? 'rival<150 ahead' : 'rival<150 abeam/behind', DT);
                        else if (nr < 300) add(nrAhead ? 'rival150-300 ahead' : 'rival150-300 abeam/behind', DT);
                        else add('rival>300', DT);
                    }
                    // nearest floe
                    let nf = 1e9;
                    for (const fl of (state.course._floeObjs || [])) {
                        const d = Math.hypot(bo.x - fl.x, bo.y - fl.y) - (fl.radius || 0);
                        if (d < nf) nf = d;
                    }
                    if (nf < 1e9) { out.fd.push(Math.round(nf)); if (nf < 60) add('floe<60', DT); }
                    // heading-blocked 120u ahead: floe or land (same test as _arc_approach)
                    if (g) {
                        const fx = bo.x + Math.sin(bo.heading) * 120, fy = bo.y - Math.cos(bo.heading) * 120;
                        const cc = g.cell(fx, fy);
                        if (!g.at(cc[0], cc[1])) {
                            let onFloe = false;
                            for (const fl of (state.course._floeObjs || [])) {
                                if (Math.hypot(fx - fl.x, fy - fl.y) <= (fl.radius || 0) + 20) { onFloe = true; break; }
                            }
                            add(onFloe ? 'blocked:floe' : 'blocked:land', DT);
                        }
                    }
                    // irons / wiggle / deflection / armed
                    const w = getWindAt(bo.x, bo.y);
                    if (Math.abs(normalizeAngle(bo.heading - w.direction)) < 0.55) {
                        add('irons', DT);
                        if (c && c.wiggleActive) add('irons+wiggle', DT);
                    }
                    if (c && Math.abs(c.lastAvoidDeviation || 0) > 0.26) add('deflected', DT);
                    if (rs.roundArmed) add('armed', DT);
                    if (c && c.riskState && c.riskState !== 'LOW') add('risk!' + c.riskState, DT);
                    // WHY is the frame slow — throttle, contact latch, polar deficit, or turn?
                    if (c && c.speedLimit < 0.9) add('cause:throttled', DT);
                    if (c && (c.iceEscapeTimer || 0) > 0) add('cause:contactLatch', DT);
                    const twa = Math.abs(normalizeAngle(bo.heading - w.direction));
                    const tgt = (typeof getTargetSpeed === 'function' ? getTargetSpeed(twa, bo.spinnaker, w.speed) : 0) * 15;
                    if (tgt > 1) {
                        const ratio = v / tgt;
                        if (ratio < 0.5) add('cause:under50%polar', DT);
                        else if (ratio < 0.8) add('cause:50-80%polar', DT);
                        else add('cause:atPolar(slowTgt)', DT);
                    }
                    if (bo._lastH != null) {
                        const tr = Math.abs(normalizeAngle(bo.heading - bo._lastH)) / DT;
                        if (tr > 0.3) add('cause:turning', DT);
                    }
                    bo._lastH = bo.heading;
                }
            }
            return out;
        }, { seed: SEED0 + t });
        SUM.t += r.t; SUM.slow += r.slow; SUM.n += r.n;
        for (const k of Object.keys(r.S)) add(k, r.S[k]);
        rivalDists.push(...r.rd); floeDists.push(...r.fd);
        console.log(`seed ${SEED0 + t} done  band-t ${r.t.toFixed(0)}s  slow ${r.slow.toFixed(0)}s`);
    }
    await b.close();
    const nb = TRIALS * 9;
    console.log(`\n=== ARCTIC CRAWL (dRM 300-1200, leg 1, ${TRIALS} seeds, ${path.basename(ROOT)}) ===`);
    console.log(`band time ${(SUM.t / nb).toFixed(1)} s/boat, slow(<80u/s) ${(SUM.slow / nb).toFixed(1)} s/boat (${(100 * SUM.slow / SUM.t).toFixed(0)}%)`);
    console.log(`\nslow-frame classification (s/boat, % of slow time):`);
    for (const k of Object.keys(S).sort((a, c) => S[c] - S[a]))
        console.log(`  ${k.padEnd(26)} ${(S[k] / nb).toFixed(1).padStart(6)}  ${(100 * S[k] / SUM.slow).toFixed(0).padStart(3)}%`);
    const q = (a, p) => { a = a.slice().sort((x, y) => x - y); return a.length ? a[Math.floor((a.length - 1) * p)] : NaN; };
    console.log(`\nnearest rival on slow frames: p25 ${q(rivalDists, .25)} med ${q(rivalDists, .5)} p75 ${q(rivalDists, .75)}`);
    console.log(`nearest floe  on slow frames: p25 ${q(floeDists, .25)} med ${q(floeDists, .5)} p75 ${q(floeDists, .75)}`);
    console.log(`\n→ role:GIVE_WAY + rival<150 ahead = queue; role:NONE + rival>300 + deflected = phantom avoidance (the glowtide non-threat family); blocked:floe = rule 5's legitimate stop.`);
})();
