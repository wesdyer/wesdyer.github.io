// Probe: a headless look-bench for Redrock Reservoir's animals — striper boils (three moments),
// a striper rolling, the condor (circling, banked, gliding), bighorn (ram, ewe, lamb; grazing,
// looking, bounding) and coyotes (trotting, staring, sitting, drinking, loping) — on the
// reservoir's water and on sandstone, at game scale and at 1.6x, with a 55-unit hull for size.
//   node regatta/eval/_redrock_bench.js <out.png>     (from the repo root)
const { chromium } = require('playwright');
const path = require('path');
(async () => {
    const out = process.argv[2] || '/tmp/redrock_bench.png';
    const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1500, height: 1300 } });
    await p.goto('file://' + path.resolve('regatta/index.html'));
    await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
    await p.evaluate(() => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'redrock', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
        resetGame();
        const A = Wildlife.art;
        const water = '#2f8f95', sand = '#c9784a';
        const c = document.createElement('canvas'); c.width = 1500; c.height = 1300;
        c.style.cssText = 'position:fixed;left:0;top:0;width:1500px;height:1300px;z-index:99999';
        document.body.appendChild(c); const g = c.getContext('2d');
        const hull = (x, y) => { g.save(); g.translate(x, y); g.fillStyle = '#f2f2f2'; g.strokeStyle = '#333'; g.lineWidth = 0.6;
            g.beginPath(); g.moveTo(0, -27.5); g.bezierCurveTo(9, -14, 9, 12, 6.5, 27.5); g.lineTo(-6.5, 27.5); g.bezierCurveTo(-9, 12, -9, -14, 0, -27.5); g.fill(); g.stroke(); g.restore(); };
        const boil = (x, y, t, h) => { A.setT(t); A.drawStriperBoil(g, { x, y, h: h || 0.4, r: 65, t: 20, life: 60, seed: 12345,
            fish: Array.from({ length: 9 }, (_, i) => ({ a: i * 0.7, d: 0.15 + (i % 5) * 0.17, per: 1.6 + (i % 4) * 0.4, ph: i * 0.37, dir: i % 2 ? 1 : -1, size: 0.9 + (i % 3) * 0.1 })) }); };
        const sheep = (o) => Object.assign({ x: 0, y: 0, h: 0.3, look: 0, head: 0, mode: 'graze', step: 0, ram: false, lamb: false, moving: 0 }, o);
        const coy = (o) => Object.assign({ x: 0, y: 0, h: -0.4, look: 0, head: 0, sit: 0, step: 0, moving: 0, mode: 'stand' }, o);
        const cond = (o) => Object.assign({ x: 0, y: 0, h: 0.5, z: 150, bank: 0 }, o);
        const wet = [
            ['hull 55', (x, y) => hull(x, y)],
            ['boil t=1', (x, y) => boil(x, y, 1)],
            ['boil t=2.3', (x, y) => boil(x, y, 2.3)],
            ['boil t=3.9', (x, y) => boil(x, y, 3.9, -1)],
            ['striper rolling', (x, y) => A.drawStriper(g, x, y, 0.6, 1, 1, 1)],
            ['striper back', (x, y) => A.drawStriper(g, x, y, -0.3, 1, 1, 0)],
            ['condor', (x, y) => A.drawCondor(g, cond({ x, y }))],
            ['condor banked', (x, y) => A.drawCondor(g, cond({ x, y, h: -1.2, bank: 0.9 }))],
        ];
        const dry = [
            ['hull 55', (x, y) => hull(x, y)],
            ['ram grazing', (x, y) => A.drawBighorn(g, sheep({ x, y, ram: true, head: 1 }))],
            ['ram looking', (x, y) => A.drawBighorn(g, sheep({ x, y, ram: true, look: 0.8, h: -0.5 }))],
            ['ewe walking', (x, y) => A.drawBighorn(g, sheep({ x, y, step: 1.2, moving: 1, h: 1 }))],
            ['lamb', (x, y) => A.drawBighorn(g, sheep({ x, y, lamb: true, h: 2 }))],
            ['ewe bounding', (x, y) => A.drawBighorn(g, sheep({ x, y, step: 0.5, moving: 2, h: -2.2 }))],
            ['coyote trot', (x, y) => A.drawCoyote(g, coy({ x, y, step: 1, moving: 1 }))],
            ['coyote stare', (x, y) => A.drawCoyote(g, coy({ x, y, look: -0.9, h: 0.6 }))],
            ['coyote sit', (x, y) => A.drawCoyote(g, coy({ x, y, sit: 1, h: 2.4 }))],
            ['coyote drink', (x, y) => A.drawCoyote(g, coy({ x, y, head: 1, h: 1.6 }))],
            ['coyote lope', (x, y) => A.drawCoyote(g, coy({ x, y, step: 2, moving: 2, h: -1.2 }))],
        ];
        g.fillStyle = water; g.fillRect(0, 0, 1500, 650); g.fillStyle = sand; g.fillRect(0, 650, 1500, 650);
        const lab = (t, x, y) => { g.fillStyle = 'rgba(255,255,255,0.9)'; g.font = '11px sans-serif'; g.fillText(t, x, y); };
        // game scale
        wet.forEach(([n, fn], i) => { const x = 60 + i * 110; g.save(); fn(x, 90); g.restore(); lab(n, x - 30, 160); });
        dry.forEach(([n, fn], i) => { const x = 60 + i * 110; g.save(); fn(x, 720); g.restore(); lab(n, x - 30, 780); });
        // 1.6x (2.4x for the land animals)
        wet.slice(1).forEach(([n, fn], i) => { const x = 110 + i * 205, y = 390; g.save(); g.translate(x, y); g.scale(1.6, 1.6); fn(0, 0); g.restore(); lab(n + ' 1.6x', x - 40, y + 190); });
        dry.slice(1).forEach(([n, fn], i) => { const col = i % 10, x = 80 + col * 140, y = 1000; g.save(); g.translate(x, y); g.scale(2.4, 2.4); fn(0, 0); g.restore(); lab(n + ' 2.4x', x - 40, y + 120); });
    });
    await p.screenshot({ path: out });
    await b.close(); console.log('wrote', out);
})();
