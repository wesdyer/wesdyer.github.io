// THE FERRY ANGLE: DOES NAVIGATION STEER THE TRACK, OR ONLY THE HEADING?
// (2026-08-10, river)
//
// `_riv_hot` + `_ground_drive` moved the question upstream. River leg 3 is not a
// venue with occasional groundings to escape from: ~35% of ALL bot frames are
// land-contact frames, the fleet lives on the bank, and once it is there the
// stream (52 u/s) exceeds the whole boat speed (7 u/s) so 64% of contacts have
// NO escaping heading. Escaping better is treating the symptom. She sails the
// same water 189u off the hot cell at 134 u/s, so the question is why the fleet
// arrives at the bank at all.
//
// The physics is explicit (~12296): velocity = heading * speed, and THEN the
// stream is added straight in. So the boat's TRACK is not its heading whenever
// the water moves. Navigation commands a heading at the carrot and never looks
// at the stream — the ground-frame lesson was applied to the contact reflex
// only. A helmsman who ignores the set on a winding river is carried onto the
// outside of every bend; that is what a ferry angle is for.
//
// So, on NAVIGATION-OWNED frames only (rule 27 precedence — not spin, escape,
// reflex, wiggle or clearance):
//   * heading error   = angle(commanded heading, bearing to the carrot)
//   * TRACK error     = angle(actual track,      bearing to the carrot)
// If navigation is doing its job in the boat frame, the heading error is small
// while the track error carries the whole set. The gap between them IS the
// uncorrected ferry angle, and its sign tells us which bank it puts her on.
//
// Also reported: how much of the track error the stream alone explains, and the
// same numbers on a still venue as a control (the term must vanish there).
//
// usage: node _ferry.js [venue] [trials] [seed0] [tree]
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

    const A = { n: 0, hErr: [], tErr: [], ferry: [], cur: [], spd: [],
                upstreamOfTrack: 0, towardLand: 0, headingClear: 0, both: 0 };
    for (let t = 0; t < TRIALS; t++) {
        const r = await p.evaluate(({ seed }) => {
            window.evalHarness.seed = seed; window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(x => x.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
            const o = { n: 0, hErr: [], tErr: [], ferry: [], cur: [], spd: [],
                        towardLand: 0, headingClear: 0, both: 0 };
            const DT = 1 / 60;
            for (let it = 0; it < 60 * 900; it++) {
                window.update(DT);
                if (state.race.status !== 'racing') { if (state.race.status === 'finished') break; continue; }
                if (it % 6) continue;
                for (const bo of state.boats) {
                    if (bo.isPlayer || bo.raceState.finished || bo.raceState.leg < 1) continue;
                    const c = bo.controller; if (!c || !c._lastNav) continue;
                    // NAVIGATION-OWNED ONLY (rule 27 precedence)
                    if (c.penaltySpin || c.escActive || c.iceEscapeTimer > 0
                        || c.wiggleActive || c.clearanceTimer > 0) continue;
                    const v = bo.velocity; if (!v) continue;
                    const spd = Math.hypot(v.x, v.y) * 60;
                    if (spd < 1) continue;
                    const brg = Math.atan2(c._lastNav.x - bo.x, -(c._lastNav.y - bo.y));
                    const trk = Math.atan2(v.x, -v.y);
                    const hE = normalizeAngle(bo.heading - brg);
                    const tE = normalizeAngle(trk - brg);
                    const fr = normalizeAngle(trk - bo.heading);   // the set, as an angle
                    const cu = getCurrentAt(bo.x, bo.y);
                    o.n++;
                    o.hErr.push(Math.abs(hE) * 180 / Math.PI);
                    o.tErr.push(Math.abs(tE) * 180 / Math.PI);
                    o.ferry.push(Math.abs(fr) * 180 / Math.PI);
                    o.cur.push(cu ? cu.speed : 0);
                    o.spd.push(bo.speed * 60);
                    // Does the TRACK run into land the HEADING would have missed?
                    const g = state.course.botGrid;
                    if (g) {
                        const ray = (ang) => {
                            for (const d of [60, 120, 180, 240]) {
                                const cc = g.cell(bo.x + Math.sin(ang) * d, bo.y - Math.cos(ang) * d);
                                if (!g.at(cc[0], cc[1])) return 1;
                            }
                            return 0;
                        };
                        const hL = ray(bo.heading), tL = ray(trk);
                        if (tL) o.towardLand++;
                        if (!hL) o.headingClear++;
                        if (tL && !hL) o.both++;   // the set alone puts her ashore
                    }
                }
                if (state.race.status === 'racing' && state.race.timer > 880) break;
            }
            return o;
        }, { seed: SEED0 + t });
        A.n += r.n; A.towardLand += r.towardLand; A.headingClear += r.headingClear; A.both += r.both;
        for (const k of ['hErr', 'tErr', 'ferry', 'cur', 'spd']) for (const q of r[k]) A[k].push(q);
        console.log(`seed ${SEED0 + t}: ${r.n} navigation-owned samples`);
    }
    await b.close();

    const q = (a, pp) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(pp * (s.length - 1))] : NaN; };
    const mean = a => a.reduce((x, y) => x + y, 0) / (a.length || 1);
    console.log(`\n=== ${VENUE.toUpperCase()}: DOES NAVIGATION STEER THE TRACK? (${TRIALS} seeds, n=${A.n}) ===`);
    console.log(`  stream       median ${q(A.cur, 0.5).toFixed(2)} kt   boat speed median ${q(A.spd, 0.5).toFixed(0)} u/s`);
    console.log(`  HEADING error vs the carrot   median ${q(A.hErr, 0.5).toFixed(1)}째   p90 ${q(A.hErr, 0.9).toFixed(1)}째`);
    console.log(`  TRACK   error vs the carrot   median ${q(A.tErr, 0.5).toFixed(1)}째   p90 ${q(A.tErr, 0.9).toFixed(1)}째`);
    console.log(`  the uncorrected SET (track - heading)  median ${q(A.ferry, 0.5).toFixed(1)}째   p90 ${q(A.ferry, 0.9).toFixed(1)}째   mean ${mean(A.ferry).toFixed(1)}째`);
    const P = (x) => (100 * x / (A.n || 1)).toFixed(1) + '%';
    console.log(`\n  TRACK runs into land within 240u                       ${P(A.towardLand)}`);
    console.log(`  ...of those, the HEADING was clear (the set alone does it)  ${A.towardLand ? (100 * A.both / A.towardLand).toFixed(1) + '%' : '-'}`);
    console.log(`  => ${P(A.both)} of all navigation frames are being set ashore while steering clear.`);
})();
