// Probe: Otter Point's run home — the INSIDE passage (between the kelp beds and the shore) vs the
// fleet's own line. One boat alone, placed just past the rounding, sailed by the bot straight
// home, or steered through waypoints inshore of each kelp bed; N seeds. Reports leg seconds,
// kelp seconds and rock contacts.
//   node regatta/eval/_otter_inside.js [starts]
const { chromium } = require('playwright'); const path = require('path');
(async () => {
    const starts = +(process.argv[2] || 4);
    const b = await chromium.launch(); const p = await b.newPage();
    await p.goto('file://' + path.resolve('regatta/index.html'));
    await p.waitForFunction(() => window.state && typeof BotController !== 'undefined');
    const r = await p.evaluate((starts) => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'otter', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
        resetGame();
        const kelp = state.course.islands.filter(s => /kelp/.test(s.kind || ''));
        // the inside line: a point in the middle of the clear water shoreward of each bed
        const wp = ['kelp-c1', 'kelp-c2', 'kelp-c3', 'kelp-c4', 'kelp-c5'].map(id => { const k = kelp.find(q => q.id === id); let edge = null, land = null;
            for (let d = 0; d < 1500; d += 10) { const yy = k.y + d; if (!pointInPoly(k.x, yy, k.vertices) && edge == null) edge = d; if (edge != null && pointOnLand(k.x, yy)) { land = d; break; } } return [k.x, k.y + (edge + land) / 2]; });
        const routes = { fleet: [], inside: wp };
        const out = {};
        for (const [name, wps] of Object.entries(routes)) { out[name] = [];
            for (let k = 0; k < starts; k++) {
                let s = 9 + k * 57; Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
                resetGame(); startRace(); const bt = state.boats[1];
                for (const o of state.boats) if (o !== bt) { o.x = 1e6 + Math.random() * 1e3; o.y = 1e6; o.raceState.finished = true; }
                state.race.status = 'racing'; const m = state.course.marks.find(q => q.id === 'mark-point');
                bt.raceState.leg = state.course.route.length - 1; bt.x = m.x + 250; bt.y = m.y - 350; bt.heading = 0.8; bt.speed = 2;
                const ctl = bt.controller || (bt.controller = new BotController(bt)), base = ctl.update.bind(ctl); let own = null, wi = 0;
                ctl.update = (d) => { if (own != null) ctl.targetHeading = own; base(d); own = ctl.targetHeading;
                    if (wi < wps.length) { const [wx, wy] = wps[wi]; if (Math.hypot(wx - bt.x, wy - bt.y) < 160 || bt.x > wx + 50) wi++; else ctl.targetHeading = Math.atan2(wx - bt.x, -(wy - bt.y)); } };
                let t = 0, kt = 0, hits = 0; window.onRaceEvent = (type, e) => { if (type === 'collision_island' && e && e.boat === bt) hits++; };
                while (t < 400 && !bt.raceState.finished) { update(1 / 30); t += 1 / 30; for (const o of state.boats) if (o !== bt) o.x = 1e6 + (o.x % 1000); if (kelp.some(q => pointInPoly(bt.x, bt.y, q.vertices))) kt += 1 / 30; }
                window.onRaceEvent = null;
                out[name].push({ t: bt.raceState.finished ? +t.toFixed(1) : 'DNF', kelp: +kt.toFixed(1), hits });
            } }
        return { wp: wp.map(q => q.map(Math.round).join(',')), out };
    }, starts);
    console.log('inside waypoints: ' + r.wp.join('  '));
    for (const [k, a] of Object.entries(r.out)) console.log(`${k.padEnd(7)} home ${a.map(o => o.t).join(' ')} s   kelp ${a.map(o => o.kelp).join('/')} s   contacts ${a.map(o => o.hits).join('/')}`);
    await b.close();
})();
