// IS A POCKET GROUNDING, OR JUST SLOW? (2026-08-09 night, redrock's mark-6 bowl.)
//
// `_leg_where` finds WHERE a leg loses its time; it does not say whether the boat
// was ON the rock or merely creeping near it. Those need different fixes — one is
// the contact system, the other is routing/execution — so the split decides the
// candidate. This probe takes a circle (a pocket) and reports, for time spent
// inside it: seconds under 40 u/s, seconds in actual land contact, the grounding
// tax integral attributable to episodes starting inside it, and the state mix.
//   node _pocket_split.js <venue> <trials> <seed0> <tree> <cx> <cy> <radius>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'redrock';
const TRIALS = parseInt(process.argv[3]) || 4;
const SEED0 = parseInt(process.argv[4]) || 9400;
const ROOT = path.join(__dirname, process.argv[5] || 'treeFIN');
const CX = parseFloat(process.argv[6]), CY = parseFloat(process.argv[7]);
const RAD = parseFloat(process.argv[8]) || 400;

(async () => {
    const b = await chromium.launch(); const p = await b.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await p.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const rows = [];
    for (let t = 0; t < TRIALS; t++) {
        const r = await p.evaluate(async ({ seed, CX, CY, RAD }) => {
            const hit = {}; const inner = window.onRaceEvent;
            window.onRaceEvent = (ty, d) => {
                if (ty === 'collision_island' && d && d.boat && !d.boat.isPlayer && !d.isFloe
                    && !d.boat.raceState.finished && state.race.status === 'racing') hit[d.boat.name] = 1;
                return inner && inner(ty, d);
            };
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(x => x.isPlayer); pl.x = 1e6; pl.y = 1e6;
            const acc = {}, DT = 1 / 60;
            for (let it = 0; it < 60 * 900; it++) {
                for (const k in hit) delete hit[k];
                window.update(DT);
                if (state.race.status !== 'racing') { if (state.race.status === 'finished') break; continue; }
                for (const bo of state.boats) {
                    if (bo.isPlayer || bo.raceState.finished) continue;
                    if (Math.hypot(bo.x - CX, bo.y - CY) > RAD) continue;
                    const n = bo.name, c = bo.controller, a = acc[n] = acc[n] || {
                        t: 0, slow: 0, touch: 0, slowNoTouch: 0, dist: 0,
                        armed: 0, landAhead: 0, wiggle: 0, defl: 0, irons: 0, spin: 0, reflex: 0 };
                    const v = (bo.speed || 0) * 60;
                    a.t += DT; a.dist += v * DT;
                    const touched = !!hit[n];
                    if (touched) a.touch += DT;
                    if (v < 40) { a.slow += DT; if (!touched) a.slowNoTouch += DT; }
                    if (bo.raceState.roundArmed) a.armed += DT;
                    const g = state.course.botGrid;
                    if (g) {
                        let blocked = 0;
                        for (const dd of [90, 180]) {
                            const cc = g.cell(bo.x + Math.sin(bo.heading) * dd, bo.y - Math.cos(bo.heading) * dd);
                            if (!g.at(cc[0], cc[1])) { blocked = 1; break; }
                        }
                        if (blocked) a.landAhead += DT;
                    }
                    if (c) {
                        if (c.wiggleActive) a.wiggle += DT;
                        if (Math.abs(c.lastAvoidDeviation || 0) > 0.26) a.defl += DT;
                        if (c.penaltySpin) a.spin += DT;
                        if (c.iceEscapeTimer > 0) a.reflex += DT;
                    }
                    const lw = getWindAt(bo.x, bo.y);
                    if (Math.abs(normalizeAngle(bo.heading - lw.direction)) < 0.55) a.irons += DT;
                }
            }
            window.onRaceEvent = inner;
            return Object.entries(acc).map(([n, a]) => ({ boat: n, ...a }));
        }, { seed: SEED0 + t, CX, CY, RAD });
        console.log(`seed ${SEED0 + t}: ${r.length} boats entered the pocket`);
        for (const x of r) rows.push(x);
    }
    await b.close();
    const n = rows.length || 1;
    const S = k => rows.reduce((a, r) => a + (r[k] || 0), 0) / n;
    const pct = (a, b2) => b2 ? (100 * a / b2).toFixed(0) + '%' : '-';
    console.log(`\n=== POCKET (${CX},${CY}) r=${RAD} on ${VENUE} (${TRIALS} seeds from ${SEED0}, ${path.basename(ROOT)}) ===`);
    console.log(`${rows.length} boat-visits`);
    console.log(`  TIME IN POCKET       ${S('t').toFixed(1)} s/boat   distance ${S('dist').toFixed(0)}u   mean speed ${(S('dist') / (S('t') || 1)).toFixed(0)} u/s`);
    console.log(`  under 40 u/s         ${S('slow').toFixed(1)} s/boat  (${pct(S('slow'), S('t'))} of pocket time)`);
    console.log(`  ⭐ IN LAND CONTACT     ${S('touch').toFixed(1)} s/boat  (${pct(S('touch'), S('t'))} of pocket time,` +
        ` ${pct(S('touch'), S('slow'))} of the slow time)`);
    console.log(`  ⭐ SLOW BUT NOT TOUCHING ${S('slowNoTouch').toFixed(1)} s/boat  (${pct(S('slowNoTouch'), S('slow'))} of the slow time)`);
    console.log(`  state mix (share of pocket time): armed ${pct(S('armed'), S('t'))}  landAhead ${pct(S('landAhead'), S('t'))}` +
        `  deflected ${pct(S('defl'), S('t'))}  wiggle ${pct(S('wiggle'), S('t'))}  inIrons ${pct(S('irons'), S('t'))}` +
        `  penaltySpin ${pct(S('spin'), S('t'))}  contactReflex ${pct(S('reflex'), S('t'))}`);
    console.log(`\n  → if IN LAND CONTACT dominates the slow time, this pocket belongs to the CONTACT system.`);
    console.log(`  → if SLOW BUT NOT TOUCHING dominates, it is routing/execution near land, not grounding.`);
})();
