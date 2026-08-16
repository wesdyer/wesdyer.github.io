// THE RIGHTS-ACQUISITION PLAY: DOES IT HAPPEN, AND HOW DO DEFENDERS RESPOND?
// (2026-08-15. Owner: on port with a rival to port, tack to starboard — boldly,
// giving rule-15 room — and the rival must cross, duck, or tack in response.
// The strategic layer has NO rule-state term (verified by code), so any
// occurrence is a VMG accident. This measures: how often the geometry occurs,
// who initiated the tack (nav vs avoidance), and the DEFENDER's response.)
//
// Event: boat X flips port->starboard on an upwind leg while rival Y (same
// previous tack, within 350u, roughly abeam-to-port half-plane) is present.
// Response classification over the next 8 s:
//   tacked   — Y flips tack too (simultaneous-response defence)
//   crossed  — CPA < 160u and Y passes AHEAD of X's bow
//   ducked   — CPA < 160u and Y passes ASTERN
//   forced   — Y deflects >0.26 rad while giving way (no clean cross/duck)
//   none     — CPA >= 160u, no tack: geometry never engaged
// Also: X penalized within the window (a rule-15/13 violation by the attacker),
// Y penalized (defence failed).
//   node _tack_attack.js <trials> <seed0> <tree> <venue>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 4;
const SEED0 = parseInt(process.argv[3]) || 9400;
const ROOT = path.join(__dirname, process.argv[4] || 'treeBASE');
const VENUE = process.argv[5] || 'bay';

(async () => {
    const b = await chromium.launch(); const p = await b.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    await p.evaluate((v) => localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })), VENUE);

    const ALL = [];
    for (let t = 0; t < TRIALS; t++) {
        const r = await p.evaluate(({ seed }) => {
            window.evalHarness.seed = seed; window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(x => x.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
            const DT = 1 / 60;
            const norm = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
            const tackOf = bo => { const w = getWindAt(bo.x, bo.y); return norm(bo.heading - w.direction) < 0 ? 1 : -1; };
            const last = new Map(), events = [];
            let open = []; // events being tracked
            for (let it = 0; it < 60 * 900; it++) {
                window.update(DT);
                if (state.race.status !== 'racing') { if (state.race.status === 'finished') break; continue; }
                const tnow = state.race.timer;
                for (const bo of state.boats) {
                    if (bo.isPlayer || bo.raceState.finished) continue;
                    const tk = tackOf(bo);
                    const lt = last.get(bo.name);
                    last.set(bo.name, tk);
                    if (lt === undefined || lt === tk) continue;
                    // X flipped. port->starboard only (lt=-1 -> tk=1), upwind leg.
                    if (!(lt === -1 && tk === 1)) continue;
                    // upwind by POINT OF SAIL, not route role: legTargetsWindward is
                    // false on rounding-terminated beats (roles are derived only for
                    // gate entries), which zeroed the first run of this probe.
                    { const w2 = getWindAt(bo.x, bo.y); if (Math.abs(norm(bo.heading - w2.direction)) > 1.05) continue; }
                    // find a same-previous-tack rival abeam-to-port within 350u
                    for (const oy of state.boats) {
                        if (oy === bo || oy.isPlayer || oy.raceState.finished) continue;
                        const d = Math.hypot(oy.x - bo.x, oy.y - bo.y);
                        if (d > 350) continue;
                        if (tackOf(oy) !== -1) continue; // rival still on port
                        // rough port half-plane of X's PRE-tack heading
                        const preH = bo.heading; // already turned; acceptable proxy
                        const px = -Math.cos(preH), py = -Math.sin(preH);
                        const side = (oy.x - bo.x) * px + (oy.y - bo.y) * py;
                        events.push({ t: +tnow.toFixed(1), X: bo.name, Y: oy.name, d0: Math.round(d), side: side > 0 ? 'port' : 'stbd' });
                        open.push({ ev: events[events.length - 1], X: bo, Y: oy, t0: tnow,
                                    yTack0: -1, cpa: 1e9, cpaAhead: null, done: false,
                                    xPen0: bo.raceState.totalPenalties || 0, yPen0: oy.raceState.totalPenalties || 0 });
                        break;
                    }
                }
                // track open events
                for (const o of open) {
                    if (o.done) continue;
                    const age = tnow - o.t0;
                    const d = Math.hypot(o.Y.x - o.X.x, o.Y.y - o.X.y);
                    if (d < o.cpa) {
                        o.cpa = d;
                        const fx = Math.sin(o.X.heading), fy = -Math.cos(o.X.heading);
                        o.cpaAhead = ((o.Y.x - o.X.x) * fx + (o.Y.y - o.X.y) * fy) > 0;
                    }
                    const yc = o.Y.controller;
                    if (yc && Math.abs(yc.lastAvoidDeviation || 0) > 0.26 && (yc.avoidanceRole === 'GIVE_WAY')) o.forced = true;
                    if (tackOf(o.Y) === 1) { o.yTacked = true; o.done = true; }
                    if ((o.X.raceState.totalPenalties || 0) > o.xPen0) o.xPen = true;
                    if ((o.Y.raceState.totalPenalties || 0) > o.yPen0) o.yPen = true;
                    if (age > 8) o.done = true;
                }
                open = open.filter(o => { if (o.done) { finish(o); } return !o.done; });
                function finish(o) {
                    const e = o.ev;
                    e.cpa = Math.round(o.cpa);
                    e.resp = o.yTacked ? 'tacked'
                        : (o.cpa < 160 ? (o.cpaAhead ? 'crossed' : 'ducked')
                            : (o.forced ? 'forced' : 'none'));
                    if (o.xPen) e.xPen = 1; if (o.yPen) e.yPen = 1;
                }
            }
            for (const o of open) { o.done = true; const e = o.ev; e.cpa = Math.round(o.cpa); e.resp = o.yTacked ? 'tacked' : (o.cpa < 160 ? (o.cpaAhead ? 'crossed' : 'ducked') : (o.forced ? 'forced' : 'none')); }
            return events;
        }, { seed: SEED0 + t });
        ALL.push(...r);
        console.log(`seed ${SEED0 + t}: ${r.length} port->stbd flips with a port-tack rival <350u`);
    }
    await b.close();
    const by = {};
    for (const e of ALL) by[e.resp || '?'] = (by[e.resp || '?'] || 0) + 1;
    console.log(`\n=== ${VENUE}, ${TRIALS} seeds: ${ALL.length} attack-geometry events ===`);
    for (const k of Object.keys(by).sort((a, c) => by[c] - by[a])) console.log(`  ${k.padEnd(8)} ${by[k]}  (${(100 * by[k] / ALL.length).toFixed(0)}%)`);
    console.log(`  attacker penalized: ${ALL.filter(e => e.xPen).length};  defender penalized: ${ALL.filter(e => e.yPen).length}`);
    console.log(`  close events (cpa<160): ${ALL.filter(e => e.cpa < 160).length}`);
    for (const e of ALL.slice(0, 12)) console.log(' ', JSON.stringify(e));
})();
