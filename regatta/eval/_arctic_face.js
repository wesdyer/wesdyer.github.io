// Probe: Glacier Sound's glacier face (the north-east bay, glacier-front props 57-61) for the
// Explorer objective. (1) Water: how close to the face is open water — points stepped out from
// each front prop, on land or not. (2) Cost: one boat alone from just past the rounding
// (leg 2), sailed by the bot straight home, and steered first to a point off the face.
//   node regatta/eval/_arctic_face.js [starts]     (from the repo root)
const { chromium } = require('playwright'); const path = require('path');
(async () => {
    const starts = +(process.argv[2] || 3);
    const b = await chromium.launch(); const p = await b.newPage();
    await p.goto('file://' + path.resolve('regatta/index.html'));
    await p.waitForFunction(() => window.state && typeof BotController !== 'undefined');
    const r = await p.evaluate((starts) => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
        resetGame();
        const fronts = state.course.props.filter(q => /glacier-front/.test(q.kind) && q.y < 0);
        const water = fronts.map(f => { const o = []; for (const d of [100, 200, 300, 450]) { let wet = 0; for (let a = 0; a < 16; a++) if (!pointOnLand(f.x + Math.cos(a / 16 * 6.283) * d, f.y + Math.sin(a / 16 * 6.283) * d)) wet++; o.push(`${d}u:${wet}/16`); } return `${f.id} (${Math.round(f.x)},${Math.round(f.y)}) water ${o.join(' ')}`; });
        const out = { water, runs: {} };
        const routes = { direct: [], face: [[1450, -3150]] };
        for (const [name, wps] of Object.entries(routes)) { out.runs[name] = [];
            for (let k = 0; k < starts; k++) {
                let s = 3 + k * 71; Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
                resetGame(); startRace();
                const bt = state.boats[1];
                for (const o of state.boats) if (o !== bt) { o.x = 1e6 + Math.random() * 1e3; o.y = 1e6; o.raceState.finished = true; }
                state.race.status = 'racing';
                const m = state.course.marks.find(q => q.id === 'round-1');
                bt.raceState.leg = state.course.route.length - 1; bt.x = m.x + 450; bt.y = m.y + 100; bt.heading = Math.PI; bt.speed = 3;
                const ctl = bt.controller || (bt.controller = new BotController(bt)), base = ctl.update.bind(ctl); let own = null, wi = 0, minD = 1e9;
                ctl.update = (d) => { if (own != null) ctl.targetHeading = own; base(d); own = ctl.targetHeading;
                    if (wi < wps.length) { const [wx, wy] = wps[wi]; if (Math.hypot(wx - bt.x, wy - bt.y) < 200) wi++; else ctl.targetHeading = Math.atan2(wx - bt.x, -(wy - bt.y)); } };
                let t = 0;
                while (t < 500 && !bt.raceState.finished) { update(1 / 30); t += 1 / 30; for (const o of state.boats) if (o !== bt) o.x = 1e6 + (o.x % 1000);
                    for (const f of fronts) minD = Math.min(minD, Math.hypot(bt.x - f.x, bt.y - f.y)); }
                out.runs[name].push({ t: bt.raceState.finished ? +t.toFixed(1) : 'DNF', minD: Math.round(minD) });
            } }
        return out;
    }, starts);
    r.water.forEach(l => console.log(l));
    for (const [k, a] of Object.entries(r.runs)) console.log(`${k.padEnd(7)} home ${a.map(o => o.t).join(' ')} s   closest to the face ${a.map(o => o.minD).join('/')} u`);
    await b.close();
})();
