// Probe: Redrock's land animals and the condor, drawn big (6x) for a close look.
//   node regatta/eval/_redrock_zoom.js <out.png>
const { chromium } = require('playwright'); const path = require('path');
(async () => {
    const out = process.argv[2] || '/tmp/redrock_zoom.png';
    const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1500, height: 700 } });
    await p.goto('file://' + path.resolve('regatta/index.html'));
    await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
    await p.evaluate(() => {
        const A = Wildlife.art;
        const c = document.createElement('canvas'); c.width = 1500; c.height = 700; c.style.cssText = 'position:fixed;left:0;top:0;z-index:99999';
        document.body.appendChild(c); const g = c.getContext('2d');
        g.fillStyle = '#c9784a'; g.fillRect(0, 0, 1500, 700);
        const sheep = (o) => Object.assign({ x: 0, y: 0, h: 0, look: 0, head: 0, mode: 'graze', step: 0, ram: false, lamb: false, moving: 0 }, o);
        const coy = (o) => Object.assign({ x: 0, y: 0, h: 0, look: 0, head: 0, sit: 0, step: 0, moving: 0 }, o);
        const put = (x, y, s, fn) => { g.save(); g.translate(x, y); g.scale(s, s); fn(); g.restore(); };
        put(150, 350, 7, () => A.drawBighorn(g, sheep({ ram: true })));
        put(400, 350, 7, () => A.drawBighorn(g, sheep({ look: 0.7 })));
        put(650, 350, 7, () => A.drawCoyote(g, coy({ step: 1, moving: 1 })));
        put(900, 350, 7, () => A.drawCoyote(g, coy({ sit: 1 })));
        g.fillStyle = '#2f8f95'; g.fillRect(1000, 0, 500, 700);
        put(1250, 330, 5, () => A.drawCondor(g, { x: 0, y: 0, h: 0, z: 0, bank: 0 }));
    });
    await p.screenshot({ path: out }); await b.close(); console.log('wrote', out);
})();
