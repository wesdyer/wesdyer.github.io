// Bench: the blue whale large, head up, in four states on the venue's water — for comparing shape
// and colour side by side with aerial references.
//   node regatta/eval/_blue_bench.js out.png     (from the repo root)
const { chromium } = require('playwright'); const path = require('path');
(async () => { const out = process.argv[2] || '/tmp/blue_bench.png';
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  const url = await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'otter', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false })); resetGame();
    const A = Wildlife.art, c = document.createElement('canvas'); c.width = 1300; c.height = 520; const ctx = c.getContext('2d');
    const doc = state.course.doc; ctx.fillStyle = (doc.palette && (doc.palette.baseColor || doc.palette.heroColor)) || '#2a8f9a'; ctx.fillRect(0, 0, 1300, 520);
    const oc = state.camera; state.camera = null; A.setT(10);
    let seed = 7; const rr = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const mott = Array.from({ length: 150 }, () => { const u = -0.46 + rr() * 0.82; return [u, -0.9 + rr() * 1.8, (0.0015 + rr() * 0.0027) * (u > 0.15 ? 0.7 : 1), rr() < 0.55]; });
    const bw = (o) => Object.assign({ j: 0, len: 360, x: 0, y: 0, h: 0, mode: 'under', t: 10, depth: 0.5, ph: 1, fluke: 0, rollT: 99, turn: 0, lunge: 0, sd: 1, mott, v: 40 }, o);
    const items = [['under, deep 0.7', bw({ depth: 0.7 })], ['under, shallow 0.25', bw({ depth: 0.25 })], ['surfacing: head out', bw({ mode: 'surface', rollT: 1.0 })], ['surface: the back', bw({ mode: 'surface', rollT: 2.6 })], ['dorsal, going down', bw({ mode: 'surface', rollT: 3.9 })]];
    items.forEach(([n, o], i) => { ctx.save(); ctx.translate(130 + i * 260, 260); A.drawBlueWhale(ctx, o); ctx.restore(); ctx.fillStyle = '#fff'; ctx.font = '13px sans-serif'; ctx.fillText(n, 70 + i * 260, 505); });
    state.camera = oc; return c.toDataURL(); });
  require('fs').writeFileSync(out, Buffer.from(url.split(',')[1], 'base64')); await b.close(); })();
