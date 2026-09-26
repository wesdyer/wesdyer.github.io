// Probe: rounding Redrock's north-west butte island (shape-12, the condor roost) — for the
// Explorer objective. (1) Is it sailable all round? Rings at several offsets outside the island
// against every wall (hard/reef shapes) and the arena boundary. (2) What does it cost? One boat
// alone from the start, sailed by the bot straight to mark 3, and steered round the island both
// ways first, from N race seeds. Reports leg-1 seconds, the bearing sweep round the island's
// centre, wall contacts, and whether both Condor Butte gates were crossed.
//   node regatta/eval/_redrock_butte.js [starts]     (from the repo root)
const { chromium } = require('playwright'); const path = require('path');
(async () => {
    const starts = +(process.argv[2] || 4);
    const b = await chromium.launch(); const p = await b.newPage();
    await p.goto('file://' + path.resolve('regatta/index.html'));
    await p.waitForFunction(() => window.state && typeof BotController !== 'undefined');
    const r = await p.evaluate(async (starts) => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'redrock', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
        resetGame();
        const isl = state.course.islands.find(s => s.id === 'shape-12');
        const V = isl.vertices; const C = V.reduce((a, v) => ({ x: a.x + v.x / V.length, y: a.y + v.y / V.length }), { x: 0, y: 0 });
        const walls = state.course.islands.filter(s => { const k = VenueDoc.traits(s); return k.hard || k.reef; });
        const B = (VENUE_DOC.redrock.world.boundary || {}).poly.map(([x, y]) => ({ x, y }));
        const onWall = (x, y) => walls.some(s => pointInPoly(x, y, s.vertices)) || !pointInPoly(x, y, B);
        // rings: push each island vertex out from the centre by d
        const rings = [60, 120, 180, 240].map(d => { let n = 0; for (const v of V) { const a = Math.atan2(v.y - C.y, v.x - C.x); const R = Math.hypot(v.x - C.x, v.y - C.y) + d; if (onWall(C.x + Math.cos(a) * R, C.y + Math.sin(a) * R)) n++; } return `+${d}u: ${n}/${V.length} on a wall`; });
        const sanity = onWall(C.x, C.y) ? 'centre reads as wall (good)' : 'CENTRE NOT A WALL — probe broken';
        const routes = {
            direct: [],
            clockwise: [[-2000, -1000], [-2850, -1300], [-2800, -1950], [-2250, -2150], [-1850, -1700], [-1600, -900]],
            anticlock: [[-1850, -1650], [-2250, -2150], [-2800, -1950], [-2850, -1300], [-2000, -1000]],
        };
        const out = {};
        for (const [name, wps] of Object.entries(routes)) {
            out[name] = [];
            for (let k = 0; k < starts; k++) {
                let s = 5 + k * 97; Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
                resetGame(); startRace();
                const bt = state.boats[1];
                for (const o of state.boats) if (o !== bt) { o.x = 1e6 + Math.random() * 1e3; o.y = 1e6; o.raceState.finished = true; }
                const ctl = bt.controller || (bt.controller = new BotController(bt)), base = ctl.update.bind(ctl); let own = null, wi = 0;
                ctl.update = (d) => { if (own != null) ctl.targetHeading = own; base(d); own = ctl.targetHeading;
                    if (state.race.status !== 'racing') return;
                    if (wi < wps.length) { const [wx, wy] = wps[wi]; if (Math.hypot(wx - bt.x, wy - bt.y) < 220) wi++; else ctl.targetHeading = Math.atan2(wx - bt.x, -(wy - bt.y)); } };
                let t = 0, sweep = 0, lastA = null, hits = 0, t0 = null, legT = null, last = null, gW = false, gN = false;
                const pen0 = bt.raceState.totalPenalties || 0;
                while (t < 400 && legT == null) { update(1 / 30); t += 1 / 30;
                    for (const o of state.boats) if (o !== bt) o.x = 1e6 + (o.x % 1000);
                    if (state.race.status !== 'racing') continue;
                    if (t0 == null) t0 = state.race.timer;
                    if (bt.raceState.leg >= 2 && legT == null) legT = state.race.timer - t0;
                    const here = { x: bt.x, y: bt.y };
                    if (last) { if (_routeGateCrossed(last, here, REDROCK_RUN.butte.w.a, REDROCK_RUN.butte.w.b)) gW = true; if (_routeGateCrossed(last, here, REDROCK_RUN.butte.n.a, REDROCK_RUN.butte.n.b)) gN = true; }
                    last = here;
                    const a = Math.atan2(bt.y - C.y, bt.x - C.x); if (lastA != null) { let da = a - lastA; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI; sweep += da; } lastA = a;
                    if (walls.some(s => pointInPoly(bt.x, bt.y, s.vertices))) hits++;
                }
                out[name].push({ t: legT == null ? 'DNF' : +legT.toFixed(1), sweep: Math.round(Math.abs(sweep) * 180 / Math.PI), hits, both: gW && gN, pen: (bt.raceState.totalPenalties || 0) - pen0 });
            }
        }
        return { C: { x: Math.round(C.x), y: Math.round(C.y) }, rings, sanity, out };
    }, starts);
    console.log(`butte island shape-12, centre ${r.C.x},${r.C.y} — ${r.sanity}\n  ` + r.rings.join('\n  '));
    for (const [k, a] of Object.entries(r.out)) console.log(`${k.padEnd(10)} leg 1: ${a.map(o => o.t).join(' ')} s  sweep ${a.map(o => o.sweep).join('/')}°  wall frames ${a.map(o => o.hits).join('/')}  both gates ${a.map(o => o.both ? 'Y' : 'n').join('')}`);
    await b.close();
})();
