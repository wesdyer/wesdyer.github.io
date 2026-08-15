// BEAT-DISTANCE DECOMPOSITION (P4, human-level push 2026-08-09).
// bay/lake/ocean: the fleet sails 16-27% further than the human while FASTER
// through the water, and that excess is the whole gap. Split the waste:
//   per bot-frame on the leg, waste = (speed - VMC toward leg target) * dt,
//   bucketed by state: AVOID (lastAvoidDeviation>0.08), WIGGLE, TACKWIN (4s
//   after a windSide flip), ARMED (rounding machinery), CLEAN (none of the
//   above = pointing/routing quality).
// Also: odometer, net progress, tack count, DMC planned leg length, straight
// line — bot fleet medians vs the human laps on the frozen doc.
//   node _beat_decomp.js <venue> <leg> <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const VENUE = process.argv[2] || 'bay', LEG = parseInt(process.argv[3]) || 1;
const TRIALS = parseInt(process.argv[4]) || 6, SEED0 = parseInt(process.argv[5]) || 9100;
const ROOT = path.join(__dirname, process.argv[6] || 'treeP0');

(async () => {
    const b = await chromium.launch(); const p = await b.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await p.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });

    const rows = [];
    let meta = null;
    for (let t = 0; t < TRIALS; t++) {
        const seed = SEED0 + t;
        const r = await p.evaluate(async ({ seed, LEG }) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(x => x.isPlayer); pl.x = 1e6; pl.y = 1e6;
            const dt = 1 / 60;
            const marks = state.course.marks;
            const route = state.course.route || null;
            // leg target: where the leg ends (next waypoint of boats on LEG)
            const acc = {};
            for (const bt of state.boats) if (!bt.isPlayer) acc[bt.id] = {
                odo: 0, godo: 0, px: null, py: null, secs: 0,
                waste: { AVOID_ROW: 0, AVOID_GW: 0, AVOID_NONE: 0, WIGGLE: 0, TACKWIN: 0, ARMED: 0, CLEAN: 0 },
                time: { AVOID_ROW: 0, AVOID_GW: 0, AVOID_NONE: 0, WIGGLE: 0, TACKWIN: 0, ARMED: 0, CLEAN: 0 },
                tacks: 0, lastSide: null, lastTackT: -99, sx: null, sy: null, ex: null, ey: null, frames: 0
            };
            const dmcLen = (state.course.dmc && state.course.dmc.legs && state.course.dmc.legs[LEG]
                && state.course.dmc.legs[LEG].cum) ? state.course.dmc.legs[LEG].cum[state.course.dmc.legs[LEG].cum.length - 1] : null;
            for (let it = 0; it < 60 * 900; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                for (const bt of state.boats) {
                    if (bt.isPlayer || bt.raceState.finished) continue;
                    if (bt.raceState.leg !== LEG) continue;
                    const a = acc[bt.id]; a.frames++;
                    if (a.sx === null) { a.sx = bt.x; a.sy = bt.y; }
                    a.ex = bt.x; a.ey = bt.y;
                    const wp = bt.raceState.nextWaypoint;
                    // ⚠️ UNITS (rule 18): boat.speed and velocity are PER-FRAME; ×60 = u/s.
                    const spd = (bt.speed || 0) * 60;
                    a.odo += spd * dt;                      // HULL frame: what speed says
                    // GROUND frame: what the boat actually travelled. On glowtide these
                    // disagree by 21% with zero current, so both are carried and the
                    // ratio is printed — never quote one against a human lap measured in
                    // the other (see _frame_odo.js).
                    if (a.px !== null) { const gd = Math.hypot(bt.x - a.px, bt.y - a.py); if (gd < 50) a.godo += gd; }
                    a.px = bt.x; a.py = bt.y;
                    a.secs += dt;
                    // VMC toward the waypoint the engine says this leg ends at
                    let vmc = 0;
                    if (wp && typeof wp.x === 'number') {
                        const dx = wp.x - bt.x, dy = wp.y - bt.y, dd = Math.hypot(dx, dy) || 1;
                        vmc = 60 * (bt.velocity.x * dx + bt.velocity.y * dy) / dd;
                    }
                    const waste = Math.max(0, spd - vmc) * dt;
                    const c = bt.controller || {};
                    const side = bt.lastWindSide;
                    if (a.lastSide != null && side !== a.lastSide && side !== undefined) { a.tacks++; a.lastTackT = state.time; }
                    a.lastSide = side;
                    const armed = !!(bt.raceState.roundArmed || c.dmcCarrotS != null && state.course.type === 'islandRound');
                    let bucket = 'CLEAN';
                    if ((c.lastAvoidDeviation || 0) > 0.08) {
                        bucket = c.avoidanceRole === 'STAND_ON' ? 'AVOID_ROW'
                               : c.avoidanceRole === 'GIVE_WAY' ? 'AVOID_GW' : 'AVOID_NONE';
                    }
                    else if (c.wiggleActive) bucket = 'WIGGLE';
                    else if (state.time - a.lastTackT < 4 * 0.24) bucket = 'TACKWIN';
                    else if (armed) bucket = 'ARMED';
                    a.waste[bucket] += waste; a.time[bucket] += dt;
                }
            }
            const out = [];
            for (const bt of state.boats) {
                if (bt.isPlayer) continue;
                const a = acc[bt.id];
                if (!a.frames || a.sx === null) continue;
                const straight = Math.hypot(a.ex - a.sx, a.ey - a.sy);
                out.push({ n: bt.name, odo: Math.round(a.odo), godo: Math.round(a.godo), secs: +a.secs.toFixed(1), straight: Math.round(straight),
                    tacks: a.tacks, fin: bt.raceState.finishTime || null,
                    w: Object.fromEntries(Object.entries(a.waste).map(([k, v]) => [k, Math.round(v)])),
                    tm: Object.fromEntries(Object.entries(a.time).map(([k, v]) => [k, Math.round(v)])) });
            }
            return { boats: out, dmcLen: dmcLen && Math.round(dmcLen) };
        }, { seed, LEG });
        if (!meta) meta = { dmcLen: r.dmcLen };
        rows.push(...r.boats);
        console.log(`seed ${seed}: ${r.boats.length} boats through leg ${LEG}`);
    }
    await b.close();

    const med = (arr) => { const s = [...arr].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
    console.log(`\n=== ${VENUE} leg ${LEG} decomposition (${rows.length} boat-legs, dmcLen ${meta.dmcLen}) ===`);
    console.log(`GROUND odo med ${med(rows.map(r => r.godo))}  hull odo med ${med(rows.map(r => r.odo))}  (g/h ${(med(rows.map(r => r.godo)) / med(rows.map(r => r.odo))).toFixed(3)})`);
    console.log(`straight med ${med(rows.map(r => r.straight))}  tacks med ${med(rows.map(r => r.tacks))}  secs med ${med(rows.map(r => r.secs))}  ground speed med ${(med(rows.map(r => r.godo)) / med(rows.map(r => r.secs))).toFixed(1)} u/s`);
    for (const k of ['AVOID_ROW', 'AVOID_GW', 'AVOID_NONE', 'WIGGLE', 'TACKWIN', 'ARMED', 'CLEAN']) {
        console.log(`  waste ${k}: med ${med(rows.map(r => r.w[k]))}u  (time med ${med(rows.map(r => r.tm[k]))}s)`);
    }
})();
