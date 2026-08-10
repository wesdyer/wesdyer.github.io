// H1 REACHABILITY: does a tangential peel-off change the commanded heading, and
// how often? (2026-08-09 evening, THE GROUNDING PUSH phase A pre-gate.)
//
// Rule 4's corollary: an exactly-zero bench is evidence about REACHABILITY, so
// measure the action delta BEFORE building the tree. The engine sets
// `boat.ai.collisionData = {type:'island', normal}` immediately BEFORE firing
// `collision_island`, so at event time this probe can read the exact normal the
// reflex is about to use — no code change, no candidate tree, HEAD behaviour.
//
// At each land contact it computes:
//   · the CURRENT reflex heading  = straight out along the normal
//   · the PEEL heading            = best sailable candidate maximising
//     (tangent-toward-nav) + 0.35*(outwardness), outward candidates only
// and reports how far apart they are, how often a sailable outward tangent even
// exists, and what share of contacts have way on. If the two headings coincide,
// or no outward candidate is ever sailable, H1 cannot pay and should not be built.
//
// ⚠️ boat.speed at event time is POST the 0.4x grounding multiply (script.js
// ~18381 runs before the event) — the pre-contact speed is 2.5x this.
//   node _peel_geom.js <venue> <trials> <seed0> <tree> [wayOnUPS]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'redrock';
const TRIALS = parseInt(process.argv[3]) || 6;
const SEED0 = parseInt(process.argv[4]) || 9400;
const ROOT = path.join(__dirname, process.argv[5] || 'treeA2');
const WAYON = parseFloat(process.argv[6]) || 20;

(async () => {
    const b = await chromium.launch(); const p = await b.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await p.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const all = [];
    for (let t = 0; t < TRIALS; t++) {
        const r = await p.evaluate(async ({ seed, WAYON }) => {
            const rows = [];
            const TWAS = [];
            for (const o of [0.65, 0.85, 1.05, 1.3, 1.55, 1.8, 2.1, 2.4, 2.75, 3.1]) { TWAS.push(o); TWAS.push(-o); }
            const inner = window.onRaceEvent;
            window.onRaceEvent = (ty, d) => {
                if (ty === 'collision_island' && d && d.boat && !d.boat.isPlayer && !d.isFloe
                    && !d.boat.raceState.finished && state.race.status === "racing" && d.boat.controller) {
                    const ai = d.boat.controller, col = d.boat.ai.collisionData;
                    if (col && col.type === 'island') {
                        const n = col.normal;
                        const curH = Math.atan2(-n.x, n.y);              // today's reflex
                        const outX = -n.x, outY = -n.y;
                        let tx = -n.y, ty = n.x, haveNav = 0;
                        if (ai._lastNav) {
                            haveNav = 1;
                            const gx = ai._lastNav.x - d.boat.x, gy = ai._lastNav.y - d.boat.y;
                            if (tx * gx + ty * gy < 0) { tx = -tx; ty = -ty; }
                        }
                        const lw = getWindAt(d.boat.x, d.boat.y).direction;
                        let best = -Infinity, pick = null, nOut = 0;
                        for (const off of TWAS) {
                            const h = normalizeAngle(lw + off);
                            const dx = Math.sin(h), dy = -Math.cos(h);
                            const outness = dx * outX + dy * outY;
                            if (outness <= 0) continue;
                            nOut++;
                            const sc = (dx * tx + dy * ty) + 0.35 * outness;
                            if (sc > best) { best = sc; pick = h; }
                        }
                        // How far is today's normal-out heading from sailable water?
                        let twaCur = Math.abs(normalizeAngle(curH - lw));
                        rows.push({
                            leg: d.boat.raceState.leg,
                            ups: d.boat.speed * 60 * 2.5,   // pre-contact speed, u/s
                            wall: col.isWall ? 1 : 0,
                            haveNav, nOut,
                            twaCur,
                            armed: d.boat.raceState.roundArmed ? 1 : 0,
                            delta: pick == null ? null : Math.abs(normalizeAngle(pick - curH)),
                        });
                    }
                }
                return inner && inner(ty, d);
            };
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(x => x.isPlayer); pl.x = 1e6; pl.y = 1e6;
            for (let it = 0; it < 60 * 900; it++) {
                window.update(1 / 60);
                if (state.race.status === 'finished') break;
            }
            window.onRaceEvent = inner;
            return { rows, nBoats: state.boats.filter(x => !x.isPlayer).length };
        }, { seed: SEED0 + t, WAYON });
        console.log(`seed ${SEED0 + t}: ${r.rows.length} land contacts over ${r.nBoats} boats`);
        for (const x of r.rows) all.push(x);
    }
    await b.close();

    const q = (a, pp) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(pp * (s.length - 1))] : NaN; };
    const pct = (n, d) => d ? (100 * n / d).toFixed(1) + '%' : '-';
    const D = (deg) => (deg * 180 / Math.PI).toFixed(0);
    console.log(`\n=== H1 PEEL-OFF REACHABILITY (${VENUE}, ${TRIALS} seeds from ${SEED0}, ${path.basename(ROOT)}) ===`);
    console.log(`land contacts ${all.length}  (wall ${pct(all.filter(x => x.wall).length, all.length)},` +
        ` armed ${pct(all.filter(x => x.armed).length, all.length)})`);
    const nav = all.filter(x => x.haveNav);
    console.log(`have _lastNav: ${pct(nav.length, all.length)}   sailable-outward candidate exists: ` +
        `${pct(all.filter(x => x.nOut > 0).length, all.length)}  (median ${q(all.map(x => x.nOut), 0.5)} of 20)`);
    console.log(`entry speed u/s: p25 ${q(all.map(x => x.ups), 0.25).toFixed(0)}  med ${q(all.map(x => x.ups), 0.5).toFixed(0)}  p75 ${q(all.map(x => x.ups), 0.75).toFixed(0)}`);
    console.log(`way on (>${WAYON} u/s): ${pct(all.filter(x => x.ups > WAYON).length, all.length)}`);
    const twa = all.map(x => x.twaCur);
    console.log(`TODAY'S reflex heading TWA: med ${D(q(twa, 0.5))}deg   in the no-go (<0.55 rad = 32deg): ` +
        `${pct(all.filter(x => x.twaCur < 0.55).length, all.length)}  <-- straight-out is not always sailable`);
    // The population H1 would actually act on
    const fire = all.filter(x => x.haveNav && x.ups > WAYON && x.delta != null && !x.armed);
    console.log(`\nH1 FIRES on ${pct(fire.length, all.length)} of land contacts (nav + way on + sailable tangent + not armed)`);
    if (fire.length) {
        const d = fire.map(x => x.delta);
        console.log(`  heading change vs today: p25 ${D(q(d, 0.25))}  med ${D(q(d, 0.5))}  p75 ${D(q(d, 0.75))}  p90 ${D(q(d, 0.9))} deg`);
        console.log(`  unchanged (<10deg): ${pct(fire.filter(x => x.delta < 0.175).length, fire.length)}` +
            `   big turn (>60deg): ${pct(fire.filter(x => x.delta > 1.047).length, fire.length)}`);
        const byLeg = {};
        for (const x of fire) byLeg[x.leg] = (byLeg[x.leg] || 0) + 1;
        console.log(`  by leg: ` + Object.keys(byLeg).sort((a, c) => a - c).map(k => `L${k} ${byLeg[k]}`).join('  '));
    }
    const blocked = all.filter(x => !(x.haveNav && x.ups > WAYON && x.delta != null && !x.armed));
    const why = { noNav: 0, noWay: 0, noTangent: 0, armed: 0 };
    for (const x of blocked) {
        if (!x.haveNav) why.noNav++; else if (x.armed) why.armed++;
        else if (!(x.ups > WAYON)) why.noWay++; else why.noTangent++;
    }
    console.log(`  blocked: noNav ${why.noNav}  armed(mid-rounding branch owns it) ${why.armed}  noWayOn ${why.noWay}  noSailableTangent ${why.noTangent}`);
})();
