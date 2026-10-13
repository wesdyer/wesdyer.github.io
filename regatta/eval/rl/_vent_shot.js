// Screenshot the most shore-bound vent at Emberfall after its steam has built up (PT-095).
//   node regatta/eval/rl/_vent_shot.js <out.png>
const { chromium } = require('playwright'); const path = require('path');
(async () => {
    const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
    p.on('pageerror', e => console.log('PAGE ERROR', e.message));
    await p.addInitScript(() => localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'volcanic', musicEnabled: false, soundEnabled: false, bgSoundEnabled: false })));
    if (process.env.NOFX) await p.addInitScript(() => { window.__NOFX = 1; });
    await p.goto('file://' + path.resolve(__dirname, '../../index.html')); await p.waitForTimeout(1500);
    const info = await p.evaluate(() => {
        TimeTrial.active = true; selectVenue('volcanic'); resetGame(); state.boats.length = 1; startRace();
        while (state.race.status === 'prestart') update(1 / 30);
        const v = state.volcano;
        const landPct = (vent) => { let n = 0, l = 0; for (let a = 0; a < 40; a++) for (let rr = 1; rr <= 4; rr++) { const ang = a / 40 * 2 * Math.PI, u = Math.cos(ang) * rr / 4 * vent.a, w = Math.sin(ang) * rr / 4 * vent.b, cs = Math.cos(vent.ang), sn = Math.sin(vent.ang); n++; if (pointOnLand(vent.x + u * cs - w * sn, vent.y + u * sn + w * cs)) l++; } return l / n; };
        const vent = v.vents.slice().sort((a, b) => landPct(b) - landPct(a))[0];
        const me = state.boats[0];
        // the boat in open water beside the vent, so the camera frames it
        let spot = null; for (let r = 150; r < 700 && !spot; r += 50) for (let a = 0; a < 16 && !spot; a++) { const x = vent.x + Math.cos(a / 16 * 6.283) * r, y = vent.y + Math.sin(a / 16 * 6.283) * r; if (!pointOnLand(x, y)) spot = { x, y }; }
        // the cones held quiet (no plume over the shot), the boat parked, heading fixed, so before/after frames match
        const quiet = () => { for (const c of v.cones) { c.parcels.length = 0; c.intensity = 0; } if (v.laze) v.laze.length = 0; };
        for (let i = 0; i < 30 * 12; i++) { me.x = spot.x; me.y = spot.y; me.speed = 0; me.heading = 0; update(1 / 30); quiet(); }
        if (window.__NOFX) { Volcano.drawBoils = () => {}; Volcano.drawVeil = () => {}; }
        draw();
        return { id: vent.p.id, kind: vent.p.kind, x: Math.round(vent.x), y: Math.round(vent.y), land: Math.round(landPct(vent) * 100) };
    });
    console.log(JSON.stringify(info));
    await p.waitForTimeout(300);
    await p.screenshot({ path: process.argv[2] || 'vent.png' });
    await b.close();
})();
