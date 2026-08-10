// WHAT HOLDS A BOAT ON THE ROCK? (2026-08-09 night, THE GROUNDING PUSH.)
//
// H1's first shape — peel along the wall tangent when there is way on — LOST the
// leg-5 gate (30.3 -> 41.1 s/boat, 305 -> 412 episodes). Before proposing shape
// two, measure the episode instead of theorising about it. The two candidate
// mechanisms make opposite predictions:
//
//   BOUNCE  the boat leaves wall A on the normal, crosses, hits wall B. Contacts
//           are intermittent, the boat travels a long way inside the episode, and
//           its speed recovers between hits. The escape heading is the lever.
//   GLUE    the boat is in contact EVERY frame; `boat.speed *= 0.4` per frame of
//           overlap fights the acceleration to a fixed point near zero, so it
//           creeps off the surface at a few u/s. Contacts are ~continuous, the
//           boat barely moves, and maximum SEPARATION (today's normal-out) is the
//           right answer — which is exactly why the tangential shape lost.
//
// Records, for every grinding episode: what share of its frames took a contact,
// how far the boat actually travelled, its speed profile, the angle between the
// boat's ACTUAL heading and the outward normal (is the helm even getting there?),
// and which override owned the helm. Prints the aggregate split plus a frame-by
// frame dump of the worst episodes.
//   node _grind_trace.js <venue> <trials> <seed0> <tree> [leg] [dumpN]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'redrock';
const TRIALS = parseInt(process.argv[3]) || 2;
const SEED0 = parseInt(process.argv[4]) || 9400;
const ROOT = path.join(__dirname, process.argv[5] || 'treeA2');
const LEG = process.argv[6] != null && process.argv[6] !== '-' ? parseInt(process.argv[6]) : null;
const DUMPN = parseInt(process.argv[7]) || 3;

(async () => {
    const b = await chromium.launch(); const p = await b.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await p.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const all = [];
    for (let t = 0; t < TRIALS; t++) {
        const r = await p.evaluate(async ({ seed }) => {
            const hit = {};                       // name -> true if contact fired this frame
            const open = {}, done = [];
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
            const CLEAR = 0.75;                   // seconds contact-free that ends an episode
            for (let it = 0; it < 60 * 900; it++) {
                for (const k in hit) delete hit[k];
                window.update(1 / 60);
                if (state.race.status !== 'racing') { if (state.race.status === 'finished') break; continue; }
                const now = state.race.timer;
                for (const bo of state.boats) {
                    if (bo.isPlayer || bo.raceState.finished) continue;
                    const n = bo.name, c = bo.controller, cd = bo.ai && bo.ai.collisionData;
                    const touched = !!hit[n];
                    let o = open[n];
                    if (!o) {
                        if (!touched) continue;
                        o = open[n] = { boat: n, t0: now, leg: bo.raceState.leg, x0: bo.x, y0: bo.y,
                                        frames: 0, touches: 0, dist: 0, vSum: 0, vMax: 0,
                                        offNormSum: 0, offNormN: 0, owner: {}, tLast: now, rows: [] };
                    }
                    o.frames++;
                    if (touched) { o.touches++; o.tLast = now; }
                    const v = (bo.speed || 0) * 60;
                    o.vSum += v; if (v > o.vMax) o.vMax = v;
                    if (o.px != null) o.dist += Math.hypot(bo.x - o.px, bo.y - o.py);
                    o.px = bo.x; o.py = bo.y;
                    // Is the boat's ACTUAL heading pointed out of the rock?
                    if (touched && cd && cd.normal) {
                        const outX = -cd.normal.x, outY = -cd.normal.y;
                        const dx = Math.sin(bo.heading), dy = -Math.cos(bo.heading);
                        o.offNormSum += Math.acos(Math.max(-1, Math.min(1, dx * outX + dy * outY)));
                        o.offNormN++;
                    }
                    const own = c && c.escActive ? 'ESC' : (c && c.wiggleActive ? 'WIG'
                        : (c && c.clearanceTimer > 0 ? 'CLR'
                        : (c && c.iceEscapeTimer > 0 ? 'ICE' : (c && c.markContactTimer > 0 ? 'MRK' : 'nav'))));
                    o.owner[own] = (o.owner[own] || 0) + 1;
                    if (o.rows.length < 400) o.rows.push({
                        t: +(now - o.t0).toFixed(2), h: touched ? 1 : 0, v: +v.toFixed(1),
                        x: Math.round(bo.x), y: Math.round(bo.y),
                        hd: +(bo.heading).toFixed(2),
                        cmd: c && c.iceEscapeTimer > 0 ? +(c.iceEscapeHeading).toFixed(2) : null,
                        tm: c ? +(c.iceEscapeTimer || 0).toFixed(2) : null, own });
                    if (now - o.tLast > CLEAR) {
                        o.dur = o.tLast - o.t0;
                        o.disp = Math.hypot(bo.x - o.x0, bo.y - o.y0);
                        done.push(o); delete open[n];
                    }
                }
            }
            for (const [n, o] of Object.entries(open)) { o.dur = o.tLast - o.t0; o.disp = 0; done.push(o); }
            window.onRaceEvent = inner;
            return { done, nBoats: state.boats.filter(x => !x.isPlayer).length };
        }, { seed: SEED0 + t });
        console.log(`seed ${SEED0 + t}: ${r.done.length} episodes over ${r.nBoats} boats`);
        for (const e of r.done) { e.seed = SEED0 + t; all.push(e); }
    }
    await b.close();

    const q = (a, pr) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(pr * (s.length - 1))] : NaN; };
    const use = (LEG == null ? all : all.filter(e => e.leg === LEG)).filter(e => e.dur >= 1.0);
    if (!use.length) { console.log('no episodes >= 1s'); return; }
    const D = r => (r * 180 / Math.PI).toFixed(0);
    console.log(`\n=== GRIND EPISODES (${VENUE}, ${TRIALS} seeds from ${SEED0}, ${path.basename(ROOT)}` +
        `${LEG != null ? ', leg ' + LEG : ''}) — ${use.length} episodes >= 1.0s ===`);
    const dutyA = use.map(e => e.touches / e.frames);
    console.log(`duration s:        p25 ${q(use.map(e => e.dur), .25).toFixed(1)}  med ${q(use.map(e => e.dur), .5).toFixed(1)}  p75 ${q(use.map(e => e.dur), .75).toFixed(1)}  max ${q(use.map(e => e.dur), 1).toFixed(1)}`);
    console.log(`CONTACT DUTY CYCLE (share of episode frames that took a hit):`);
    console.log(`                   p25 ${(q(dutyA, .25) * 100).toFixed(0)}%  med ${(q(dutyA, .5) * 100).toFixed(0)}%  p75 ${(q(dutyA, .75) * 100).toFixed(0)}%`);
    console.log(`   >80% duty (GLUE): ${(100 * use.filter(e => e.touches / e.frames > 0.8).length / use.length).toFixed(0)}%` +
        `   <40% duty (BOUNCE): ${(100 * use.filter(e => e.touches / e.frames < 0.4).length / use.length).toFixed(0)}%`);
    console.log(`path length u:     med ${q(use.map(e => e.dist), .5).toFixed(0)}   net displacement u: med ${q(use.map(e => e.disp), .5).toFixed(0)}`);
    console.log(`mean speed u/s:    med ${q(use.map(e => e.vSum / e.frames), .5).toFixed(1)}   peak within episode: med ${q(use.map(e => e.vMax), .5).toFixed(0)}`);
    const offs = use.filter(e => e.offNormN).map(e => e.offNormSum / e.offNormN);
    console.log(`ACTUAL heading vs outward normal at contact: med ${D(q(offs, .5))}deg  p75 ${D(q(offs, .75))}deg` +
        `   (0 = pointing straight out; >90 = still pointed INTO the rock)`);
    const own = {};
    for (const e of use) for (const k in e.owner) own[k] = (own[k] || 0) + e.owner[k];
    const tot = Object.values(own).reduce((a, c) => a + c, 0);
    console.log(`helm owner across episode frames: ` + Object.entries(own).sort((a, c) => c[1] - a[1])
        .map(([k, v]) => `${k} ${(100 * v / tot).toFixed(0)}%`).join('  '));

    const worst = use.slice().sort((a, c) => c.dur - a.dur).slice(0, DUMPN);
    for (const e of worst) {
        console.log(`\n--- ${e.boat} seed ${e.seed} leg ${e.leg} start (${Math.round(e.x0)},${Math.round(e.y0)}) dur ${e.dur.toFixed(1)}s` +
            ` duty ${(100 * e.touches / e.frames).toFixed(0)}% dist ${e.dist.toFixed(0)}u disp ${e.disp.toFixed(0)}u ---`);
        console.log(`   t     hit    v     x      y     hdg    cmd   timer  owner`);
        for (let i = 0; i < e.rows.length; i += 6) {
            const r = e.rows[i];
            console.log(`${String(r.t).padStart(6)}  ${r.h ? 'HIT' : '   '}  ${String(r.v).padStart(5)}` +
                ` ${String(r.x).padStart(6)} ${String(r.y).padStart(6)}  ${String(r.hd).padStart(5)}` +
                ` ${String(r.cmd == null ? '-' : r.cmd).padStart(6)} ${String(r.tm).padStart(5)}  ${r.own}`);
        }
    }
})();
