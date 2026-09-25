// Probe: a headless look-bench for Sockeye Run's animals — the bear (watching, rearing,
// lunging, eating), a sockeye run, a leaping salmon, the eagle (soaring, stooping, climbing with
// a fish) and the otters (swimming in a line, porpoising, lying up) — on the river's water at
// game scale and at 3x, with the Cove's gull and pelican and a 55-unit hull for size.
//   node regatta/eval/_river_bench.js <out.png>     (from the repo root)
const { chromium } = require('playwright');
const path = require('path');
(async () => {
    const out = process.argv[2] || '/tmp/river_bench.png';
    const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1500, height: 1120 } });
    await p.goto('file://' + path.resolve('regatta/index.html'));
    await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
    await p.evaluate(() => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'river', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
        resetGame();
        const A = Wildlife.art, d = VenueDoc.get('river');
        const water = (d && d.palette && (d.palette.heroColor || d.palette.baseColor)) || '#2b6f8c';
        const c = document.createElement('canvas'); c.width = 1500; c.height = 1120;
        c.style.cssText = 'position:fixed;left:0;top:0;width:1500px;height:1120px;z-index:99999';
        document.body.appendChild(c); const g = c.getContext('2d');
        g.fillStyle = water; g.fillRect(0, 0, 1500, 1120);
        const trail = (x, y, h, n, sp) => Array.from({ length: n }, (_, i) => ({ x: x - Math.sin(h) * (i + 1) * sp, y: y + Math.cos(h) * (i + 1) * sp }));
        const bear = (o) => Object.assign({ i: 0, x: 0, y: 0, h: 0, up: 0, mode: 'watch', rear: 0, lunge: 0, look: 0, splash: 0, fish: 0 }, o);
        const otter = (o) => Object.assign({ i: 0, x: 0, y: 0, h: 0, rh: 0.4, size: 1, dip: 0, ring: 0, trail: [], trailT: 0, curl: 0.5 }, o);
        const hull = (x, y) => { g.save(); g.translate(x, y); g.fillStyle = '#f2f2f2'; g.strokeStyle = '#333'; g.lineWidth = 0.6;
            g.beginPath(); g.moveTo(0, -27.5); g.bezierCurveTo(9, -14, 9, 12, 6.5, 27.5); g.lineTo(-6.5, 27.5); g.bezierCurveTo(-9, 12, -9, -14, 0, -27.5); g.fill(); g.stroke(); g.restore(); };
        const items = [
            ['hull 55', (x, y) => hull(x, y)],
            ['gull (ref)', (x, y) => A.drawGullFlying(g, x, y, -0.4, 40, 0)],
            ['pelican (ref)', (x, y) => A.drawPelicanFlying(g, x, y, 0.3, 60, 1, false)],
            ['bear watch', (x, y) => A.drawBear(g, bear({ x, y }))],
            ['bear rear', (x, y) => A.drawBear(g, bear({ x, y, rear: 1, look: 0.7 }))],
            ['bear lunge', (x, y) => A.drawBear(g, bear({ x, y, mode: 'lunge', lunge: 0.5, splash: 0.6 }))],
            ['bear eats', (x, y) => A.drawBear(g, bear({ x, y, mode: 'eat', fish: 1 }))],
            ['leap red', (x, y) => A.drawLeap(g, { kind: 'salmon', x, y, h: 0.3, t: 0.3, dur: 0.7, size: 1, hop: 18 })],
            ['leap silver', (x, y) => A.drawLeap(g, { kind: 'salmon', silver: true, x, y, h: -0.3, t: 0.3, dur: 0.7, size: 1, hop: 18 })],
            ['sockeye x5', (x, y) => { for (let i = 0; i < 5; i++) A.drawSockeye(g, x + (i % 3) * 14 - 14, y + i * 9 - 18, 0.1 * (i - 2), 1, 0.2, 0.28, i === 3); }],
            ['eagle soar', (x, y) => A.drawEagle(g, { i: 0, x, y, h: 0.3, z: 100, mode: 'soar', flap: 0, fish: 0, splash: 0 })],
            ['eagle stoop', (x, y) => A.drawEagle(g, { i: 0, x, y, h: 0.3, z: 40, mode: 'stoop', flap: 0, fish: 0, splash: 0 })],
            ['eagle + fish', (x, y) => A.drawEagle(g, { i: 0, x, y, h: -0.2, z: 50, mode: 'climb', flap: 1.2, fish: 1, splash: 0 })],
            ['otter swim', (x, y) => { const m = otter({ x, y, h: 0.5, trail: trail(x, y, 0.5, 12, 3) }); A.drawWakeTrail(g, m, 3.2, 1.1, 0.45); A.drawOtter(g, m, false); }],
            ['otter dip', (x, y) => A.drawOtter(g, otter({ x, y, h: 0.5, dip: 0.5, ring: 0.5 }), false)],
            ['otters on jam', (x, y) => { for (let i = 0; i < 4; i++) A.drawOtter(g, otter({ i, x: x + (i - 1.5) * 7.5, y: y + (i % 2) * 3, rh: 0.1 * (i - 1.5), curl: 0.15 }), true); }],
        ];
        const row = (y0, s, label) => {
            g.fillStyle = 'rgba(255,255,255,0.85)'; g.font = '12px sans-serif'; g.fillText(label, 8, y0 - 60 * s / 3 - 20);
            items.forEach(([name, fn], i) => { const x = 60 + i * 102; g.save(); g.translate(x, y0); g.scale(s, s); fn(0, 0); g.restore();
                g.fillStyle = 'rgba(255,255,255,0.8)'; g.font = '10px sans-serif'; g.fillText(name, x - 30, y0 + 20 * s + 14); });
        };
        row(130, 1, 'game scale (1 unit = 1 px)');
        // 3x, fewer per row
        const big = items.slice(0);
        g.fillStyle = 'rgba(255,255,255,0.85)'; g.font = '12px sans-serif'; g.fillText('3x', 8, 240);
        big.forEach(([name, fn], i) => { const col = i % 7, r = Math.floor(i / 7), x = 110 + col * 205, y = 380 + r * 290;
            g.save(); g.translate(x, y); g.scale(3, 3); fn(0, 0); g.restore(); g.fillStyle = 'rgba(255,255,255,0.8)'; g.font = '11px sans-serif'; g.fillText(name, x - 40, y + 125); });
    });
    await p.screenshot({ path: out });
    await b.close(); console.log('wrote', out);
})();
