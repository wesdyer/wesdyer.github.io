// WHO OWNS THE HELM WHILE THE BOAT IS ON THE ROCK? (2026-08-09 night.)
//
// The grind trace turned up a boat sitting at 0.3 u/s taking a land contact
// EVERY frame for 1.5s with `iceEscapeTimer` at zero and the helm owned by plain
// navigation — the contact reflex never engaged. script.js ~766 says why:
//
//     if (this.penaltySpin && this.riskState !== 'IMMINENT') {
//         desiredHeading = normalizeAngle(this.boat.heading + dir * 1.2);
//         speedRequest = 1.0;
//         return;                      // <-- returns BEFORE applyAvoidance (~788)
//     }
//
// applyAvoidance is where the island contact reflex lives, so a boat taking her
// penalty turns has NO grounding reflex, no avoidance, and full throttle. That
// closes a loop with the penalty tax: 47% of redrock's fouls are Rule 19, which
// the collision handler assigns when an overlapped boat hits land — grounding
// manufactures the penalty, and the penalty switches off the reflex that would
// end the grounding.
//
// This probe sizes the overlap. Per boat-race it reports seconds spinning,
// seconds in land contact, seconds in BOTH, and — for grinding episodes of 1s or
// more — which override actually held the helm frame by frame.
//   node _spin_ground.js <venue> <trials> <seed0> <tree> [leg]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'redrock';
const TRIALS = parseInt(process.argv[3]) || 4;
const SEED0 = parseInt(process.argv[4]) || 9400;
const ROOT = path.join(__dirname, process.argv[5] || 'treeA2');
const LEG = process.argv[6] != null && process.argv[6] !== '-' ? parseInt(process.argv[6]) : null;

(async () => {
    const b = await chromium.launch(); const p = await b.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await p.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const races = [], eps = [];
    for (let t = 0; t < TRIALS; t++) {
        const r = await p.evaluate(async ({ seed }) => {
            const hit = {};
            const inner = window.onRaceEvent;
            window.onRaceEvent = (ty, d) => {
                if (ty === 'collision_island' && d && d.boat && !d.boat.isPlayer && !d.isFloe
                    && !d.boat.raceState.finished && state.race.status === 'racing') hit[d.boat.name] = 1;
                return inner && inner(ty, d);
            };
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(x => x.isPlayer); pl.x = 1e6; pl.y = 1e6;
            const acc = {}, open = {}, done = [];
            const DT = 1 / 60, CLEAR = 0.75;
            for (let it = 0; it < 60 * 900; it++) {
                for (const k in hit) delete hit[k];
                window.update(DT);
                if (state.race.status !== 'racing') { if (state.race.status === 'finished') break; continue; }
                const now = state.race.timer;
                for (const bo of state.boats) {
                    if (bo.isPlayer || bo.raceState.finished) continue;
                    const n = bo.name, c = bo.controller;
                    const a = acc[n] = acc[n] || { spin: 0, touch: 0, both: 0, frames: 0, pen: 0 };
                    const spinning = !!(c && c.penaltySpin);
                    const touched = !!hit[n];
                    a.frames++;
                    if (spinning) a.spin++;
                    if (touched) a.touch++;
                    if (spinning && touched) a.both++;
                    if (bo.raceState.penalty) a.pen++;
                    // grinding episodes, and who held the helm inside them
                    let o = open[n];
                    if (!o) { if (!touched) continue;
                        o = open[n] = { boat: n, t0: now, leg: bo.raceState.leg, tLast: now,
                                        frames: 0, touches: 0, own: {}, spinFrames: 0,
                                        startedSpinning: spinning ? 1 : 0,
                                        x: Math.round(bo.x), y: Math.round(bo.y) }; }
                    o.frames++;
                    if (touched) { o.touches++; o.tLast = now; }
                    if (spinning) o.spinFrames++;
                    // Ownership in the precedence the CODE applies, which is not the
                    // order the branches are written in (rule 18 — the first cut of
                    // this probe put WIGGLE above the reflex and under-read the
                    // reflex's share by 25 points). update() sets desiredHeading from
                    // wiggle/clearance/nav FIRST (~614/657), penaltySpin may return
                    // before avoidance (~766), then applyAvoidance (~788) runs and the
                    // island reflex inside it (~896) OVERWRITES whatever the earlier
                    // branches chose. So: spin > escape > contact reflex > mark reflex
                    // > wiggle > clearance > nav.
                    const own = spinning && c.riskState !== 'IMMINENT' ? 'PENALTY-SPIN'
                        : (c && c.escActive ? 'ESCAPE'
                        : (c && c.iceEscapeTimer > 0 ? 'contact-reflex'
                        : (c && c.markContactTimer > 0 ? 'mark-reflex'
                        : (c && c.wiggleActive ? 'WIGGLE'
                        : (c && c.clearanceTimer > 0 ? 'CLEARANCE' : 'plain-nav')))));
                    // and what the reflex was competing with underneath it
                    if (c && c.iceEscapeTimer > 0 && !spinning && !c.escActive) {
                        const un = c.wiggleActive ? 'over-WIGGLE' : (c.clearanceTimer > 0 ? 'over-CLEARANCE' : 'over-nav');
                        o.under = o.under || {}; o.under[un] = (o.under[un] || 0) + 1;
                    }
                    // IS THE REFLEX CHASING A MOVING TARGET? The re-arm guard is
                    // `speed < 1.0` = 60 u/s, and a boat in a grind is far below it,
                    // so the escape heading is recomputed from THIS frame's collision
                    // normal on every frame — the 2.0s latch never actually latches
                    // while the contact lasts. If the normal jitters between polygon
                    // edges the command jitters with it and the helm never converges,
                    // which would explain a steady 60deg actual-vs-commanded error at
                    // a turn rate that should close 60deg in about a second.
                    if (c && c.iceEscapeTimer > 0) {
                        const cmd = c.iceEscapeHeading;
                        if (o.pcmd != null && cmd != null) {
                            const dch = normalizeAngle(cmd - o.pcmd);
                            o.cmdAbs = (o.cmdAbs || 0) + Math.abs(dch);
                            o.cmdN = (o.cmdN || 0) + 1;
                            if (o.psign != null && dch !== 0 && Math.sign(dch) !== o.psign) o.cmdFlip = (o.cmdFlip || 0) + 1;
                            if (dch !== 0) o.psign = Math.sign(dch);
                        }
                        o.pcmd = cmd;
                        // tracking error: how far the helm actually is from the command
                        o.errSum = (o.errSum || 0) + Math.abs(normalizeAngle(bo.heading - cmd));
                        o.errN = (o.errN || 0) + 1;
                    }
                    o.own[own] = (o.own[own] || 0) + 1;
                    if (now - o.tLast > CLEAR) { o.dur = o.tLast - o.t0; done.push(o); delete open[n]; }
                }
            }
            for (const [n, o] of Object.entries(open)) { o.dur = o.tLast - o.t0; done.push(o); }
            window.onRaceEvent = inner;
            const rows = [];
            for (const [n, a] of Object.entries(acc)) rows.push({ boat: n, ...a, DT });
            return { rows, done };
        }, { seed: SEED0 + t });
        console.log(`seed ${SEED0 + t}: ${r.done.length} contact episodes`);
        for (const x of r.rows) races.push(x);
        for (const e of r.done) { e.seed = SEED0 + t; eps.push(e); }
    }
    await b.close();

    const DT = 1 / 60;
    const q = (a, pr) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(pr * (s.length - 1))] : NaN; };
    const mean = a => a.reduce((x, y) => x + y, 0) / (a.length || 1);
    console.log(`\n=== PENALTY SPIN vs GROUNDING (${VENUE}, ${TRIALS} seeds from ${SEED0}, ${path.basename(ROOT)}) ===`);
    console.log(`${races.length} boat-races`);
    console.log(`  seconds SPINNING a penalty:      mean ${mean(races.map(r => r.spin * DT)).toFixed(1)}  med ${q(races.map(r => r.spin * DT), .5).toFixed(1)}`);
    console.log(`  seconds IN LAND CONTACT:         mean ${mean(races.map(r => r.touch * DT)).toFixed(1)}  med ${q(races.map(r => r.touch * DT), .5).toFixed(1)}`);
    console.log(`  seconds BOTH (spinning ON rock): mean ${mean(races.map(r => r.both * DT)).toFixed(1)}  med ${q(races.map(r => r.both * DT), .5).toFixed(1)}`);
    const totTouch = races.reduce((a, r) => a + r.touch, 0), totBoth = races.reduce((a, r) => a + r.both, 0);
    const totSpin = races.reduce((a, r) => a + r.spin, 0);
    console.log(`  ⭐ ${(100 * totBoth / (totTouch || 1)).toFixed(1)}% of land-contact time is spent under a PENALTY SPIN (reflex disabled)`);
    console.log(`  ⭐ ${(100 * totBoth / (totSpin || 1)).toFixed(1)}% of penalty-spin time is spent IN CONTACT WITH LAND`);

    const use = (LEG == null ? eps : eps.filter(e => e.leg === LEG)).filter(e => e.dur >= 1.0);
    console.log(`\ngrinding episodes >= 1.0s: ${use.length}` + (LEG != null ? ` (leg ${LEG})` : ''));
    if (use.length) {
        console.log(`  duration s: med ${q(use.map(e => e.dur), .5).toFixed(1)}  p90 ${q(use.map(e => e.dur), .9).toFixed(1)}`);
        console.log(`  duty cycle (frames that took a hit): med ${(100 * q(use.map(e => e.touches / e.frames), .5)).toFixed(0)}%` +
            `   >80% (GLUED): ${(100 * use.filter(e => e.touches / e.frames > .8).length / use.length).toFixed(0)}%` +
            `   <40% (BOUNCING): ${(100 * use.filter(e => e.touches / e.frames < .4).length / use.length).toFixed(0)}%`);
        console.log(`  episodes that BEGAN while spinning: ${(100 * mean(use.map(e => e.startedSpinning))).toFixed(0)}%`);
        console.log(`  share of episode time spent spinning: ${(100 * use.reduce((a, e) => a + e.spinFrames, 0) / use.reduce((a, e) => a + e.frames, 0)).toFixed(0)}%`);
        const own = {};
        for (const e of use) for (const k in e.own) own[k] = (own[k] || 0) + e.own[k];
        const tot = Object.values(own).reduce((a, c) => a + c, 0);
        console.log(`  ⭐ HELM OWNER across grinding-episode frames:`);
        for (const [k, v] of Object.entries(own).sort((a, c) => c[1] - a[1]))
            console.log(`       ${k.padEnd(16)} ${(100 * v / tot).toFixed(1)}%`);
        // the worst sites, split by whether the reflex was even allowed to run
        const D = r => (r * 180 / Math.PI);
        const jit = use.filter(e => e.cmdN > 10);
        if (jit.length) {
            console.log(`  ⭐ REFLEX COMMAND STABILITY (${jit.length} episodes with >10 latched frames):`);
            console.log(`       |change| in commanded escape heading per frame: med ${D(q(jit.map(e => e.cmdAbs / e.cmdN), .5)).toFixed(1)}deg` +
                `  p90 ${D(q(jit.map(e => e.cmdAbs / e.cmdN), .9)).toFixed(1)}deg`);
            console.log(`       direction REVERSALS per second: med ${(60 * q(jit.map(e => (e.cmdFlip || 0) / e.cmdN), .5)).toFixed(1)}` +
                `  p90 ${(60 * q(jit.map(e => (e.cmdFlip || 0) / e.cmdN), .9)).toFixed(1)}`);
            console.log(`       helm tracking error (actual heading vs command): med ${D(q(jit.map(e => e.errSum / e.errN), .5)).toFixed(0)}deg` +
                `  p90 ${D(q(jit.map(e => e.errSum / e.errN), .9)).toFixed(0)}deg`);
        }
        const und = {};
        for (const e of use) for (const k in (e.under || {})) und[k] = (und[k] || 0) + e.under[k];
        const undT = Object.values(und).reduce((a, c) => a + c, 0);
        if (undT) console.log(`  reflex-owned frames, by what it overrode: ` +
            Object.entries(und).sort((a, c) => c[1] - a[1]).map(([k, v]) => `${k} ${(100 * v / undT).toFixed(0)}%`).join('  '));
        const spun = use.filter(e => e.spinFrames / e.frames > 0.5);
        console.log(`  episodes MOSTLY under a spin: ${spun.length}/${use.length}` +
            `  (their med duration ${q(spun.map(e => e.dur), .5).toFixed(1)}s vs ${q(use.filter(e => e.spinFrames / e.frames <= .5).map(e => e.dur), .5).toFixed(1)}s for the rest)`);
    }
})();
