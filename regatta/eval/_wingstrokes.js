// Probe: every flapping bird's wingstroke as a film strip — 10 phases through one beat, 3x, on
// water: herring gull, brown pelican, great egret, bald eagle (labouring up with a fish), and the
// gliders for reference (gull following a ship, soaring eagle, albatross, condor).
//   node regatta/eval/_wingstrokes.js <out.png>     (from the repo root)
const { chromium } = require('playwright'); const path = require('path');
(async () => {
    const out = process.argv[2] || '/tmp/wingstrokes.png';
    const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1500, height: 1080 } });
    await p.goto('file://' + path.resolve('regatta/index.html'));
    await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
    await p.evaluate(() => {
        const A = Wildlife.art, c = document.createElement('canvas'); c.width = 1500; c.height = 1080; c.style.cssText = 'position:fixed;left:0;top:0;z-index:99999';
        document.body.appendChild(c); const g = c.getContext('2d'); g.fillStyle = '#23577a'; g.fillRect(0, 0, 1500, 1080);
        const lab = (s, x, y) => { g.fillStyle = 'rgba(255,255,255,0.9)'; g.font = '12px sans-serif'; g.fillText(s, x, y); };
        const rows = [
            ['herring gull ~3.2 Hz', (ph) => A.drawGullFlying(g, 0, 0, 0, 0, ph)],
            ['brown pelican ~2.2 Hz', (ph) => A.drawPelicanFlying(g, 0, 0, 0, 0, ph + 12, false)],
            ['great egret ~2.6 Hz', (ph) => A.drawEgret(g, { mode: 'fly', x: 0, y: 0, h: 0, z: 0, flap: ph })],
            ['bald eagle climbing with a fish ~2.4 Hz', (ph) => A.drawEagle(g, { mode: 'climb', x: 0, y: 0, h: 0, z: 0, flap: ph, fish: 0, splash: 0, i: 0 })],
        ];
        rows.forEach(([name, fn], r) => { lab(name + ' — one beat, 10 phases (top → down → bottom → up)', 10, 18 + r * 215);
            for (let i = 0; i < 10; i++) { g.save(); g.translate(75 + i * 142, 120 + r * 215); g.scale(2.6, 2.6); fn(i / 10 * Math.PI * 2); g.restore(); } });
        lab('gliders: gull following a ship · soaring eagle · pelican between bouts · albatross · condor', 10, 880);
        const gl = [() => A.drawGullFlying(g, 0, 0, 0, 0, 0, true), () => A.drawEagle(g, { mode: 'soar', x: 0, y: 0, h: 0, z: 0, flap: 0, fish: 0, splash: 0, i: 0 }), () => A.drawPelicanFlying(g, 0, 0, 0, 0, -13, false),
            () => A.drawAlbatross(g, { x: 0, y: 0, h: 0, z: 0, bank: 0.2 }), () => A.drawCondor(g, { x: 0, y: 0, h: 0, z: 0, bank: 0 })];
        gl.forEach((fn, i) => { g.save(); g.translate(110 + i * 290, 980); g.scale(i === 4 ? 1.4 : 2.4, i === 4 ? 1.4 : 2.4); fn(); g.restore(); });
    });
    await p.screenshot({ path: out }); await b.close(); console.log('wrote', out);
})();
