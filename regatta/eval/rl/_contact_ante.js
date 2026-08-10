// WHAT WAS THE BOAT DOING BEFORE IT HIT THE ROCK? (2026-08-10, redrock's bowl)
//
// `_bowl_helm` settled what holds the fleet down: on slow frames it asks for
// 86.7 u/s at FULL throttle and delivers 16.1, with 0% braking, 82% "recovering",
// and the contact reflex owning the helm 63% of the time. So the bowl's 26.5
// s/boat is the grounding tail — brief contacts, long recoveries.
//
// That makes ARRIVAL the only lever left (escape quality is already spent: the
// commanded escape is 1.5% from optimal on redrock). The question this answers is
// the one the parked to-do names and nobody has measured: **why do boats arrive on
// the rock at all**, in a pocket whose grid admits 96% of HER line?
//
// The suspicion is rule 17's displacement: a boat is deflected by a RIVAL into
// water it never routed through. So for every contact episode, look back over the
// preceding seconds and record what the boat was doing:
//   - was it deflected (|lastAvoidDeviation| large) and against whom?
//   - was it under an engaged threat, and in which role?
//   - was it already off its own planned path?
//   - or was it simply sailing its route and the route touched rock?
// The last case would mean the ROUTE is at fault; the others mean the RESPONSE is.
//
// ⚠️ Rule 28: an episode's ENTRY state is not its typical frame. Everything here is
// sampled at a fixed lookback BEFORE entry, never during the grind.
//
//   node _contact_ante.js <venue> <trials> <seed0> <tree> <cx> <cy> <r>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'redrock';
const TRIALS = parseInt(process.argv[3]) || 4;
const SEED0 = parseInt(process.argv[4]) || 9400;
const ROOT = path.join(__dirname, process.argv[5] || 'treePROBE');
const CX = parseFloat(process.argv[6] !== undefined ? process.argv[6] : -747);
const CY = parseFloat(process.argv[7] !== undefined ? process.argv[7] : -1416);
const RR = parseFloat(process.argv[8] !== undefined ? process.argv[8] : 400);

const q = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(p * (s.length - 1))] : NaN; };

(async () => {
    const b = await chromium.launch(); const p = await b.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await p.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });

    let EP = [];
    for (let t = 0; t < TRIALS; t++) {
        const r = await p.evaluate(({ seed, CX, CY, RR }) => {
            const hit = {}; const inner = window.onRaceEvent;
            window.onRaceEvent = (ty, d) => {
                if (ty === 'collision_island' && d && d.boat && !d.boat.isPlayer && !d.isFloe) hit[d.boat.name] = 1;
                return inner && inner(ty, d);
            };
            window.evalHarness.seed = seed; window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(x => x.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
            const DT = 1 / 60, LOOK = 2.0;                 // seconds of lookback
            const RING = Math.round(LOOK / DT);
            const hist = {};                                // name -> ring buffer
            const wasHit = {};
            const eps = [];
            for (let it = 0; it < 60 * 900; it++) {
                for (const k in hit) delete hit[k];
                window.update(DT);
                if (state.race.status !== 'racing') { if (state.race.status === 'finished') break; continue; }
                for (const bo of state.boats) {
                    if (bo.isPlayer || bo.raceState.finished || bo.raceState.leg < 1) continue;
                    const c = bo.controller; if (!c) continue;
                    const nm = bo.name;
                    const h = hist[nm] = hist[nm] || [];
                    // distance from the boat to its own planned path (off-route measure)
                    let offPath = null;
                    const gp = c.gridPath;
                    if (gp && gp.length > 1) {
                        let m = Infinity, px = gp[0].x, py = gp[0].y;
                        for (let k = 1; k < gp.length; k++) {
                            const ax = px, ay = py, bx = gp[k].x, by = gp[k].y;
                            const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
                            let s = L ? ((bo.x - ax) * dx + (bo.y - ay) * dy) / L : 0;
                            s = Math.max(0, Math.min(1, s));
                            m = Math.min(m, Math.hypot(bo.x - (ax + s * dx), bo.y - (ay + s * dy)));
                            px = bx; py = by;
                        }
                        offPath = m;
                    }
                    h.push({
                        defl: Math.abs(c.lastAvoidDeviation || 0),
                        risk: c.riskState, role: c.avoidanceRole,
                        threat: c.threatBoat ? c.threatBoat.name : null,
                        thDist: c.threatBoat ? Math.hypot(c.threatBoat.x - bo.x, c.threatBoat.y - bo.y) : null,
                        armed: !!bo.raceState.roundArmed, wig: !!c.wiggleActive,
                        v: (bo.speed || 0) * 60, offPath,
                    });
                    if (h.length > RING) h.shift();
                    const inPk = Math.hypot(bo.x - CX, bo.y - CY) <= RR;
                    const nowHit = !!hit[nm];
                    if (nowHit && !wasHit[nm] && inPk && h.length >= RING) {
                        const a = h[0];                     // state LOOK seconds before entry
                        eps.push({ deflA: a.defl, riskA: a.risk, roleA: a.role,
                                   threatA: !!a.threat, thDistA: a.thDist, armedA: a.armed,
                                   wigA: a.wig, vA: a.v, offA: a.offPath,
                                   vEntry: (bo.speed || 0) * 60 });
                    }
                    wasHit[nm] = nowHit;
                }
            }
            window.onRaceEvent = inner;
            return eps;
        }, { seed: SEED0 + t, CX, CY, RR });
        EP = EP.concat(r);
        console.log(`seed ${SEED0 + t}: ${r.length} contact episodes started in the pocket`);
    }
    await b.close();

    const n = EP.length || 1;
    const P = x => (100 * x / n).toFixed(0) + '%';
    console.log(`\n=== ${VENUE.toUpperCase()} BOWL: THE 2 s BEFORE EACH CONTACT (${EP.length} episodes, ${TRIALS} seeds) ===`);
    console.log(`speed 2 s before   med ${q(EP.map(e => e.vA), 0.5).toFixed(0)} u/s      at entry med ${q(EP.map(e => e.vEntry), 0.5).toFixed(0)} u/s`);
    console.log(`\n  WHAT WAS SHE DOING 2 s BEFORE SHE TOUCHED?`);
    console.log(`    deflected >15deg by avoidance      ${P(EP.filter(e => e.deflA > 0.26).length)}`);
    console.log(`    had an ENGAGED threat              ${P(EP.filter(e => e.threatA).length)}` +
        `   (of those, GIVE_WAY ${P(EP.filter(e => e.threatA && e.roleA === 'GIVE_WAY').length)} / STAND_ON ${P(EP.filter(e => e.threatA && e.roleA === 'STAND_ON').length)})`);
    console.log(`    already OFF its own path by >60u   ${P(EP.filter(e => e.offA != null && e.offA > 60).length)}` +
        `   (median off-path ${q(EP.filter(e => e.offA != null).map(e => e.offA), 0.5).toFixed(0)}u)`);
    console.log(`    armed (rounding)                   ${P(EP.filter(e => e.armedA).length)}`);
    console.log(`    wiggling                           ${P(EP.filter(e => e.wigA).length)}`);
    console.log(`    ⭐ CLEAN: no threat, no deflection, on path  ${P(EP.filter(e => !e.threatA && e.deflA <= 0.26 && !(e.offA > 60)).length)}`);
    console.log(`\n  → deflected/threatened dominant => DISPLACEMENT (rule 17): fix the response.`);
    console.log(`  → clean-and-on-path dominant    => the ROUTE itself touches rock: fix admission.`);
})();
