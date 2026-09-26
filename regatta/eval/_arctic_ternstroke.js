// Probe: an Antarctic tern's wingstroke as a film strip — 12 phases through one beat, hovering
// (top row) and cruising (middle), then the plunge and a bird standing on a floe; 4x on water.
//   node regatta/eval/_arctic_ternstroke.js <out.png>     (from the repo root)
const { chromium } = require('playwright'); const path = require('path');
(async () => {
    const out = process.argv[2] || '/tmp/ternstroke.png';
    const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1500, height: 560 } });
    await p.goto('file://' + path.resolve('regatta/index.html'));
    await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
    await p.evaluate(() => {
        const A = Wildlife.art, c = document.createElement('canvas'); c.width = 1500; c.height = 560; c.style.cssText = 'position:fixed;left:0;top:0;z-index:99999';
        document.body.appendChild(c); const g = c.getContext('2d'); g.fillStyle = '#1d3a5f'; g.fillRect(0, 0, 1500, 560);
        const lab = (s, x, y) => { g.fillStyle = 'rgba(255,255,255,0.9)'; g.font = '12px sans-serif'; g.fillText(s, x, y); };
        for (const [row, mode] of [[0, 'hover'], [1, 'shift']]) {
            lab(mode === 'hover' ? 'HOVERING — one beat, 12 phases (top of stroke → down → bottom → up)' : 'CRUISING — one beat', 10, 18 + row * 190);
            for (let i = 0; i < 12; i++) { g.save(); g.translate(65 + i * 120, 110 + row * 190); g.scale(4, 4); A.drawTern(g, { x: 0, y: 0, h: 0, z: 0, mode, flap: i / 12 * Math.PI * 2, splash: 0, a: 0 }); g.restore(); }
        }
        lab('plunge', 30, 400); g.save(); g.translate(80, 480); g.scale(4, 4); A.drawTern(g, { x: 0, y: 0, h: 0, z: 0, mode: 'dive', flap: 0, splash: 0, a: 0 }); g.restore();
        lab('game scale: hover phases', 230, 400); for (let i = 0; i < 12; i++) { g.save(); g.translate(250 + i * 40, 470); A.drawTern(g, { x: 0, y: 0, h: 0, z: 0, mode: 'hover', flap: i / 12 * Math.PI * 2, splash: 0, a: 0 }); g.restore(); }
    });
    await p.screenshot({ path: out }); await b.close(); console.log('wrote', out);
})();
