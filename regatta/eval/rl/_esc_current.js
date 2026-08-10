// DOES THE ESCAPE HEADING ESCAPE? — the contact reflex in the GROUND frame.
// (2026-08-09 night, chasing the river regression from the snap-turn landing.)
//
// The reflex commands a HEADING away from the collision normal. The boat does not
// travel along its heading: `updateBoat` adds the current straight into the
// velocity (~11859, cVx = sin(dir) * knots/4). On a venue with a strong set, the
// heading can point perfectly out of the bank while the TRACK still goes into it
// — and the harder the boat commits to that heading (which is exactly what 5x
// snap-turn authority makes it do), the more completely the current decides where
// she actually goes.
//
// Per land contact this reports the current's component ALONG the outward normal
// (negative = the stream is setting her onto the rock), in u/s, beside the boat
// speed she has to fight it with, and the share of contacts where no sailable
// heading has an outward TRACK at all. Run it on river against redrock/lake:
// if the river number is an order out, the regression is a ground-frame problem,
// not a turn-authority problem.
//   node _esc_current.js <venue> <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'river';
const TRIALS = parseInt(process.argv[3]) || 3;
const SEED0 = parseInt(process.argv[4]) || 9100;
const ROOT = path.join(__dirname, process.argv[5] || 'treeA2');

(async () => {
    const b = await chromium.launch(); const p = await b.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await p.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const all = [];
    for (let t = 0; t < TRIALS; t++) {
        const r = await p.evaluate(async ({ seed }) => {
            const rows = [];
            const TWAS = [];
            for (const o of [0.65, 0.85, 1.05, 1.3, 1.55, 1.8, 2.1, 2.4, 2.75, 3.1]) { TWAS.push(o); TWAS.push(-o); }
            const inner = window.onRaceEvent;
            window.onRaceEvent = (ty, d) => {
                if (ty === 'collision_island' && d && d.boat && !d.boat.isPlayer && !d.isFloe
                    && !d.boat.raceState.finished && state.race.status === 'racing' && d.boat.ai) {
                    const col = d.boat.ai.collisionData;
                    if (col && col.type === 'island') {
                        const outX = -col.normal.x, outY = -col.normal.y;
                        const cur = getCurrentAt(d.boat.x, d.boat.y) || { speed: 0, direction: 0 };
                        // current in u/s, same convention as a heading
                        const cU = (cur.speed / 4) * 60;
                        const cvx = Math.sin(cur.direction) * cU, cvy = -Math.cos(cur.direction) * cU;
                        const curOut = cvx * outX + cvy * outY;   // <0 = set ONTO the rock
                        // the speed she has to fight it with: her best sailable pace here,
                        // approximated by the polar the planner itself uses when available
                        let vBest = 0;
                        const lw = getWindAt(d.boat.x, d.boat.y);
                        for (const off of TWAS) {
                            const h = normalizeAngle(lw.direction + off);
                            let v = 0;
                            try { v = getTargetSpeed(Math.abs(off), false, lw.speed) * 0.25 * 60; } catch (e) { v = 0; }
                            if (v > vBest) vBest = v;
                        }
                        // can ANY sailable heading produce an outward TRACK?
                        let bestTrack = -Infinity;
                        for (const off of TWAS) {
                            const h = normalizeAngle(lw.direction + off);
                            let v = 0;
                            try { v = getTargetSpeed(Math.abs(off), false, lw.speed) * 0.25 * 60; } catch (e) { v = 0; }
                            const tx = Math.sin(h) * v + cvx, ty = -Math.cos(h) * v + cvy;
                            const tOut = tx * outX + ty * outY;
                            if (tOut > bestTrack) bestTrack = tOut;
                        }
                        // and what TODAY's commanded heading actually achieves
                        const escH = Math.atan2(-col.normal.x, col.normal.y);
                        const twaE = Math.abs(normalizeAngle(escH - lw.direction));
                        let vE = 0;
                        try { vE = getTargetSpeed(twaE, false, lw.speed) * 0.25 * 60; } catch (e) { vE = 0; }
                        const ex = Math.sin(escH) * vE + cvx, ey = -Math.cos(escH) * vE + cvy;
                        rows.push({
                            leg: d.boat.raceState.leg,
                            curKt: cur.speed, curOut, vBest, bestTrack,
                            escOut: ex * outX + ey * outY,
                            spd: d.boat.speed * 60 * 2.5,
                        });
                    }
                }
                return inner && inner(ty, d);
            };
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(x => x.isPlayer); pl.x = 1e6; pl.y = 1e6;
            for (let it = 0; it < 60 * 900; it++) { window.update(1 / 60); if (state.race.status === 'finished') break; }
            window.onRaceEvent = inner;
            return { rows };
        }, { seed: SEED0 + t });
        console.log(`seed ${SEED0 + t}: ${r.rows.length} land contacts`);
        for (const x of r.rows) all.push(x);
    }
    await b.close();
    const q = (a, pr) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(pr * (s.length - 1))] : NaN; };
    const pct = (n, d) => d ? (100 * n / d).toFixed(1) + '%' : '-';
    console.log(`\n=== ESCAPE IN THE GROUND FRAME (${VENUE}, ${TRIALS} seeds from ${SEED0}, ${path.basename(ROOT)}) ===`);
    console.log(`land contacts ${all.length}`);
    if (!all.length) return;
    console.log(`current at the contact (kt): p50 ${q(all.map(x => x.curKt), .5).toFixed(2)}  p90 ${q(all.map(x => x.curKt), .9).toFixed(2)}`);
    console.log(`current component ALONG THE ESCAPE (u/s, NEGATIVE = set onto the rock):`);
    console.log(`   p10 ${q(all.map(x => x.curOut), .1).toFixed(1)}  p50 ${q(all.map(x => x.curOut), .5).toFixed(1)}  p90 ${q(all.map(x => x.curOut), .9).toFixed(1)}`);
    console.log(`   setting her ONTO the rock: ${pct(all.filter(x => x.curOut < 0).length, all.length)}` +
        `   and harder than 20 u/s: ${pct(all.filter(x => x.curOut < -20).length, all.length)}`);
    console.log(`best sailable boat speed here (u/s): p50 ${q(all.map(x => x.vBest), .5).toFixed(0)}`);
    console.log(`⭐ BEST ACHIEVABLE OUTWARD TRACK over the sailable fan (u/s): p10 ${q(all.map(x => x.bestTrack), .1).toFixed(1)}` +
        `  p50 ${q(all.map(x => x.bestTrack), .5).toFixed(1)}`);
    console.log(`   NO heading escapes (best track <= 0): ${pct(all.filter(x => x.bestTrack <= 0).length, all.length)}`);
    console.log(`⭐ TODAY'S commanded heading, outward TRACK (u/s): p10 ${q(all.map(x => x.escOut), .1).toFixed(1)}` +
        `  p50 ${q(all.map(x => x.escOut), .5).toFixed(1)}`);
    console.log(`   its track goes INTO the rock: ${pct(all.filter(x => x.escOut <= 0).length, all.length)}` +
        `   while a better sailable heading existed: ${pct(all.filter(x => x.escOut <= 0 && x.bestTrack > 0).length, all.length)}`);
})();
