// Probe: a headless look-bench for Bluewater Bonanza's animals — the bear (watching, rearing,
// lunging, eating), a sockeye run, a leaping salmon, the eagle (soaring, stooping, climbing with
// a fish) and the otters (swimming in a line, porpoising, lying up) — on the river's water at
// game scale and at 3x, with the Cove's gull and pelican and a 55-unit hull for size.
//   node regatta/eval/_ocean_bench.js <out.png>     (from the repo root)
const { chromium } = require('playwright');
const path = require('path');
(async () => {
    const out = process.argv[2] || '/tmp/river_bench.png';
    const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1500, height: 1500 } });
    await p.goto('file://' + path.resolve('regatta/index.html'));
    await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
    await p.evaluate(() => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'ocean', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
        resetGame();
        const A = Wildlife.art, d = VenueDoc.get('ocean');
        const water = '#1e5fa6';
        const c = document.createElement('canvas'); c.width = 1500; c.height = 1500;
        c.style.cssText = 'position:fixed;left:0;top:0;width:1500px;height:1500px;z-index:99999';
        document.body.appendChild(c); const g = c.getContext('2d');
        g.fillStyle = water; g.fillRect(0, 0, 1500, 1500);
        const trail = (x, y, h, n, sp) => Array.from({ length: n }, (_, i) => ({ x: x - Math.sin(h) * (i + 1) * sp, y: y + Math.cos(h) * (i + 1) * sp }));
        const bear = (o) => Object.assign({ i: 0, x: 0, y: 0, h: 0, up: 0, mode: 'watch', rear: 0, lunge: 0, look: 0, splash: 0, fish: 0 }, o);
        const otter = (o) => Object.assign({ i: 0, x: 0, y: 0, h: 0, rh: 0.4, size: 1, dip: 0, ring: 0, trail: [], trailT: 0, curl: 0.5 }, o);
                const W = (o) => Object.assign({ j: 0, calf: false, len: 132, x: 0, y: 0, h: 0, mode: 'surface', depth: 0, fluke: 0, roll: 0, fin: 0, lift: 0, slick: 0, sd: 1, ev: null, ph: 0 }, o);
        const hull = (x, y) => { g.save(); g.translate(x, y); g.fillStyle = '#f2f2f2'; g.strokeStyle = '#333'; g.lineWidth = 0.6;
            g.beginPath(); g.moveTo(0, -27.5); g.bezierCurveTo(9, -14, 9, 12, 6.5, 27.5); g.lineTo(-6.5, 27.5); g.bezierCurveTo(-9, 12, -9, -14, 0, -27.5); g.fill(); g.stroke(); g.restore(); };
        const items = [
            ['hull 55', (x, y) => hull(x, y)],
            ['whale deep', (x, y) => A.drawWhale(g, W({ x, y, mode: 'under', depth: 0.9 }))],
            ['whale shallow', (x, y) => A.drawWhale(g, W({ x, y, mode: 'under', depth: 0.3 }))],
            ['whale surface', (x, y) => A.drawWhale(g, W({ x, y }))],
            ['mother + calf', (x, y) => { A.drawWhale(g, W({ x, y, mode: 'under', depth: 0.25 })); A.drawWhale(g, W({ x: x + 38, y: y - 30, calf: true, len: 48 })); }],
            ['dive, flukes up', (x, y) => A.drawWhale(g, W({ x, y, mode: 'dive', fluke: 1 }))],
            ['breach', (x, y) => { A.drawWhale(g, W({ x, y, ev: 'breach', lift: 1, roll: 0.7 })); }],
            ['breach crash', (x, y) => A.drawSplash(g, { x, y, t: 0.4, life: 7, r: 72, big: true })],
            ['tail slap', (x, y) => { A.drawWhale(g, W({ x, y, ev: 'lobtail', fluke: 0.9 })); A.drawSplash(g, { x, y: y + 59, t: 0.3, life: 3.5, r: 37 }); }],
            ['pec slap', (x, y) => A.drawWhale(g, W({ x, y, ev: 'pecslap', roll: 1, fin: 1, sd: 1 }))],
            ['feeding', (x, y) => { A.drawSplash(g, { x, y: y - 46, t: 0.5, life: 5, r: 40, bait: true }); A.drawWhale(g, W({ x, y, ev: 'feed', lift: 1 })); }],
            ['blow', (x, y) => A.drawBlow(g, { x, y, t: 0.6, size: 1 })],
            ['bow riders', (x, y) => { hull(x, y + 48); for (let i = 0; i < 5; i++) { const row = Math.floor((i + 1) / 2), sd = i === 0 ? 0 : (i % 2 ? -1 : 1); A.drawSpinner(g, { live: true, i, x: x + sd * (7 + row * 7), y: y + 16 - row * 13, h: 0, spin: 0, breath: i === 2 ? 0.8 : 0 }); } }],
            ['flying fish', (x, y) => { for (let i = 0; i < 3; i++) A.drawFlyfish(g, { x0: x - 60 + i * 20, y0: y + 30 - i * 12, h: 0.5, len: 120, t: 0.4 + i * 0.05, dur: 1, z: 8, size: 1 }); }],
            ['albatross', (x, y) => A.drawAlbatross(g, { x, y, h: 1.2, z: 18, bank: 0.3 })],
        ];
        const row = (y0, s, label) => {
            g.fillStyle = 'rgba(255,255,255,0.85)'; g.font = '12px sans-serif'; g.fillText(label, 8, y0 - 60 * s / 3 - 20);
            items.forEach(([name, fn], i) => { const x = 60 + i * 102; if (s > 1) return; g.save(); g.translate(x, y0); g.scale(s, s); fn(0, 0); g.restore();
                g.fillStyle = 'rgba(255,255,255,0.8)'; g.font = '10px sans-serif'; g.fillText(name, x - 30, y0 + 20 * s + 14); });
        };
        row(130, 1, 'game scale (1 unit = 1 px)');
        // 3x, fewer per row
        const big = items.slice(0);
        g.fillStyle = 'rgba(255,255,255,0.85)'; g.font = '12px sans-serif'; g.fillText('1.6x', 8, 250);
        big.forEach(([name, fn], i) => { const col = i % 5, r = Math.floor(i / 5), x = 150 + col * 300, y = 470 + r * 330;
            g.save(); g.translate(x, y); g.scale(1.6, 1.6); fn(0, 0); g.restore(); g.fillStyle = 'rgba(255,255,255,0.8)'; g.font = '11px sans-serif'; g.fillText(name, x - 40, y + 140); });
    });
    await p.screenshot({ path: out });
    await b.close(); console.log('wrote', out);
})();
