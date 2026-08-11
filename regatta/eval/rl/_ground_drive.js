// CAN A GROUNDED BOAT PHYSICALLY LEAVE? (2026-08-10, river leg 3)
//
// `_riv_hot` says 46% of river leg 3's slow time sits in four 250u cells where
// the contact reflex owns 98-100% of the helm, the boats are in land contact
// 85-99% of frames, and they do 3-19 u/s against an ACHIEVABLE target of
// 86-133. Steering is not the suspect: the snap-turn landing already gave this
// reflex 5x rudder authority. DRIVE is, for two reasons visible in the physics:
//
//   1. `collision_island` does `boat.speed *= 0.4` on EVERY frame of overlap
//      (~18945) and pushes the hull out to EXACTLY zero overlap — no margin —
//      so a boat with any inward velocity re-touches next frame. Against a 5.5s
//      acceleration constant that is a ratchet to zero.
//   2. The progressive-power floor at ~12232 that exists precisely to "slide off
//      obstacles" is scoped `wiggleActive || escActive`. The contact reflex —
//      the one maneuver that only ever runs while the boat is ON the obstacle —
//      is not in the list. It gets the rudder and not the power.
//
// The ground-frame escape then scores its candidate headings with
// `getTargetSpeed(...)*0.25*60` — the speed the boat COULD do (~126 u/s), not
// the speed it HAS (~9). That mattered little where the model was checked (the
// term competes against the stream) but river's stream is ~60 u/s, so at 9 u/s
// the boat is a cork and the ranking is scored on a boat that does not exist.
//
// So the decisive question, measured on real contacts, is whether the escape is
// being asked to do something impossible:
//   * outward track using the ASSUMED speed (today's model) -> its "no heading
//     escapes" rate, which the landing measured at 0.0%
//   * outward track using the ACTUAL speed -> the true rate
//   * and what floor (0.15/0.30/0.50/0.75 game speed) would restore an escape
//
// If "no escape at actual speed" is large and shrinks under the floor, the fix
// is drive, not steering, and the floor is already written — just mis-scoped.
//
// usage: node _ground_drive.js [venue] [trials] [seed0] [tree]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'river';
const TRIALS = parseInt(process.argv[3]) || 4;
const SEED0 = parseInt(process.argv[4]) || 7300;
const ROOT = path.join(__dirname, process.argv[5] || 'treePROBE');

(async () => {
    const b = await chromium.launch(); const p = await b.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await p.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });

    const all = [];
    for (let t = 0; t < TRIALS; t++) {
        const r = await p.evaluate(({ seed }) => {
            const TWAS = [];
            for (const o of [0.65, 0.85, 1.05, 1.3, 1.55, 1.8, 2.1, 2.4, 2.75, 3.1]) { TWAS.push(o); TWAS.push(-o); }
            const rows = [];
            const inner = window.onRaceEvent;
            window.onRaceEvent = (ty, d) => {
                if (ty === 'collision_island' && d && d.boat && !d.boat.isPlayer && !d.isFloe
                    && state.race.status === 'racing' && !d.boat.raceState.finished) {
                    const bo = d.boat, col = bo.ai && bo.ai.collisionData;
                    if (col && col.normal) {
                        // outward = away from the collider
                        const ox = -col.normal.x, oy = -col.normal.y;
                        const cur = getCurrentAt(bo.x, bo.y);
                        const cU = cur ? (cur.speed / 4) * 60 : 0;
                        const cvx = cur ? Math.sin(cur.direction) * cU : 0;
                        const cvy = cur ? -Math.cos(cur.direction) * cU : 0;
                        const w = getWindAt(bo.x, bo.y);
                        const vNow = (bo.speed || 0) * 60;
                        // stream's own component along the outward normal
                        const curOut = cvx * ox + cvy * oy;
                        // best outward track under three speed models
                        const best = (mode) => {
                            let bt = -Infinity;
                            for (const off of TWAS) {
                                const h = normalizeAngle(w.direction + off);
                                const pol = getTargetSpeed(Math.abs(off), false, w.speed) * 0.25 * 60;
                                let v;
                                if (mode === 'assumed') v = pol;                     // today's model
                                else if (mode === 'actual') v = Math.min(pol, vNow); // what she has
                                else v = Math.min(pol, Math.max(vNow, mode));        // with a floor
                                const tOut = (Math.sin(h) * v + cvx) * ox + (-Math.cos(h) * v + cvy) * oy;
                                if (tOut > bt) bt = tOut;
                            }
                            return bt;
                        };
                        rows.push({
                            leg: bo.raceState.leg, x: Math.round(bo.x), y: Math.round(bo.y),
                            v: vNow, cU, curOut,
                            bAssumed: best('assumed'), bActual: best('actual'),
                            b015: best(0.15 * 60), b030: best(0.30 * 60),
                            b050: best(0.50 * 60), b075: best(0.75 * 60),
                            reflex: bo.controller && bo.controller.iceEscapeTimer > 0 ? 1 : 0,
                            wig: bo.controller && bo.controller.wiggleActive ? 1 : 0,
                            esc: bo.controller && bo.controller.escActive ? 1 : 0,
                        });
                    }
                }
                return inner && inner(ty, d);
            };
            window.evalHarness.seed = seed; window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(x => x.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
            for (let it = 0; it < 60 * 900; it++) {
                window.update(1 / 60);
                if (state.race.status === 'finished') break;
                if (state.race.status === 'racing' && state.race.timer > 880) break;
            }
            return rows;
        }, { seed: SEED0 + t });
        for (const q of r) all.push(q);
        console.log(`seed ${SEED0 + t}: ${r.length} land contacts`);
    }
    await b.close();

    const med = (a) => a.length ? a.slice().sort((x, y) => x - y)[a.length >> 1] : 0;
    const pct = (n, d) => d ? (100 * n / d).toFixed(1).padStart(5) + '%' : '   -  ';
    const show = (label, rows) => {
        if (!rows.length) { console.log(`${label}: none`); return; }
        const n = rows.length;
        console.log(`\n--- ${label}  (n=${n}) ---`);
        console.log(`  boat speed        median ${med(rows.map(r => r.v)).toFixed(1)} u/s   p90 ${rows.map(r=>r.v).sort((a,b)=>a-b)[Math.floor(n*0.9)].toFixed(1)}`);
        console.log(`  stream            median ${med(rows.map(r => r.cU)).toFixed(1)} u/s  (${(med(rows.map(r=>r.cU))/60*4).toFixed(2)} kt)`);
        console.log(`  stream pushes ON to the land   ${pct(rows.filter(r => r.curOut < 0).length, n)}`);
        console.log(`  stream's onshore push EXCEEDS the boat's whole speed  ${pct(rows.filter(r => -r.curOut > r.v).length, n)}`);
        console.log(`  NO HEADING ESCAPES (best outward track <= 0):`);
        console.log(`     under the ASSUMED speed (today's escape model)  ${pct(rows.filter(r => r.bAssumed <= 0).length, n)}`);
        console.log(`     under the ACTUAL speed she has                  ${pct(rows.filter(r => r.bActual <= 0).length, n)}`);
        console.log(`     with the 0.15 floor (wiggle's first rung)       ${pct(rows.filter(r => r.b015 <= 0).length, n)}`);
        console.log(`     with the 0.30 floor                             ${pct(rows.filter(r => r.b030 <= 0).length, n)}`);
        console.log(`     with the 0.50 floor                             ${pct(rows.filter(r => r.b050 <= 0).length, n)}`);
        console.log(`     with the 0.75 floor (fully stuck rung)          ${pct(rows.filter(r => r.b075 <= 0).length, n)}`);
        console.log(`  median best outward track: assumed ${med(rows.map(r=>r.bAssumed)).toFixed(0)}  actual ${med(rows.map(r=>r.bActual)).toFixed(0)}  @0.30 ${med(rows.map(r=>r.b030)).toFixed(0)}  @0.75 ${med(rows.map(r=>r.b075)).toFixed(0)} u/s`);
    };

    console.log(`\n=== ${VENUE.toUpperCase()}: CAN A GROUNDED BOAT LEAVE? (${TRIALS} seeds, ${all.length} contacts) ===`);
    show('ALL land contacts', all);
    show('LEG 3 only', all.filter(r => r.leg === 3));
    show('contact-reflex driving, no wiggle/escape', all.filter(r => r.reflex && !r.wig && !r.esc));
    const hot = all.filter(r => r.x > 3400 && r.x < 4500 && r.y > -4200 && r.y < -3400);
    show('THE HOT CELL x 3400-4500, y -4200..-3400', hot);
})();
