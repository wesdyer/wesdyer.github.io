// Probe: the Redrock carp's jump, frame by frame — rising nearly straight up, tipping over,
// falling flat on its side, the slap — at game scale and at 4x, beside the Lake's bass leap
// and a 55-unit hull.
//   node regatta/eval/_redrock_carp.js <out.png>     (from the repo root)
const { chromium } = require('playwright'); const path = require('path');
(async () => {
    const out = process.argv[2] || '/tmp/redrock_carp.png';
    const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1500, height: 720 } });
    await p.goto('file://' + path.resolve('regatta/index.html'));
    await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
    await p.evaluate(() => {
        const A = Wildlife.art;
        const c = document.createElement('canvas'); c.width = 1500; c.height = 720; c.style.cssText = 'position:fixed;left:0;top:0;z-index:99999';
        document.body.appendChild(c); const g = c.getContext('2d');
        g.fillStyle = '#2f8f95'; g.fillRect(0, 0, 1500, 720);
        const hull = (x, y) => { g.save(); g.translate(x, y); g.fillStyle = '#f2f2f2'; g.strokeStyle = '#333'; g.lineWidth = 0.6;
            g.beginPath(); g.moveTo(0, -27.5); g.bezierCurveTo(9, -14, 9, 12, 6.5, 27.5); g.lineTo(-6.5, 27.5); g.bezierCurveTo(-9, 12, -9, -14, 0, -27.5); g.fill(); g.stroke(); g.restore(); };
        const dur = 1, ts = [0.08, 0.25, 0.42, 0.55, 0.7, 0.85, 0.97, 1.1, 1.4, 1.9];
        const carp = (t) => ({ kind: 'carp', x: 0, y: 0, h: 0.9, t, dur, size: 1, hop: 22, roll: 1 });
        const lab = (s, x, y) => { g.fillStyle = 'rgba(255,255,255,0.9)'; g.font = '11px sans-serif'; g.fillText(s, x, y); };
        // game scale
        hull(40, 90); lab('hull 55', 20, 150);
        ts.forEach((t, i) => { g.save(); g.translate(110 + i * 70, 90); A.drawLeap(g, carp(t)); g.restore(); lab('t ' + t, 95 + i * 70, 150); });
        g.save(); g.translate(840, 90); A.drawLeap(g, { kind: 'bass', x: 0, y: 0, h: 0.9, t: 0.35, dur: 0.7, size: 1, hop: 18 }); g.restore(); lab('Lake bass', 815, 150);
        // 4x
        ts.forEach((t, i) => { const col = i % 5, row = Math.floor(i / 5), x = 150 + col * 290, y = 310 + row * 260;
            g.save(); g.translate(x, y); g.scale(4, 4); A.drawLeap(g, carp(t)); g.restore(); lab('4x  t ' + t + ' of 1.0 s', x - 50, y + 110); });
    });
    await p.screenshot({ path: out }); await b.close(); console.log('wrote', out);
})();
