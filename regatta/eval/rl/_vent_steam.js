// PT-095: vent steam is sea steam. Runs Emberfall for 40 s and reports, per vent, how much of its ellipse is
// land and how many of its live steam parcels are over land (they may be, for under half a second, as the
// wind carries them ashore).   node regatta/eval/rl/_vent_steam.js
const { chromium } = require('playwright'); const path = require('path');
(async () => {
    const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1200, height: 800 } });
    p.on('pageerror', e => console.log('PAGE ERROR', e.message));
    await p.addInitScript(() => localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'volcanic', musicEnabled: false, soundEnabled: false, bgSoundEnabled: false })));
    await p.goto('file://' + path.resolve(__dirname, '../../index.html')); await p.waitForTimeout(1500);
    const r = await p.evaluate(() => {
        TimeTrial.active = true; selectVenue('volcanic'); resetGame(); state.boats.length = 1; startRace();
        while (state.race.status === 'prestart') update(1 / 30);
        const v = state.volcano, out = [];
        let samples = 0, onLand = 0, born = 0, bornLand = 0; const seen = new Set();
        for (let i = 0; i < 30 * 40; i++) {
            update(1 / 30);
            if (i % 15) continue;
            for (const vent of v.vents) for (const q of vent.parcels) {
                samples++; if (pointOnLand(q.x, q.y)) onLand++;
                if (!seen.has(q) && q.age < 0.2) { seen.add(q); born++; if (pointOnLand(q.x, q.y)) bornLand++; }
            }
        }
        for (const vent of v.vents) { let n = 0, l = 0; for (let a = 0; a < 40; a++) for (let rr = 1; rr <= 4; rr++) { const ang = a / 40 * 2 * Math.PI, u = Math.cos(ang) * rr / 4 * vent.a, w = Math.sin(ang) * rr / 4 * vent.b, cs = Math.cos(vent.ang), sn = Math.sin(vent.ang); n++; if (pointOnLand(vent.x + u * cs - w * sn, vent.y + u * sn + w * cs)) l++; } out.push(Math.round(l / n * 100)); }
        return { vents: v.vents.length, ellipseLandPct: out, samples, onLandPct: +(onLand / Math.max(1, samples) * 100).toFixed(1), born, bornLand };
    });
    console.log(JSON.stringify(r));
    await b.close();
})();
