// Probe: rounding Bluewater Bonanza's offshore island (the south island) on the run — for the
// Explorer objective. (1) Is it sailable all round? Rings at several radii against every wall.
// (2) What does it cost? One boat alone from just past mark 4, sailed by the bot straight to the
// finish, and by the bot steered through waypoints round the island (both ways), from N moments
// in the swell, each its own race seed. Reports run seconds and the bearing sweep round the
// island's centre that each track achieves.
//   node regatta/eval/_ocean_island.js [starts]     (from the repo root)
const { chromium } = require('playwright'); const path = require('path');
(async () => {
    const starts = +(process.argv[2] || 6);
    const b = await chromium.launch(); const p = await b.newPage();
    await p.goto('file://' + path.resolve('regatta/index.html'));
    await p.waitForFunction(() => window.state && window.Swell && typeof BotController !== 'undefined');
    const r = await p.evaluate(async (starts) => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'ocean', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
        resetGame();
        const C = { x: 3300, y: 6300 };
        // (1) rings: at each radius, how many of 72 points are on a wall (hard or reef shapes)
        const walls = (state.course.islands || []).filter(s => { const k = VenueDoc.traits(s); return k.hard || k.reef; });
        const onWall = (x, y) => walls.some(s => pointInPoly(x, y, s.vertices));
        const rings = [1600, 1900, 2200, 2600, 3000].map(R => { let n = 0; for (let a = 0; a < 72; a++) if (onWall(C.x + Math.cos(a / 72 * 6.283) * R, C.y + Math.sin(a / 72 * 6.283) * R)) n++; return `r${R}: ${n}/72 on a wall`; });
        const wallIds = walls.filter(s => Math.hypot(((s.bounds || {}).minX || 0) - C.x, 0) < 1e9).map(s => s.id + ':' + (VenueDoc.traits(s).hard ? 'hard' : 'reef')).filter(id => /shape-(4|8|9|10|16|24)\b/.test(id));
        // (2) the cost
        const routes = {
            direct: [],
            west_about: [[800, 5000], [1400, 8300], [3300, 9100], [5300, 8300], [5900, 5200]],
            east_about: [[5900, 5000], [5300, 8300], [3300, 9100], [1400, 8300], [800, 5200], [1500, 3500]],
        };
        const out = {};
        for (const [name, wps] of Object.entries(routes)) {
            out[name] = [];
            for (let k = 0; k < starts; k++) {
                let s = 11 + k * 131; Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
                resetGame(); startRace();
                const me = state.boats[0], bt = state.boats[1];
                for (const o of state.boats) if (o !== bt) { o.x = 1e6 + Math.random(); o.y = 1e6; o.raceState.finished = true; }
                state.race.status = 'racing';
                const m4 = state.course.marks.find(m => m.id === 'mark-4'), last = state.course.route.length - 1;
                bt.raceState.leg = last; bt.x = m4.x + 300; bt.y = m4.y + 150; bt.speed = 3; bt.heading = Math.PI / 2;
                for (let i = 0; i < Math.round(k * 7.3 * 30); i++) Swell.update(1 / 30);
                const ctl = bt.controller || (bt.controller = new BotController(bt)), base = ctl.update.bind(ctl); let own = null, wi = 0;
                ctl.update = (d) => { if (own != null) ctl.targetHeading = own; base(d); own = ctl.targetHeading;
                    if (wi < wps.length) { const [wx, wy] = wps[wi]; if (Math.hypot(wx - bt.x, wy - bt.y) < 350) wi++; else ctl.targetHeading = Math.atan2(wx - bt.x, -(wy - bt.y)); } };
                let t = 0, sweep = 0, lastA = null, minD = 1e9;
                while (t < 500 && !bt.raceState.finished) { update(1 / 30); t += 1 / 30; me.x = 1e6;
                    const a = Math.atan2(bt.y - C.y, bt.x - C.x), d = Math.hypot(bt.x - C.x, bt.y - C.y); minD = Math.min(minD, d);
                    if (lastA != null && d < 4500) { let da = a - lastA; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI; sweep += da; } lastA = a; }
                out[name].push({ t: +t.toFixed(1), fin: bt.raceState.finished, sweep: Math.round(Math.abs(sweep) * 180 / Math.PI), minD: Math.round(minD), walls: bt.raceState.penaltyCount || 0 });
            }
        }
        return { rings, wallIds, out };
    }, starts);
    console.log('SAILABILITY round the island (centre 3300, 6300):\n  ' + r.rings.join('\n  ') + '\n  walls here: ' + r.wallIds.join(' '));
    for (const [k, a] of Object.entries(r.out)) {
        const m = (f) => (a.reduce((s, o) => s + o[f], 0) / a.length).toFixed(0);
        console.log(`${k.padEnd(11)} run ${m('t')}s  sweep ${m('sweep')}° (min ${Math.min(...a.map(o => o.sweep))}°)  closest ${m('minD')} u  unfinished ${a.filter(o => !o.fin).length}/${a.length}  [${a.map(o => o.t).join(' ')}]`);
    }
    await b.close();
})();
