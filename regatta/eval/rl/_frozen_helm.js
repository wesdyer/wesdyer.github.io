// A BOAT WHOSE HEADING DOES NOT MOVE (2026-08-11, redrock)
//
// `_grind_trace` on the post-landing tree dumped a 6.9s episode at (-1156,-1516)
// in which `boat.heading` printed −1.97 on EVERY ONE of 69 samples while the
// stored `iceEscapeHeading` read 1.1 — a 3.07 rad error held for seven seconds by
// a boat with the reflex's 5x snap authority (~4.5 rad/s), which should cover
// that in under a second. Either the helm is commanding the current heading, or
// something downstream of the reflex is the last writer (rule 27), or the turn is
// not being applied at all.
//
// ⚠️ DO NOT INFER IT FROM THE SOURCE. The reflex block (~1008) is followed by a
// mark override, a clearance branch and more before `this.targetHeading =
// desiredHeading` (~1178), and `_grind_trace`'s owner column labels a boat ICE
// whenever `iceEscapeTimer > 0` — so it cannot distinguish the reflex from a
// later writer. Read `targetHeading` itself, which is the only value `updateBoat`
// (~11795) actually steers to.
//
// Definition of FROZEN: |heading change| < 0.002 rad/frame sustained for >= 1.0s
// while under 10 u/s. For each such episode record what the helm was asking for,
// who could have written it, and what the turn arithmetic would have produced.
//
// usage: node _frozen_helm.js <venue> <trials> <seed0> <tree> [dumpN]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'redrock';
const TRIALS = parseInt(process.argv[3]) || 4;
const SEED0 = parseInt(process.argv[4]) || 9400;
const ROOT = path.join(__dirname, process.argv[5] || 'treeTRK2');
const DUMPN = parseInt(process.argv[6]) || 3;

(async () => {
    const b = await chromium.launch(); const p = await b.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await p.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });

    const A = { eps: [], slowT: 0, frozenT: 0 };
    for (let t = 0; t < TRIALS; t++) {
        const r = await p.evaluate(({ seed }) => {
            const norm = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
            const S = { eps: [], slowT: 0, frozenT: 0 };
            const open = {}, last = {};
            const hit = {}; const inner = window.onRaceEvent;
            window.onRaceEvent = (ty, d) => {
                if (ty === 'collision_island' && d && d.boat && !d.boat.isPlayer) hit[d.boat.name] = 1;
                return inner && inner(ty, d);
            };
            window.evalHarness.seed = seed; window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(x => x.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
            const DT = 1 / 60; let now = 0;
            for (let it = 0; it < 60 * 900; it++) {
                for (const k in hit) delete hit[k];
                window.update(DT); now += DT;
                if (state.race.status !== 'racing') { if (state.race.status === 'finished') break; continue; }
                for (const bo of state.boats) {
                    if (bo.isPlayer || bo.raceState.finished) continue;
                    const c = bo.controller; if (!c) continue;
                    const v = (bo.speed || 0) * 60;
                    const prev = last[bo.name];
                    last[bo.name] = bo.heading;
                    if (prev === undefined) continue;
                    const dh = Math.abs(norm(bo.heading - prev));
                    if (v < 10) S.slowT += DT;
                    const frozen = v < 10 && dh < 0.002;
                    if (frozen) S.frozenT += DT;
                    let o = open[bo.name];
                    if (frozen) {
                        if (!o) o = open[bo.name] = { t0: now, x: bo.x, y: bo.y, n: 0, rows: [],
                                                      tgtEqHdg: 0, spin: 0, wig: 0, esc: 0, ice: 0, mrk: 0, clr: 0, con: 0 };
                        o.n++;
                        const tgt = c.targetHeading;
                        if (tgt != null && Math.abs(norm(tgt - bo.heading)) < 0.01) o.tgtEqHdg++;
                        if (c.penaltySpin) o.spin++;
                        if (c.wiggleActive) o.wig++;
                        if (c.escActive) o.esc++;
                        if (c.iceEscapeTimer > 0) o.ice++;
                        if (c.markContactTimer > 0) o.mrk++;
                        if (c.clearanceTimer > 0) o.clr++;
                        if (hit[bo.name]) o.con++;
                        if (o.rows.length < 60) o.rows.push({
                            t: +(now - o.t0).toFixed(2), v: +v.toFixed(1),
                            hd: +bo.heading.toFixed(3), tgt: tgt == null ? null : +tgt.toFixed(3),
                            dth: +norm((tgt == null ? bo.heading : tgt) - bo.heading).toFixed(3),
                            ice: +(c.iceEscapeTimer || 0).toFixed(2),
                            iceH: c.iceEscapeHeading == null ? null : +c.iceEscapeHeading.toFixed(2),
                            mrk: +(c.markContactTimer || 0).toFixed(2),
                            spin: c.penaltySpin ? 1 : 0, bias: c.turnBias || 0,
                            sl: c.speedLimit == null ? null : +c.speedLimit.toFixed(2), hit: hit[bo.name] ? 1 : 0 });
                    } else if (o) {
                        o.dur = now - o.t0;
                        if (o.dur >= 1.0) S.eps.push(o);
                        delete open[bo.name];
                    }
                }
                if (state.race.status === 'racing' && state.race.timer > 895) break;
            }
            for (const nm in open) { const o = open[nm]; o.dur = now - o.t0; if (o.dur >= 1.0) S.eps.push(o); }
            return S;
        }, { seed: SEED0 + t });
        A.eps.push(...r.eps); A.slowT += r.slowT; A.frozenT += r.frozenT;
        console.log(`seed ${SEED0 + t}: ${r.eps.length} frozen-helm episodes >= 1.0s`);
    }
    await b.close();

    const q = (a, pp) => { if (!a.length) return NaN; const s = a.slice().sort((x, y) => x - y); return s[Math.floor(pp * (s.length - 1))]; };
    const sum = a => a.reduce((x, y) => x + y, 0);
    console.log(`\n=== ${VENUE.toUpperCase()}: THE FROZEN HELM (${TRIALS} seeds) ===`);
    console.log(`time under 10 u/s: ${A.slowT.toFixed(0)} boat-s, of which the heading is FROZEN (<0.002 rad/frame): ` +
        `${A.frozenT.toFixed(0)} boat-s (${(100 * A.frozenT / (A.slowT || 1)).toFixed(0)}%)`);
    console.log(`episodes >= 1.0s: ${A.eps.length}   total ${sum(A.eps.map(e => e.dur)).toFixed(0)} boat-s   ` +
        `dur med ${q(A.eps.map(e => e.dur), .5).toFixed(1)}s  p90 ${q(A.eps.map(e => e.dur), .9).toFixed(1)}s  max ${Math.max(...A.eps.map(e => e.dur)).toFixed(1)}s`);
    const N = sum(A.eps.map(e => e.n)) || 1;
    const sh = (k) => (100 * sum(A.eps.map(e => e[k])) / N).toFixed(0) + '%';
    console.log(`\n  ACROSS FROZEN FRAMES:`);
    console.log(`    ⭐ targetHeading == current heading (the helm is asking for nothing): ${sh('tgtEqHdg')}`);
    console.log(`    penaltySpin ${sh('spin')}   wiggle ${sh('wig')}   escape ${sh('esc')}   iceEscapeTimer>0 ${sh('ice')}   markContact ${sh('mrk')}   clearance ${sh('clr')}   in contact ${sh('con')}`);
    const worst = A.eps.slice().sort((a, c) => c.dur - a.dur).slice(0, DUMPN);
    for (const e of worst) {
        console.log(`\n--- frozen ${e.dur.toFixed(1)}s at (${Math.round(e.x)},${Math.round(e.y)}) ---`);
        console.log(`   t     v    heading  target   diff   ice  iceH   mrk spin bias  sl  hit`);
        for (const r of e.rows.slice(0, 22)) {
            console.log(`${String(r.t).padStart(5)} ${String(r.v).padStart(5)}  ${String(r.hd).padStart(7)} ${String(r.tgt).padStart(7)} ${String(r.dth).padStart(6)}  ` +
                `${String(r.ice).padStart(4)} ${String(r.iceH).padStart(5)}  ${String(r.mrk).padStart(4)} ${r.spin} ${String(r.bias).padStart(4)} ${String(r.sl).padStart(4)}  ${r.hit}`);
        }
    }
})();
