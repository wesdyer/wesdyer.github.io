// Frame cost at Emberfall's shore vent (PT-095: the land cut out of the vent foam and steam layers).
//   node regatta/eval/rl/_vent_perf.js
const { chromium } = require('playwright'); const path = require('path');
(async () => {
    const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
    await p.addInitScript(() => localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'volcanic', musicEnabled: false, soundEnabled: false, bgSoundEnabled: false })));
    await p.goto('file://' + path.resolve(__dirname, '../../index.html')); await p.waitForTimeout(1500);
    const r = await p.evaluate(() => {
        TimeTrial.active = true; selectVenue('volcanic'); resetGame(); state.boats.length = 1; startRace();
        while (state.race.status === 'prestart') update(1 / 30);
        const v = state.volcano, vent = v.vents.find(x => x.p.id === 'prop-101') || v.vents[0], me = state.boats[0];
        let spot = null; for (let r = 150; r < 700 && !spot; r += 50) for (let a = 0; a < 16 && !spot; a++) { const x = vent.x + Math.cos(a / 16 * 6.283) * r, y = vent.y + Math.sin(a / 16 * 6.283) * r; if (!pointOnLand(x, y)) spot = { x, y }; }
        for (let i = 0; i < 300; i++) { me.x = spot.x; me.y = spot.y; me.speed = 0; update(1 / 30); }
        const t = (fn) => { const ts = []; for (let i = 0; i < 120; i++) { const t0 = performance.now(); fn(); ts.push(performance.now() - t0); } ts.sort((a, b) => a - b); return +ts[60].toFixed(2); };
        const ctx = document.getElementById('gameCanvas') ? document.getElementById('gameCanvas').getContext('2d') : document.querySelector('canvas').getContext('2d');
        return { boils: t(() => Volcano.drawBoils(ctx)), veil: t(() => Volcano.drawVeil(ctx)), frame: t(() => draw()) };
    });
    console.log(JSON.stringify(r));
    await b.close();
})();
