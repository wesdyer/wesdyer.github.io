// Probe: a headless look-bench for Glacier Sound's animals — orca (under, surfacing at three
// moments of the roll, blow), the four penguins standing and porpoising, the leopard seal hauled
// out and swimming, the tern hovering/diving — on the Sound's water and on floe-white, at game
// scale and at 3x, with a 55-unit hull for size.
//   node regatta/eval/_arctic_bench.js <out.png>     (from the repo root)
const { chromium } = require('playwright'); const path = require('path');
(async () => {
    const out = process.argv[2] || '/tmp/arctic_bench.png';
    const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1500, height: 1000 } });
    await p.goto('file://' + path.resolve('regatta/index.html'));
    await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
    await p.evaluate(async () => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
        resetGame();
        const A = Wildlife.art;
        for (const k of ['orca', 'orca-body', 'orca-flukes', 'orca-b-body', 'orca-b-flukes', 'orca-calf-body', 'orca-calf-flukes', 'penguin-emperor', 'penguin-adelie', 'penguin-gentoo', 'penguin-macaroni', 'penguin-porpoising', 'seal']) A.arcticImg(k);
        await new Promise(r => setTimeout(r, 800));
        const c = document.createElement('canvas'); c.width = 1500; c.height = 1000; c.style.cssText = 'position:fixed;left:0;top:0;z-index:99999';
        document.body.appendChild(c); const g = c.getContext('2d');
        g.fillStyle = '#1d3a5f'; g.fillRect(0, 0, 1500, 1000); g.fillStyle = '#eef4fa'; g.fillRect(0, 700, 1500, 300);
        const hull = (x, y) => { g.save(); g.translate(x, y); g.fillStyle = '#f2f2f2'; g.strokeStyle = '#333'; g.lineWidth = 0.6;
            g.beginPath(); g.moveTo(0, -27.5); g.bezierCurveTo(9, -14, 9, 12, 6.5, 27.5); g.lineTo(-6.5, 27.5); g.bezierCurveTo(-9, 12, -9, -14, 0, -27.5); g.fill(); g.stroke(); g.restore(); };
        const orca = (o) => Object.assign({ kind: 'orca', x: 0, y: 0, h: 0, up: -1, beat: 0.4, blow: 0, trail: [] }, o);
        const lab = (s, x, y) => { g.fillStyle = 'rgba(255,255,255,0.85)'; g.font = '11px sans-serif'; g.fillText(s, x, y); };
        const put = (x, y, s, fn) => { g.save(); g.translate(x, y); g.scale(s, s); fn(); g.restore(); };
        const wet = [['hull', () => hull(0, 0)], ['orca under', () => A.drawOrca(g, orca({}))], ['surfacing 0.25', () => A.drawOrca(g, orca({ up: 0.25, blow: 0.9 }))],
            ['surfacing 0.5', () => A.drawOrca(g, orca({ up: 0.5, blow: 0.4 }))], ['surfacing 0.8', () => A.drawOrca(g, orca({ up: 0.8 }))], ['female', () => A.drawOrca(g, orca({ kind: 'orca-b', up: 0.5 }))],
            ['calf', () => A.drawOrca(g, orca({ kind: 'orca-calf', up: 0.5 }))],
            ['porpoising', () => A.drawSwimmers(g, { species: 'gentoo', x: 0, y: 0, h: 0, t: 0.2, birds: [{ ox: 0, oy: 0, ph: 0, per: 1.6 }, { ox: 12, oy: 10, ph: 0.9, per: 1.6 }, { ox: -10, oy: 16, ph: 1.3, per: 1.6 }] })],
            ['seal swim', () => A.drawLeopardSeal(g, { mode: 'swim', x: 0, y: 0, h: 0.4, sw: 0, up: 0.7, ring: 0.5, plop: 0, lx: 0, ly: 0 })],
            ['tern hover', () => A.drawTern(g, { x: 0, y: 0, h: 0, z: 40, mode: 'hover', flap: 1, splash: 0, a: 0 })], ['tern dive', () => A.drawTern(g, { x: 0, y: 0, h: 0.3, z: 20, mode: 'dive', flap: 0, splash: 0, a: 0 })]];
        const dry = [['hull', () => hull(0, 0)], ['emperor', () => A.drawArcticSprite(g, 'emperor', 0, 0, 0, 1)], ['adelie', () => A.drawArcticSprite(g, 'adelie', 0, 0, 0, 1)],
            ['gentoo', () => A.drawArcticSprite(g, 'gentoo', 0, 0, 0, 1)], ['macaroni', () => A.drawArcticSprite(g, 'macaroni', 0, 0, 0, 1)], ['leopard seal', () => A.drawLeopardSeal(g, { mode: 'haul', x: 0, y: 0, h: 0.5, plop: 0, lx: 0, ly: 0 })]];
        wet.forEach(([n, fn], i) => { put(50 + i * 60, 70, 1, fn); });
        wet.slice(1).forEach(([n, fn], i) => { const col = i % 5, row = Math.floor(i / 5); put(140 + col * 280, 250 + row * 230, 2.6, fn); lab(n, 100 + col * 280, 350 + row * 230); });
        dry.forEach(([n, fn], i) => { put(50 + i * 60, 760, 1, fn); });
        dry.slice(1).forEach(([n, fn], i) => { put(140 + i * 250, 890, 4, fn); lab(n, 110 + i * 250, 985); });
    });
    await p.screenshot({ path: out }); await b.close(); console.log('wrote', out);
})();
